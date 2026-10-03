import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function testLearning({ leader, reader, sibling, unrelated, platform, siteManager, sectionLeader,
  siteId, otherSiteId, sectionId, taskId, draftIds, base, executeDefault, updateStatus }) {
  const listPath = `/api/work/learning?siteId=${siteId}&workItemId=${taskId}&view=all`;
  const list = async (account = leader, path = listPath) => {
    const result = await account.request(path);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  };
  const original = await list();
  assert.equal(original.total, 2);
  assert.deepEqual(original.items.map(value => value.number).sort(), [1, 2]);
  assert.ok(original.items.every(value => value.workReference && value.authorName && value.canManage));
  const readerList = await list(reader);
  assert.ok(readerList.items.every(value => !value.canManage), 'Reader can manage internal learning');
  const first = original.items.find(value => value.id === draftIds[0]);
  const reviewPath = `/api/work/learning/${first.id}/review`;
  const entryPath = `/api/work/learning/${first.id}/entries`;
  const commentPath = `/api/work/learning/${first.id}/comments`;
  const review = { version: first.version, status: 'in_progress', priority: 'high', actionPlan: 'Standardize this useful practice', treatmentNote: '', dueOn: '2026-11-01' };
  for (const account of [platform, siteManager]) {
    assert.equal((await account.request('/api/work/learning')).status, 403, 'Administration alone accessed internal learning');
  }
  for (const account of [platform, siteManager, sibling, unrelated]) {
    assert.equal((await account.request(entryPath)).status, 403, 'Foreign work level read internal discussion');
    assert.equal((await account.post(commentPath, { text: 'Unauthorized comment' })).status, 403);
    assert.equal((await account.put(reviewPath, review)).status, 403);
  }
  assert.equal((await reader.put(reviewPath, review)).status, 403, 'Operational member treated a point as leader');
  assert.equal((await leader.request(`/api/work/learning?siteId=${otherSiteId}`)).status, 403);
  const noCsrf = await fetch(`${base}${reviewPath}`, { method: 'PUT', headers: { Cookie: leader.cookieHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify(review) });
  assert.equal(noCsrf.status, 400);
  for (const invalid of [{ ...review, dueOn: null }, { ...review, actionPlan: '' }, { ...review, priority: 'critical' }, { ...review, status: 'implemented', treatmentNote: '' }]) {
    assert.equal((await leader.put(reviewPath, invalid)).status, 400);
  }
  const claimed = await leader.put(reviewPath, review);
  assert.equal(claimed.status, 204, JSON.stringify(claimed.body));
  assert.equal((await leader.put(reviewPath, review)).status, 409, 'Stale learning revision accepted');
  const refreshed = (await list()).items.find(value => value.id === first.id);
  assert.equal(refreshed.version, first.version + 1);
  assert.equal(refreshed.ownerName, original.items[0].authorName);
  assert.equal(refreshed.text, first.text);
  const concurrency = await Promise.all([1, 2].map(() => leader.put(reviewPath, { ...review, version: refreshed.version, treatmentNote: 'Progress recorded' })));
  assert.deepEqual(concurrency.map(value => value.status).sort(), [204, 409], 'Concurrent review lost an update');
  assert.equal((await reader.post(commentPath, { text: 'Internal follow-up <script>not HTML</script>' })).status, 201);
  assert.equal((await reader.post(commentPath, { text: ' ' })).status, 400);
  for (let index = 0; index < 20; index++) assert.equal((await reader.post(commentPath, { text: `Internal follow-up ${index}` })).status, 201);
  const entries = (await leader.request(entryPath)).body;
  const nextEntries = (await leader.request(`${entryPath}?page=2`)).body;
  assert.equal(entries.items.length, 20);
  assert.ok(nextEntries.items.length > 0);
  assert.equal(new Set([...entries.items, ...nextEntries.items].map(value => value.id)).size, entries.total);
  assert.ok([...entries.items, ...nextEntries.items].some(value => value.kind === 'review' && value.actionPlan === review.actionPlan));
  const count = async () => (await leader.request('/api/work/navigation-counts')).body.learning;
  assert.equal(await count(), 2, 'Learning count ignored points in progress');
  const close = async (point, status) => {
    const result = await leader.put(`/api/work/learning/${point.id}/review`, { ...review, version: point.version, status, treatmentNote: `Outcome recorded: ${status}` });
    assert.equal(result.status, 204, JSON.stringify(result.body));
  };
  await close((await list()).items.find(value => value.id === first.id), 'implemented');
  assert.equal(await count(), 1);
  await close((await list()).items.find(value => value.id === draftIds[1]), 'dismissed');
  assert.equal(await count(), 0);
  assert.equal((await list(leader, `/api/work/learning?siteId=${siteId}&view=active`)).total, 0);
  const closed = await list(leader, `/api/work/learning?siteId=${siteId}&view=closed`);
  assert.equal(closed.total, 2);
  const closedFirst = closed.items.find(value => value.id === first.id);
  assert.equal((await leader.put(reviewPath, { ...review, version: closedFirst.version, status: 'new', treatmentNote: closedFirst.treatmentNote })).status, 400, 'Reopening reused an old closure rationale');
  assert.equal((await leader.put(reviewPath, { ...review, version: closedFirst.version, status: 'new', treatmentNote: 'New evidence requires reconsideration' })).status, 204);
  assert.equal(await count(), 1);
  await close((await list()).items.find(value => value.id === first.id), 'implemented');

  // A superior can read completed reports without reading the subordinate's internal lessons.
  const sectionTask = await sectionLeader.post(`/api/work/sites/${siteId}/items`, {
    title: 'Synthetic private section learning', description: 'Private section feedback', recommendation: null,
    referenceUrl: null, dueAt: null, workItemTypeId: null, sourceTypeId: null, senderId: null,
    targetSiteId: null, targetUnitId: null, assignedUnitId: sectionId,
  });
  assert.equal(sectionTask.status, 201, JSON.stringify(sectionTask.body));
  await updateStatus(sectionLeader, sectionTask.body.id, 'under_review', null, 'normal');
  await updateStatus(sectionLeader, sectionTask.body.id, 'execution');
  await executeDefault(sectionLeader, sectionTask.body.id);
  const privatePoint = { id: randomUUID(), kind: 'improvement', text: 'PRIVATE_SECTION_LEARNING_SENTINEL' };
  const report = await sectionLeader.put(`/api/work/sites/${siteId}/items/${sectionTask.body.id}/final-report`, { content: 'Public completed work summary', classification: null, lessons: [privatePoint] });
  assert.equal(report.status, 204, JSON.stringify(report.body));
  assert.equal((await sectionLeader.post(`/api/work/sites/${siteId}/items/${sectionTask.body.id}/final-report/approve`, {})).status, 204);
  await updateStatus(sectionLeader, sectionTask.body.id, 'completed');
  assert.equal((await list(leader, `/api/work/learning?siteId=${siteId}&workItemId=${sectionTask.body.id}&view=all`)).total, 0);
  assert.equal((await leader.request(`/api/work/learning?siteId=${siteId}&unitId=${sectionId}`)).status, 403, 'Top-level leader accessed subordinate learning');
  assert.equal((await leader.request(`/api/work/learning/${privatePoint.id}/entries`)).status, 403);
  const versions = await leader.request(`/api/approvals/sites/${siteId}/items/${sectionTask.body.id}/versions`);
  assert.equal(versions.status, 200, JSON.stringify(versions.body));
  assert.ok(!JSON.stringify(versions.body).includes(privatePoint.text), 'Internal learning leaked into approved report versions');
  assert.equal((await leader.request(`/api/work/sites/${siteId}/reports?unitId=${sectionId}`)).status, 403, "Learning did not preserve exact-level report archive permissions");
  const reports = await sectionLeader.request(`/api/work/sites/${siteId}/reports?unitId=${sectionId}`);
  assert.equal(reports.status, 200, JSON.stringify(reports.body));
  assert.ok(!JSON.stringify(reports.body).includes(privatePoint.text), 'Internal learning leaked into the report archive');
  assert.equal(await count(), 0, 'Superior learning counter included subordinate points');
  assert.equal((await sectionLeader.request('/api/work/navigation-counts')).body.learning, 1);
  const audit = await siteManager.request(`/api/site-audit/sites/${siteId}?eventType=learning.reviewed`);
  assert.equal(audit.status, 200);
  assert.ok(audit.body.events.some(value => value.workReference === first.workReference));
  assert.ok(!JSON.stringify(audit.body).includes(first.text), 'Internal point text leaked into administrative audit');
  // An operational timeline must not become a bypass around exact-level learning access.
  const ownActivity = await leader.request(`/api/activity/sites/${siteId}?workItemId=${taskId}&eventType=learning.created&limit=50`);
  assert.equal(ownActivity.status, 200, JSON.stringify(ownActivity.body));
  assert.equal(ownActivity.body.items.length, 2, 'Repeated report save duplicated learning activity');
  assert.ok(ownActivity.body.items.every(value => draftIds.includes(value.resourceId) && value.resourceType === 'learning'));
  const visibleActivity = await leader.request(`/api/activity/sites/${siteId}?resourceType=learning&limit=50`);
  assert.equal(visibleActivity.status, 200);
  assert.ok(!JSON.stringify(visibleActivity.body).includes(privatePoint.id), 'Subordinate learning identity leaked into Site activity');
  assert.ok(!JSON.stringify(visibleActivity.body).includes(privatePoint.text), 'Private learning content leaked into activity');
  const hiddenActivity = await leader.request(`/api/activity/sites/${siteId}?workItemId=${sectionTask.body.id}&resourceType=learning&limit=1`);
  assert.ok([200, 403].includes(hiddenActivity.status));
  if (hiddenActivity.status === 200) {
    assert.deepEqual(hiddenActivity.body.items, []);
    assert.equal(hiddenActivity.body.hasMore, false, 'Hidden learning affected pagination');
    assert.equal(hiddenActivity.body.next, null);
  }
  const privateActivity = await sectionLeader.request(`/api/activity/sites/${siteId}?workItemId=${sectionTask.body.id}&eventType=learning.created`);
  assert.equal(privateActivity.status, 200);
  assert.equal(privateActivity.body.items.length, 1);
  assert.equal(privateActivity.body.items[0].resourceId, privatePoint.id);
  const commentsActivity = await leader.request(`/api/activity/sites/${siteId}?workItemId=${taskId}&eventType=learning.comment_added&limit=50`);
  assert.equal(commentsActivity.status, 200);
  assert.equal(commentsActivity.body.items.length, 21);
  assert.ok(commentsActivity.body.items.every(value => value.resourceId === first.id));
  assert.equal((await reader.request(`/api/activity/sites/${siteId}?workItemId=${taskId}&eventType=learning.comment_added`)).status, 403, 'Learning access alone granted full work activity access');
  return { learning: 'passed', learningPrivacy: 'passed', learningTreatment: 'passed', learningConcurrency: 'passed', learningHistoryPagination: 'passed' };
}
