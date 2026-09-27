import assert from 'node:assert/strict';

export async function testTransitionChains({ leader, sectionLeader, siteId, sectionId, sectionTwoId, suffix, executeDefault }) {
  const path = itemId => `/api/work/sites/${siteId}/items/${itemId}`;
  async function overview() {
    const result = await leader.request(`/api/work/sites/${siteId}/items/overview`);
    assert.equal(result.status, 200, `transition overview: ${JSON.stringify(result.body)}`);
    return result.body;
  }
  async function item(itemId) {
    const result = (await overview()).find(value => value.id === itemId);
    assert.ok(result, `Transition task ${itemId} disappeared`);
    return result;
  }
  async function status(itemId, next, decisionNote = null, assignedUnitId = null, expectedStatus = 204) {
    const result = await leader.put(`${path(itemId)}/status`, {
      status: next, assignedUnitId, decisionNote, priority: next === 'under_review' ? 'normal' : null,
    });
    assert.equal(result.status, expectedStatus, `${next} ${itemId}: ${JSON.stringify(result.body)}`);
    return result;
  }
  async function source(label) {
    const created = await leader.post(`/api/work/sites/${siteId}/items`, {
      title: `Synthetic ${label} ${suffix}`, description: `${label} test basis`, recommendation: null,
      referenceUrl: null, dueAt: null, workItemTypeId: null, sourceTypeId: null, senderId: null,
      targetSiteId: null, targetUnitId: null, assignedUnitId: null,
    });
    assert.equal(created.status, 201, `${label}: ${JSON.stringify(created.body)}`);
    await status(created.body.id, 'under_review');
    return created.body.id;
  }

  const decisionTaskId = await source('hold and rejection');
  await status(decisionTaskId, 'on_hold', 'Await a required decision.');
  assert.equal((await item(decisionTaskId)).status, 'on_hold');
  const unauthorizedResume = await sectionLeader.put(`${path(decisionTaskId)}/status`, {
    status: 'under_review', assignedUnitId: null, decisionNote: null, priority: null,
  });
  assert.equal(unauthorizedResume.status, 403, 'Section leader resumed top-level work');
  await status(decisionTaskId, 'under_review');
  assert.equal((await item(decisionTaskId)).status, 'under_review');
  await status(decisionTaskId, 'rejected', 'Insufficient basis.');
  assert.equal((await item(decisionTaskId)).status, 'rejected');
  await status(decisionTaskId, 'under_review');
  assert.equal((await item(decisionTaskId)).status, 'under_review');

  const returnedReportTaskId = await source('unapproved report return');
  await executeDefault(leader, returnedReportTaskId, siteId);
  assert.equal((await item(returnedReportTaskId)).status, 'in_review');
  const draft = await leader.put(`${path(returnedReportTaskId)}/final-report`, {
    content: '# Sammendrag\n\nSynthetic report requiring a correction.', classification: null,
  });
  assert.equal(draft.status, 204, `draft report: ${JSON.stringify(draft.body)}`);
  await status(returnedReportTaskId, 'in_progress', 'Correct the execution before approval.');
  const returnedReport = await item(returnedReportTaskId);
  assert.equal(returnedReport.status, 'execution', 'Returned execution did not reopen');
  assert.ok(returnedReport.finalReport?.includes('requiring a correction'), 'Draft report disappeared on return');
  assert.equal(returnedReport.finalReportApprovedAt, null);

  const approvedReportTaskId = await source('approved report protection');
  await executeDefault(leader, approvedReportTaskId, siteId);
  const written = await leader.put(`${path(approvedReportTaskId)}/final-report`, {
    content: '# Sammendrag\n\nSynthetic approved report.', classification: null,
  });
  assert.equal(written.status, 204, `approved report write: ${JSON.stringify(written.body)}`);
  const approved = await leader.post(`${path(approvedReportTaskId)}/final-report/approve`, {});
  assert.equal(approved.status, 204, `report approval: ${JSON.stringify(approved.body)}`);
  await status(approvedReportTaskId, 'in_progress', 'Attempted return after approval.', null, 409);
  assert.equal((await item(approvedReportTaskId)).status, 'in_review');
  assert.ok((await item(approvedReportTaskId)).finalReportApprovedAt, 'Rejected return removed approval');

  const reassignmentRootId = await source('reassignment and cancellation');
  await status(reassignmentRootId, 'assigned', null, sectionId);
  const initialChild = (await overview()).find(value => value.parentWorkItemId === reassignmentRootId && value.assignedUnitId === sectionId);
  assert.ok(initialChild, 'Initial section assignment missing');
  await executeDefault(sectionLeader, initialChild.id, siteId);
  const reportText = '# Sammendrag\n\nSynthetic Section 1 work before reassignment.';
  const childReport = await sectionLeader.put(`${path(initialChild.id)}/final-report`, { content: reportText, classification: null });
  assert.equal(childReport.status, 204, `section report: ${JSON.stringify(childReport.body)}`);
  const childApproval = await sectionLeader.post(`${path(initialChild.id)}/final-report/approve`, {});
  assert.equal(childApproval.status, 204, `section approval: ${JSON.stringify(childApproval.body)}`);
  const sameUnit = await leader.post(`${path(initialChild.id)}/reassign`, { assignedUnitId: sectionId });
  assert.equal(sameUnit.status, 201, `same-unit reassignment: ${JSON.stringify(sameUnit.body)}`);
  assert.notEqual(sameUnit.body.id, initialChild.id);
  assert.equal((await item(initialChild.id)).status, 'reassigned');
  const replacement = await item(sameUnit.body.id);
  assert.equal(replacement.assignedUnitId, sectionId);
  assert.equal(replacement.finalReport, reportText, 'Same-unit replacement lost report draft');
  assert.equal(replacement.finalReportApprovedAt, null, 'Old approval was incorrectly carried to replacement');
  const otherUnit = await leader.post(`${path(replacement.id)}/reassign`, { assignedUnitId: sectionTwoId });
  assert.equal(otherUnit.status, 201, `other-unit reassignment: ${JSON.stringify(otherUnit.body)}`);
  assert.equal((await item(replacement.id)).status, 'reassigned');
  assert.equal((await item(otherUnit.body.id)).assignedUnitId, sectionTwoId);
  assert.equal((await item(initialChild.id)).finalReport, reportText, 'Historical report changed after second reassignment');

  const cancelled = await leader.post(`${path(reassignmentRootId)}/cancel`, { decisionNote: 'Synthetic chain cancellation.' });
  assert.equal(cancelled.status, 200, `chain cancellation: ${JSON.stringify(cancelled.body)}`);
  assert.equal(cancelled.body.affected, 4, 'Cancellation did not include root and all three generations');
  for (const id of [reassignmentRootId, initialChild.id, replacement.id, otherUnit.body.id]) {
    assert.equal((await item(id)).status, 'cancelled', `Task ${id} retained active status after chain cancellation`);
  }
  const repeatedCancel = await leader.post(`${path(reassignmentRootId)}/cancel`, { decisionNote: 'Repeated cancellation.' });
  assert.equal(repeatedCancel.status, 409, 'Repeated cancellation was accepted');

  return { decisionTaskId, returnedReportTaskId, approvedReportTaskId, reassignmentRootId };
}
