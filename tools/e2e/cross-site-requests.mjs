import assert from 'node:assert/strict';

export async function testCrossSiteRequests({ platform, siteManager, sender, senderSiteId, senderSiteName, recipientInstanceId, subordinateOrigins, internalRecipients, receiver, receiverSiteId, suffix, updateStatus, executeDefault, finishAndArchive }) {
  const smtpHost = process.env.FYLKREN_E2E_SMTP_HOST;
  const smtpInspectUrl = process.env.FYLKREN_E2E_SMTP_INSPECT_URL;
  if (smtpHost) {
    assert.ok(smtpInspectUrl, 'SMTP delivery test requires FYLKREN_E2E_SMTP_INSPECT_URL');
    const configured = await platform.put('/api/platform/smtp/', {
      enabled: true, host: smtpHost, port: 2525, security: 'none',
      username: null, password: null, clearPassword: true,
      fromAddress: 'fylkren-e2e@example.invalid', fromName: 'Synthetic Fylkren',
    });
    assert.equal(configured.status, 204, `synthetic SMTP configuration: ${JSON.stringify(configured.body)}`);
  }
  for (const [siteId, flags] of [
    [senderSiteId, { childWorkCompleted: true }],
    [receiverSiteId, { newWorkItems: true, workItemChanges: true }],
  ]) {
    const settings = await siteManager.put(`/api/site-notifications/sites/${siteId}`, {
      newWorkItems: false, workItemChanges: false, decisionsRequired: false,
      childWorkCompleted: false, planningCompleted: false, executionCompleted: false, ...flags,
    });
    assert.equal(settings.status, 204, `notification settings ${siteId}: ${JSON.stringify(settings.body)}`);
  }

  async function waitForNotification(siteId, workItemId, minimumCount = 1) {
    const deadline = Date.now() + 70_000;
    while (Date.now() < deadline) {
      const deliveries = await platform.request('/api/platform/smtp/deliveries?pageSize=100');
      assert.equal(deliveries.status, 200, `notification deliveries: ${JSON.stringify(deliveries.body)}`);
      const matches = deliveries.body.items.filter(message => message.siteId === siteId && message.workItemId === workItemId);
      if (matches.length >= minimumCount && matches.every(message => message.status === (smtpHost ? 'sent' : 'pending'))) {
        return matches;
      }
      await new Promise(resolve => setTimeout(resolve, 1_000));
    }
    assert.fail(`Missing ${minimumCount} ${smtpHost ? 'sent' : 'queued'} notification(s) for ${siteId}/${workItemId}`);
  }

  async function createSource(label) {
    const title = `${label} ${suffix}`;
    const result = await sender.post(`/api/work/sites/${senderSiteId}/items`, {
      title, description: `${label} basis`, recommendation: null,
      referenceUrl: null, dueAt: null, workItemTypeId: null, sourceTypeId: null, senderId: null,
      targetSiteId: null, targetUnitId: null, assignedUnitId: null,
    });
    assert.equal(result.status, 201, `${label} source: ${JSON.stringify(result.body)}`);
    await updateStatus(sender, result.body.id, 'under_review', null, 'normal', senderSiteId);
    return result.body.id;
  }

  async function find(account, siteId, title, predicate = () => true) {
    const overview = await account.request(`/api/work/sites/${siteId}/items/overview`);
    assert.equal(overview.status, 200, `${title} overview: ${JSON.stringify(overview.body)}`);
    const matches = overview.body.filter(item => item.title === title && predicate(item));
    assert.equal(matches.length, 1, `${title} missing or duplicated: ${JSON.stringify(matches)}`);
    return matches[0];
  }

  async function sendRequest(sourceId, title) {
    const sent = await sender.post(`/api/work/sites/${senderSiteId}/items/${sourceId}/request`, {
      title, description: `${title} instruction`, targetSiteId: receiverSiteId,
      targetInstanceId: recipientInstanceId, targetUnitId: null,
    });
    assert.equal(sent.status, 201, `${title} request: ${JSON.stringify(sent.body)}`);
    const tracking = await find(sender, senderSiteId, title);
    assert.equal(tracking.id, sent.body.id);
    assert.equal(tracking.parentWorkItemId, sourceId, 'Request replaced its source task');
    assert.equal(tracking.isOutgoingRequest, true);
    const source = await sender.request(`/api/work/sites/${senderSiteId}/items/${sourceId}/details`);
    assert.equal(source.status, 200, `Source task disappeared after request: ${JSON.stringify(source.body)}`);
    const received = await find(receiver, receiverSiteId, title);
    assert.equal(received.status, 'registered');
    assert.equal(received.senderSiteName, senderSiteName, 'Official sending site snapshot missing');
    return { tracking, received };
  }

  const sourceId = await createSource('Synthetic answered request source');
  const title = `Synthetic answered request ${suffix}`;
  const answered = await sendRequest(sourceId, title);
  await waitForNotification(receiverSiteId, answered.received.id);
  const privateDetails = await sender.request(`/api/work/sites/${senderSiteId}/items/${answered.received.id}/details`);
  assert.equal(privateDetails.status, 403, 'Sender can inspect receiver internal task');
  const receiverQueue = await sender.request(`/api/execution/sites/${receiverSiteId}`);
  assert.equal(receiverQueue.status, 403, 'Sender can inspect receiver execution queue');
  await updateStatus(receiver, answered.received.id, 'under_review', null, 'normal', receiverSiteId);
  await executeDefault(receiver, answered.received.id, receiverSiteId);
  await finishAndArchive(receiver, answered.received.id, null, 'Request receiver', receiverSiteId);
  await waitForNotification(senderSiteId, answered.received.id);
  const senderBeforeAcceptance = await find(sender, senderSiteId, title);
  assert.equal(senderBeforeAcceptance.requestProgressStatus, 'completed');
  assert.ok(senderBeforeAcceptance.requestResponse?.includes('Request receiver completed its work.'),
    'Approved official response missing from sender view');
  await updateStatus(sender, answered.tracking.id, 'completed', null, null, senderSiteId);
  const accepted = await sender.request(`/api/work/sites/${senderSiteId}/items/${answered.tracking.id}/details`);
  assert.equal(accepted.status, 200, `accepted response: ${JSON.stringify(accepted.body)}`);
  assert.ok(accepted.body.task.finalReport?.includes('Request receiver completed its work.'),
    'Accepted response not copied to sender report');
  const senderArchive = await sender.request(`/api/work/sites/${senderSiteId}/reports`);
  assert.equal(senderArchive.status, 200, `sender report archive: ${JSON.stringify(senderArchive.body)}`);
  assert.ok(senderArchive.body.reports.some(report => report.id === answered.tracking.id),
    'Accepted response missing from sender archive');

  const cancellationSourceId = await createSource('Synthetic cancelled request source');
  const cancellationTitle = `Synthetic cancelled request ${suffix}`;
  const cancelled = await sendRequest(cancellationSourceId, cancellationTitle);
  await waitForNotification(receiverSiteId, cancelled.received.id);
  const cancel = await sender.post(`/api/work/sites/${senderSiteId}/items/${cancelled.tracking.id}/cancel`, {
    decisionNote: 'Synthetic test withdrawal',
  });
  assert.equal(cancel.status, 200, `request cancellation: ${JSON.stringify(cancel.body)}`);
  await waitForNotification(receiverSiteId, cancelled.received.id, 2);
  const receiverAfterCancellation = await find(receiver, receiverSiteId, cancellationTitle);
  assert.equal(receiverAfterCancellation.status, 'request_cancelled');
  await updateStatus(receiver, cancelled.received.id, 'completed', null, null, receiverSiteId);
  const receiverAfterAck = await find(receiver, receiverSiteId, cancellationTitle);
  assert.equal(receiverAfterAck.status, 'completed');
  const senderAfterAck = await find(sender, senderSiteId, cancellationTitle);
  assert.equal(senderAfterAck.status, 'cancelled');

  async function createOriginTask(origin, label) {
    const created = await origin.account.post(`/api/work/sites/${senderSiteId}/items`, {
      title: `Synthetic ${label} source ${suffix}`,
      description: `${origin.label} task needing support`, recommendation: null,
      referenceUrl: null, dueAt: null, workItemTypeId: null, sourceTypeId: null, senderId: null,
      targetSiteId: null, targetUnitId: null, assignedUnitId: origin.unitId,
    });
    assert.equal(created.status, 201, `${label} source: ${JSON.stringify(created.body)}`);
    await updateStatus(origin.account, created.body.id, 'under_review', null, 'normal', senderSiteId);
    return created.body.id;
  }

  const subordinateTrackingIds = [];
  for (const origin of subordinateOrigins) {
    const sourceId = await createOriginTask(origin, `${origin.label} external request`);
    const title = `Synthetic ${origin.label} external request ${suffix}`;
    const instruction = `External support required by ${origin.label}`;
    const sent = await origin.account.post(`/api/work/sites/${senderSiteId}/items/${sourceId}/request`, {
      title, description: instruction, targetSiteId: receiverSiteId, targetUnitId: null,
    });
    assert.equal(sent.status, 201, `${origin.label} request: ${JSON.stringify(sent.body)}`);
    const tracking = await find(origin.account, senderSiteId, title, item => item.id === sent.body.id);
    assert.equal(tracking.assignedUnitId, origin.unitId, 'Request tracking moved away from its originating level');
    const received = await find(receiver, receiverSiteId, title);
    assert.equal(received.senderSiteName, senderSiteName, 'Subordinate request did not identify the top-level site as sender');
    assert.equal(received.description, instruction);
    await updateStatus(receiver, received.id, 'under_review', null, 'normal', receiverSiteId);
    await executeDefault(receiver, received.id, receiverSiteId);
    await finishAndArchive(receiver, received.id, null, `${origin.label} request receiver`, receiverSiteId);
    const response = await find(origin.account, senderSiteId, title, item => item.id === tracking.id);
    assert.equal(response.requestProgressStatus, 'completed');
    assert.ok(response.requestResponse?.includes(`${origin.label} request receiver completed its work.`),
      `Official response did not return to ${origin.label}`);
    await updateStatus(origin.account, tracking.id, 'completed', null, null, senderSiteId);
    const archive = await origin.account.request(`/api/work/sites/${senderSiteId}/reports?unitId=${origin.unitId}`);
    assert.equal(archive.status, 200, `${origin.label} report archive: ${JSON.stringify(archive.body)}`);
    assert.ok(archive.body.reports.some(report => report.id === tracking.id),
      `Official response missing from ${origin.label} report archive`);
    subordinateTrackingIds.push(tracking.id);
  }

  const internalTrackingIds = [];
  const origin = subordinateOrigins[0];
  for (const recipient of internalRecipients) {
    const sourceId = await createOriginTask(origin, `${recipient.label} internal request`);
    const title = `Synthetic request to ${recipient.label} ${suffix}`;
    const instruction = `Support requested from ${recipient.label}`;
    const sent = await origin.account.post(`/api/work/sites/${senderSiteId}/items/${sourceId}/request`, {
      title, description: instruction, targetSiteId: null, targetUnitId: recipient.unitId,
    });
    assert.equal(sent.status, 201, `internal request to ${recipient.label}: ${JSON.stringify(sent.body)}`);
    const tracking = await find(origin.account, senderSiteId, title, item => item.id === sent.body.id);
    assert.equal(tracking.assignedUnitId, origin.unitId);
    const received = await find(recipient.account, senderSiteId, title, item => item.parentWorkItemId === tracking.id);
    assert.equal(received.assignedUnitId, recipient.unitId);
    assert.equal(received.description, instruction);
    await executeDefault(recipient.account, received.id, senderSiteId);
    await finishAndArchive(recipient.account, received.id, recipient.unitId, `${recipient.label} internal request receiver`, senderSiteId);
    const response = await find(origin.account, senderSiteId, title, item => item.id === tracking.id);
    assert.equal(response.requestProgressStatus, 'completed');
    assert.ok(response.requestResponse?.includes(`${recipient.label} internal request receiver completed its work.`),
      `Internal response from ${recipient.label} did not return to ${origin.label}`);
    await updateStatus(origin.account, tracking.id, 'completed', null, null, senderSiteId);
    const archive = await origin.account.request(`/api/work/sites/${senderSiteId}/reports?unitId=${origin.unitId}`);
    assert.equal(archive.status, 200, `internal sender report archive: ${JSON.stringify(archive.body)}`);
    assert.ok(archive.body.reports.some(report => report.id === tracking.id),
      `Internal response from ${recipient.label} missing from ${origin.label} report archive`);
    internalTrackingIds.push(tracking.id);
  }

  if (smtpHost) {
    const inspection = await fetch(smtpInspectUrl);
    assert.equal(inspection.status, 200, 'Synthetic SMTP sink could not be inspected');
    const messages = await inspection.json();
    assert.ok(messages.count >= 4, `SMTP sink accepted only ${messages.count} message(s); expected request, answer and cancellation notifications`);
    assert.ok(messages.messages.every(message => message.recipient.endsWith('@example.invalid')),
      'SMTP sink received a non-synthetic recipient');
  }

  return { answeredTrackingId: answered.tracking.id, cancelledTrackingId: cancelled.tracking.id, subordinateTrackingIds, internalTrackingIds };
}
