import assert from 'node:assert/strict';

export async function testDecisionsRisksVersions({ leader, sibling, unrelated, siteId, otherSiteId, personId, taskId, planId, executionId, sectionTaskId, approvedReportTaskId, suffix }) {
  const decisionPath = `/api/decisions/sites/${siteId}/tasks/${taskId}`;
  const decisionBody = {
    title: `Synthetic decision ${suffix}`, decision: 'Proceed with documented execution',
    rationale: 'Synthetic rationale for version and history verification', status: 'recorded',
    decisionMakerIds: [personId],
    references: [
      { objectType: 'plan', objectId: planId },
      { objectType: 'execution', objectId: executionId },
    ],
  };
  const created = await leader.post(decisionPath, decisionBody);
  assert.equal(created.status, 201, `Decision create: ${JSON.stringify(created.body)}`);
  const decisionId = created.body.id;
  const initial = await leader.request(decisionPath);
  assert.equal(initial.status, 200);
  const decision = initial.body.find(value => value.id === decisionId);
  assert.ok(decision);
  assert.equal(decision.current.revisionNumber, 1);
  assert.equal(decision.current.decision, decisionBody.decision);
  assert.ok(decision.current.decisionMakers.some(value => value.personId === personId));
  for (const type of ['work_item', 'plan', 'execution']) {
    assert.ok(decision.current.references.some(value => value.objectType === type), `Missing ${type} reference`);
  }
  const revisedBody = { ...decisionBody, expectedRevision: 1, rationale: 'Revised synthetic rationale', decision: 'Proceed after review' };
  assert.equal((await leader.put(`/api/decisions/${decisionId}`, revisedBody)).status, 200);
  assert.equal((await leader.put(`/api/decisions/${decisionId}`, revisedBody)).status, 409, 'Stale decision revision accepted');
  const revised = await leader.request(decisionPath);
  const currentDecision = revised.body.find(value => value.id === decisionId);
  assert.equal(currentDecision.revisions.length, 2);
  assert.equal(currentDecision.current.revisionNumber, 2);
  assert.equal(currentDecision.revisions.find(value => value.revisionNumber === 1).decision, decisionBody.decision,
    'Earlier decision was overwritten');
  assert.ok([403, 404].includes((await unrelated.request(`/api/decisions/sites/${siteId}/tasks/${taskId}`)).status),
    'Unrelated site read decision');
  assert.ok([403, 404].includes((await sibling.request(`/api/decisions/sites/${siteId}/tasks/${taskId}`)).status),
    'Sibling unit read top-level decision');
  assert.equal((await leader.post(`/api/decisions/sites/${otherSiteId}/tasks/${taskId}`, decisionBody)).status, 404,
    'Cross-site decision creation accepted');

  const riskPath = `/api/risks/sites/${siteId}/task/${taskId}`;
  const riskBody = {
    title: `Synthetic risk ${suffix}`, description: 'Synthetic operational risk',
    probability: 4, impact: 5, ownerPersonId: personId, status: 'identified',
    dueDate: '2026-12-31', residualProbability: null, residualImpact: null,
  };
  const combined = await leader.post(riskPath, { ...riskBody, title: `Combined risk ${suffix}`, initialMitigation: 'Prevent duplicate work', residualProbability: 2, residualImpact: 2 });
  assert.equal(combined.status, 201, `Combined risk and mitigation: ${JSON.stringify(combined.body)}`);
  const combinedList = await leader.request(riskPath);
  const combinedRisk = combinedList.body.find(value => value.id === combined.body.id);
  assert.equal(combinedRisk.mitigations.length, 1);
  assert.equal(combinedRisk.mitigations[0].action, 'Prevent duplicate work');
  assert.equal(combinedRisk.mitigations[0].dueDate, riskBody.dueDate);
  assert.equal(combinedRisk.mitigations[0].ownerPersonId, personId);
  assert.equal(combinedRisk.current.residualScore, 4);
  for (const initialMitigation of ['x', 'x'.repeat(4001)]) {
    const invalid = await leader.post(riskPath, { ...riskBody, initialMitigation });
    assert.equal(invalid.status, 400);
  }
  assert.equal((await leader.request(riskPath)).body.length, combinedList.body.length, 'Invalid mitigation partially created a risk');
  const riskCreated = await leader.post(riskPath, riskBody);
  assert.equal(riskCreated.status, 201, `Risk create: ${JSON.stringify(riskCreated.body)}`);
  const riskId = riskCreated.body.id;
  const riskInitial = await leader.request(riskPath);
  assert.equal(riskInitial.status, 200);
  assert.equal(riskInitial.body.find(value => value.id === riskId)?.current.score, 20);
  const action = await leader.post(`/api/risks/${riskId}/mitigations`, {
    action: 'Install synthetic containment', ownerPersonId: personId, status: 'planned', dueDate: '2026-12-15',
  });
  assert.equal(action.status, 201, `Mitigation: ${JSON.stringify(action.body)}`);
  const secondAction = await leader.post(`/api/risks/${riskId}/mitigations`, {
    action: 'Run synthetic verification', ownerPersonId: personId, status: 'planned', dueDate: '2026-12-20',
  });
  assert.equal(secondAction.status, 201);
  const actionUpdate = await leader.put(`/api/risks/mitigations/${action.body.id}`, {
    expectedVersion: 1, action: 'Install synthetic containment', ownerPersonId: personId,
    status: 'completed', dueDate: '2026-12-15',
  });
  assert.equal(actionUpdate.status, 200);
  assert.equal((await leader.put(`/api/risks/mitigations/${action.body.id}`, {
    expectedVersion: 1, action: 'Install synthetic containment', ownerPersonId: personId,
    status: 'completed', dueDate: '2026-12-15',
  })).status, 409, 'Stale mitigation version accepted');
  const riskRevised = await leader.put(`/api/risks/${riskId}`, {
    ...riskBody, expectedVersion: 1, status: 'mitigating', residualProbability: 2, residualImpact: 3,
  });
  assert.equal(riskRevised.status, 200);
  const riskRead = await leader.request(riskPath);
  const risk = riskRead.body.find(value => value.id === riskId);
  assert.equal(risk.current.version, 2);
  assert.equal(risk.current.residualScore, 6);
  assert.equal(risk.history.find(value => value.version === 1)?.score, 20);
  assert.equal(risk.mitigations.length, 2);
  assert.equal(risk.mitigations.find(value => value.id === action.body.id)?.status, 'completed');
  assert.ok([403, 404].includes((await unrelated.request(riskPath)).status), 'Unrelated site read risk');
  assert.ok([403, 404].includes((await sibling.request(riskPath)).status), 'Sibling unit read top-level risk');
  assert.equal((await leader.request(`/api/risks/sites/${otherSiteId}/task/${taskId}`)).status, 404,
    'Risk crossed site boundary');

  // Common activity remains correlated with the original immutable revisions.
  const historyFor = async resourceType => {
    const result = await leader.request(`/api/activity/sites/${siteId}?workItemId=${taskId}&resourceType=${resourceType}&limit=50`);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.ok(result.body.items.every(value => !('payloadJson' in value) && !('activityMetadataJson' in value)));
    return result.body.items;
  };
  const decisionActivity = (await historyFor('decision')).filter(value => value.resourceId === decisionId);
  assert.equal(decisionActivity.filter(value => value.type === 'decision.created').length, 1);
  assert.equal(decisionActivity.filter(value => value.type === 'decision.updated').length, 1, 'Stale revision created activity');
  assert.equal((await leader.put(`/api/risks/${riskId}`, {
    ...riskBody, expectedVersion: 2, status: 'closed', residualProbability: 2, residualImpact: 3,
  })).status, 200);
  const riskActivity = (await historyFor('risk')).filter(value => value.resourceId === riskId);
  for (const type of ['risk.created', 'risk.updated', 'risk.closed']) assert.equal(riskActivity.filter(value => value.type === type).length, 1, type);
  const measureActivity = (await historyFor('measure')).filter(value => value.resourceId === action.body.id);
  for (const type of ['measure.created', 'measure.completed']) assert.equal(measureActivity.filter(value => value.type === type).length, 1, type);
  const safeHistory = JSON.stringify([...decisionActivity, ...riskActivity, ...measureActivity]);
  for (const privateText of [decisionBody.rationale, riskBody.description, 'Install synthetic containment']) assert.ok(!safeHistory.includes(privateText), 'Domain content leaked into activity');
  assert.equal((await sibling.request(`/api/activity/sites/${siteId}?workItemId=${taskId}&resourceType=risk`)).status, 403);

  const versionsPath = `/api/approvals/sites/${siteId}/items/${taskId}/versions`;
  const versions = await leader.request(versionsPath);
  assert.equal(versions.status, 200);
  const types = versions.body.map(value => value.objectType);
  assert.ok(types.includes('plan') && types.includes('final_report') && types.includes('decision'),
    `Formal versions missing: ${JSON.stringify(types)}`);
  for (const version of versions.body) {
    assert.match(version.contentHash, /^[0-9a-f]{64}$/i);
    assert.ok(version.signoffs.some(value => value.approverPersonId === personId && value.signedAt),
      `Version ${version.id} lacks recorded sign-off`);
    assert.ok(version.content && typeof version.content === 'object');
  }
  const decisionVersions = versions.body.filter(value => value.objectType === 'decision' && value.objectId === decisionId)
    .sort((a, b) => a.versionNumber - b.versionNumber);
  assert.equal(decisionVersions.length, 2);
  assert.notEqual(decisionVersions[0].contentHash, decisionVersions[1].contentHash);
  assert.equal(decisionVersions[0].content.decision, decisionBody.decision);
  assert.equal(decisionVersions[1].content.decision, revisedBody.decision);
  assert.ok([403, 404].includes((await unrelated.request(versionsPath)).status), 'Unrelated site read formal versions');
  assert.ok([403, 404].includes((await sibling.request(versionsPath)).status), 'Sibling unit read formal versions');
  const subordinateVersions = await leader.request(`/api/approvals/sites/${siteId}/items/${sectionTaskId}/versions`);
  assert.equal(subordinateVersions.status, 200, 'Superior could not read subordinate formal approval history');
  const reportVersions = await leader.request(`/api/approvals/sites/${siteId}/items/${approvedReportTaskId}/versions`);
  assert.equal(reportVersions.status, 200);
  assert.ok(reportVersions.body.some(value => value.objectType === 'final_report'));
  return { decisionId, riskId, mitigationId: action.body.id };
}
