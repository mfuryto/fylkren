import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function testCombinedBranches({ leader, sectionLeader, sectionTwoLeader, receiver, siteId, receiverSiteId, recipientInstanceId, sectionId, sectionTwoId, suffix, updateStatus }) {
  async function createSource(label) {
    const result = await leader.post(`/api/work/sites/${siteId}/items`, {
      title: `${label} ${suffix}`, description: 'One source task with several independent branches',
      recommendation: null, referenceUrl: null, dueAt: null,
      workItemTypeId: null, sourceTypeId: null, senderId: null,
      targetSiteId: null, targetUnitId: null, assignedUnitId: null,
    });
    assert.equal(result.status, 201, `${label} source: ${JSON.stringify(result.body)}`);
    await updateStatus(leader, result.body.id, 'under_review', null, 'normal', siteId);
    return result.body.id;
  }

  async function overview(account, workSiteId) {
    const result = await account.request(`/api/work/sites/${workSiteId}/items/overview`);
    assert.equal(result.status, 200, `overview ${workSiteId}: ${JSON.stringify(result.body)}`);
    return result.body;
  }

  const directSourceId = await createSource('Synthetic direct mixed branches');
  const directRequestTitle = `Synthetic direct side request ${suffix}`;
  const remoteSideRequest = await leader.post(`/api/work/sites/${siteId}/items/${directSourceId}/request`, {
    title: directRequestTitle, description: 'Must not create a local side request',
    targetSiteId: receiverSiteId, targetInstanceId: randomUUID(), targetUnitId: null,
  });
  assert.equal(remoteSideRequest.status, 409);
  assert.equal(remoteSideRequest.body.error, 'federated_recipient_not_routable');
  const directRequest = await leader.post(`/api/work/sites/${siteId}/items/${directSourceId}/request`, {
    title: directRequestTitle, description: 'External support for the same source task',
    targetSiteId: receiverSiteId, targetInstanceId: recipientInstanceId, targetUnitId: null,
  });
  assert.equal(directRequest.status, 201, `direct side request: ${JSON.stringify(directRequest.body)}`);
  await updateStatus(leader, directSourceId, 'assigned', sectionId, null, siteId);
  const directItems = await overview(leader, siteId);
  assert.equal(directItems.filter(item => item.id === directSourceId).length, 1, 'Direct source task disappeared or duplicated');
  const directBranches = directItems.filter(item => item.parentWorkItemId === directSourceId);
  assert.equal(directBranches.filter(item => item.id === directRequest.body.id && item.isOutgoingRequest).length, 1,
    'Direct side request tracking disappeared or duplicated');
  assert.equal(directBranches.filter(item => item.assignedUnitId === sectionId && !item.isOutgoingRequest).length, 1,
    'Internal delegation disappeared or duplicated after a side request');
  const directSection = await overview(sectionLeader, siteId);
  assert.equal(directSection.filter(item => item.parentWorkItemId === directSourceId && item.assignedUnitId === sectionId).length, 1);
  const directReceiver = await overview(receiver, receiverSiteId);
  assert.equal(directReceiver.filter(item => item.title === directRequestTitle).length, 1,
    'Direct side request did not reach exactly one recipient task');

  const plannedSourceId = await createSource('Synthetic planned mixed branches');
  await updateStatus(leader, plannedSourceId, 'planning', null, null, siteId);
  const queue = await leader.request(`/api/workflows/planning/sites/${siteId}`);
  assert.equal(queue.status, 200, `planning queue: ${JSON.stringify(queue.body)}`);
  const run = queue.body.items.find(item => item.item.id === plannedSourceId);
  assert.ok(run, 'Combined-branch planning run missing');
  const allocationStep = run.steps.find(step => step.allowsTaskAllocation);
  assert.ok(allocationStep, 'Planning workflow has no allocation step');
  const claimed = await leader.post(`/api/workflows/planning/${run.id}/claim`, {});
  assert.equal(claimed.status, 204, `planning claim: ${JSON.stringify(claimed.body)}`);
  const rfiCreated = await leader.post(`/api/workflows/planning/${run.id}/rfi`, {});
  assert.equal(rfiCreated.status, 201, `RFI creation: ${JSON.stringify(rfiCreated.body)}`);
  const rfiId = rfiCreated.body.id;
  const rfiQuestion = 'Who can deliver the tank vehicle?\nConfirm capacity and timing.';
  const rfiSaved = await leader.put(`/api/workflows/planning/${run.id}/rfi/${rfiId}`, {
    who: 'Support coordination', what: rfiQuestion, dueOn: '2026-10-15', answered: false, answer: '',
  });
  assert.equal(rfiSaved.status, 204, `RFI save: ${JSON.stringify(rfiSaved.body)}`);
  const rfiRead = await leader.request(`/api/workflows/planning/${run.id}/rfi`);
  assert.equal(rfiRead.status, 200);
  assert.equal(rfiRead.body.find(entry => entry.id === rfiId)?.what, rfiQuestion);
  const rfiForeignRead = await receiver.request(`/api/workflows/planning/${run.id}/rfi`);
  assert.equal(rfiForeignRead.status, 403, 'Another site could read the planning RFI log');

  const sectionInstruction = '1. Bring equipment.\n2. Complete the assigned work.\n3. Coordinate with Section 2.';
  const sectionTwoInstruction = '1. Support Section 1.\n2. Record the result.';
  const requestInstruction = 'Provide specialist support for the approved plan.';
  const allocations = [
    { stepId: allocationStep.id, unitId: sectionId, instruction: sectionInstruction },
    { stepId: allocationStep.id, unitId: sectionTwoId, instruction: sectionTwoInstruction },
  ];
  const remotePlanRequest = await leader.post(`/api/workflows/planning/${run.id}/requests`, {
    stepId: allocationStep.id, targetSiteId: receiverSiteId,
    targetInstanceId: randomUUID(), instruction: requestInstruction,
  });
  assert.equal(remotePlanRequest.status, 409);
  assert.equal(remotePlanRequest.body.error, 'federated_recipient_not_routable');
  const plannedRequest = await leader.post(`/api/workflows/planning/${run.id}/requests`, {
    stepId: allocationStep.id, targetSiteId: receiverSiteId,
    targetInstanceId: recipientInstanceId, instruction: requestInstruction,
  });
  assert.equal(plannedRequest.status, 201, `planned request: ${JSON.stringify(plannedRequest.body)}`);
  async function submit() {
    const result = await leader.post(`/api/workflows/planning/${run.id}/submit`, {
      priority: 'normal', dueAt: null, allocations,
    });
    assert.equal(result.status, 204, `combined plan submit: ${JSON.stringify(result.body)}`);
  }
  await submit();

  const beforeApproval = await overview(leader, siteId);
  assert.equal(beforeApproval.filter(item => item.parentWorkItemId === plannedSourceId).length, 0,
    'Submitting a plan prematurely created a recipient branch');
  const returned = await leader.post(`/api/workflows/planning/${run.id}/decision`, {
    action: 'replan', note: 'Clarify the division of work before approval.',
  });
  assert.equal(returned.status, 204, `plan return: ${JSON.stringify(returned.body)}`);
  const returnedQueue = await leader.request(`/api/workflows/planning/sites/${siteId}`);
  const returnedRun = returnedQueue.body.items.find(item => item.id === run.id);
  assert.ok(returnedRun, 'Returned plan missing from queue');
  assert.equal(returnedRun.status, 'in_progress');
  assert.deepEqual(returnedRun.allocations.map(item => [item.unitId, item.instruction]).sort(),
    allocations.map(item => [item.unitId, item.instruction]).sort(), 'Returned plan lost multiline allocations');
  assert.equal(returnedRun.requests.find(item => item.id === plannedRequest.body.id)?.instruction, requestInstruction,
    'Returned plan lost its side request');
  assert.equal(returnedRun.rfi.find(entry => entry.id === rfiId)?.what, rfiQuestion,
    'Returned plan lost its RFI log');
  const rfiAnswered = await leader.put(`/api/workflows/planning/${run.id}/rfi/${rfiId}`, {
    who: 'Support coordination', what: rfiQuestion, dueOn: '2026-10-15', answered: true,
    answer: 'One tank vehicle is available.',
  });
  assert.equal(rfiAnswered.status, 204, `RFI answer: ${JSON.stringify(rfiAnswered.body)}`);
  await submit();
  const approved = await leader.post(`/api/workflows/planning/${run.id}/decision`, { action: 'approve', note: null });
  assert.equal(approved.status, 204, `plan approval: ${JSON.stringify(approved.body)}`);
  const approvedPlan = await leader.request(`/api/work/sites/${siteId}/items/${plannedSourceId}/details`);
  assert.equal(approvedPlan.status, 200);
  assert.equal(approvedPlan.body.plan.rfi.find(entry => entry.id === rfiId)?.answer, 'One tank vehicle is available.');
  const lateEdit = await leader.put(`/api/workflows/planning/${run.id}/rfi/${rfiId}`, {
    who: 'Support coordination', what: rfiQuestion, dueOn: '2026-10-15', answered: false, answer: '',
  });
  assert.equal(lateEdit.status, 403, 'An approved planning RFI was editable');
  const beforeRelease = await overview(leader, siteId);
  assert.equal(beforeRelease.filter(item => item.parentWorkItemId === plannedSourceId).length, 0,
    'Approval created recipient branches before release');
  const held = await leader.post(`/api/workflows/planning/${run.id}/decision`, {
    action: 'hold', note: 'Await coordinated release.',
  });
  assert.equal(held.status, 204, `approved plan hold: ${JSON.stringify(held.body)}`);
  await updateStatus(leader, plannedSourceId, 'under_review', null, null, siteId);
  const afterResume = await overview(leader, siteId);
  assert.equal(afterResume.find(item => item.id === plannedSourceId)?.status, 'planning_approved');
  assert.equal(afterResume.filter(item => item.parentWorkItemId === plannedSourceId).length, 0,
    'Resuming an approved plan prematurely created recipient branches');

  const released = await leader.post(`/api/workflows/planning/${run.id}/decision`, { action: 'release', note: null });
  assert.equal(released.status, 204, `combined plan release: ${JSON.stringify(released.body)}`);
  const releasedItems = await overview(leader, siteId);
  const plannedSource = releasedItems.find(item => item.id === plannedSourceId);
  assert.equal(plannedSource?.status, 'in_progress', 'Source task did not remain active after distribution');
  const releasedBranches = releasedItems.filter(item => item.parentWorkItemId === plannedSourceId);
  assert.equal(releasedBranches.length, 3, 'Release did not create exactly two internal delegations and one side request');
  assert.equal(releasedBranches.filter(item => item.assignedUnitId === sectionId && item.description === sectionInstruction).length, 1,
    'Section 1 did not receive its own multiline instruction list');
  assert.equal(releasedBranches.filter(item => item.assignedUnitId === sectionTwoId && item.description === sectionTwoInstruction).length, 1,
    'Section 2 did not receive its own multiline instruction list');
  const requestTracking = releasedBranches.find(item => item.isOutgoingRequest);
  assert.ok(requestTracking, 'Planned side request tracking missing');
  assert.equal(requestTracking.description, requestInstruction);
  const sectionTwoItems = await overview(sectionTwoLeader, siteId);
  assert.equal(sectionTwoItems.filter(item => item.parentWorkItemId === plannedSourceId && item.description === sectionTwoInstruction).length, 1);
  const receiverItems = await overview(receiver, receiverSiteId);
  const receivedRequest = receiverItems.filter(item =>
    item.title === plannedSource.title && item.description === requestInstruction);
  assert.equal(receivedRequest.length, 1, 'Planned request did not create exactly one receiver task');
  assert.equal(receivedRequest[0].description, requestInstruction);
  assert.equal(receivedRequest[0].parentWorkItemId, null,
    'Receiver view exposed the sending site\'s internal request-tracking ID');
  assert.ok(receivedRequest[0].requestBasisSnapshot?.includes('Godkjent plan'),
    'Planned request did not carry the approved plan as context');
  const repeatedRelease = await leader.post(`/api/workflows/planning/${run.id}/decision`, { action: 'release', note: null });
  assert.ok(repeatedRelease.status === 404 || repeatedRelease.status === 409,
    `Repeated plan release was accepted: ${JSON.stringify(repeatedRelease.body)}`);
  const afterRepeat = await overview(leader, siteId);
  assert.equal(afterRepeat.filter(item => item.parentWorkItemId === plannedSourceId).length, 3,
    'Repeated release duplicated recipient branches');

  return { directSourceId, plannedSourceId };
}
