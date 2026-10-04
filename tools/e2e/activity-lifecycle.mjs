import assert from 'node:assert/strict';
export async function testActivityLifecycle({ leader, manager, sibling, unrelated, platform, siteManager, siteId, otherSiteId, taskId, base, suffix }) {
  const activity = `/api/activity/sites/${siteId}`;
  const object = `${activity}?workItemId=${taskId}`;
  const initial = await leader.request(object); assert.equal(initial.status, 200, JSON.stringify(initial.body));
  assert.ok(initial.body.items.length > 0);
  const completion = await leader.request(`${object}&eventType=assignment.completed`);
  assert.equal(completion.status, 200); assert.ok(completion.body.items.length > 0, 'Completion disappeared from recorded history');
  assert.ok(initial.body.items.every(x => !('payloadJson' in x) && !('activityMetadataJson' in x)));
  for (const account of [sibling, unrelated, platform, siteManager]) assert.equal((await account.request(object)).status, 403);
  assert.equal((await leader.request(`/api/activity/sites/${otherSiteId}?workItemId=${taskId}`)).status, 403);
  for (const query of ['limit=0', 'limit=51', 'eventType=security.secret', 'resourceType=password', 'before=2026-10-02T00:00:00Z', 'from=2026-10-03T00:00:00Z&until=2026-10-02T00:00:00Z'])
    assert.equal((await leader.request(`${activity}?${query}`)).status, 400, query);
  const filtered = await leader.request(`${object}&eventType=task.created`); assert.equal(filtered.status, 200); assert.equal(filtered.body.items.length, 1); assert.ok(filtered.body.items.every(x => x.type === 'task.created'));
  const boundary = filtered.body.items[0].occurredAt;
  const exclusive = await leader.request(`${object}&eventType=task.created&until=${encodeURIComponent(boundary)}`);
  assert.equal(exclusive.status, 200); assert.equal(exclusive.body.items.length, 0, 'Timeline until boundary must be exclusive');
  const inclusive = await leader.request(`${object}&eventType=task.created&from=${encodeURIComponent(boundary)}`);
  assert.equal(inclusive.status, 200); assert.equal(inclusive.body.items.length, 1, 'Timeline from boundary must be inclusive');
  const first = await leader.request(`${activity}?limit=2`); assert.equal(first.status, 200); assert.equal(first.body.items.length, 2); assert.equal(first.body.hasMore, true);
  const next = await leader.request(`${activity}?limit=2&before=${encodeURIComponent(first.body.next.before)}&beforeId=${first.body.next.beforeId}`); assert.equal(next.status, 200);
  assert.ok(next.body.items.every(x => !first.body.items.some(y => x.id === y.id)));
  const none = await leader.request(`${object}&from=2100-01-01T00:00:00Z`); assert.equal(none.status, 200); assert.equal(none.body.items.length, 0);
  const saved = await siteManager.request(`/api/site-notifications/sites/${siteId}`); assert.equal(saved.status, 200);
  assert.equal((await siteManager.put(`/api/site-notifications/sites/${siteId}`, { newWorkItems: false, workItemChanges: false, decisionsRequired: false, childWorkCompleted: false, planningCompleted: false, executionCompleted: false })).status, 204);
  try {
    const created = await leader.post(`/api/work/sites/${siteId}/items`, { title: `Synthetic lifecycle ${suffix}`, description: 'Internal archive fixture' }); assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.id, work = `/api/work/sites/${siteId}/items/${id}`, path = `/api/information/sites/${siteId}/work-items/${id}`;
    const managerState = await manager.request(path); assert.equal(managerState.status, 200, 'An authorized non-author manager could not read lifecycle state');
    let state = (await leader.request(path)).body; assert.equal(state.stage, 'active'); assert.equal(state.irreversibleEnabled, false);
    const move = (stage, expectedVersion = state.version) => leader.post(`${path}/transitions`, { stage, expectedVersion, reason: 'Synthetic disposition rationale' });
    assert.equal((await move('closed')).status, 409, 'Active unfinished work was closed');
    assert.equal((await move('deleted')).status, 400); assert.equal((await move('anonymised')).status, 400); assert.equal((await move('retention')).status, 400);
    const noCsrf = await fetch(`${base}${path}/transitions`, { method: 'POST', headers: { Cookie: leader.cookieHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'closed', expectedVersion: state.version, reason: 'Missing CSRF' }) }); assert.equal(noCsrf.status, 400);
    assert.equal((await platform.request(path)).status, 403); assert.equal((await sibling.post(`${path}/transitions`, { stage: 'closed', expectedVersion: state.version, reason: 'Wrong authority' })).status, 403);
    assert.equal((await leader.put(`${work}/status`, { status: 'under_review', priority: 'normal' })).status, 204);
    const decisionBody = { title: 'Archive guard decision', decision: 'Reject this synthetic work', rationale: 'Check the locked decision revision guard', status: 'recorded', references: [] };
    const decision = await leader.post(`/api/decisions/sites/${siteId}/tasks/${id}`, decisionBody); assert.equal(decision.status, 201, JSON.stringify(decision.body));
    assert.equal((await leader.put(`${work}/status`, { status: 'rejected', decisionNote: 'Synthetic terminal decision' })).status, 204);
    state = (await leader.request(path)).body;
    assert.ok(['closed', 'archived'].includes(state.stage), 'Terminal rejection did not lock automatically');
    const automaticHistory = (await leader.request(`${activity}?workItemId=${id}&eventType=information.closed`)).body;
    assert.equal(automaticHistory.items.length, 1);
    assert.equal(automaticHistory.items[0].source, 'system');
    // Preserve manual transition contract coverage after an explicit editing pause.
    const editable = await move('active'); assert.equal(editable.status, 200, JSON.stringify(editable.body)); state = editable.body;
    assert.equal(state.automationPaused, true);
    const closed = await move('closed'); assert.equal(closed.status, 200, JSON.stringify(closed.body)); state = closed.body;
    assert.equal((await move('archived', state.version - 1)).status, 409);
    const blockedComment = await leader.post(`${work}/comments`, { text: 'Forbidden closed write' });
    assert.equal(blockedComment.status, 409); assert.equal(blockedComment.body.code, 'information_locked');
    const blockedDecision = await leader.put(`/api/decisions/${decision.body.id}`, { ...decisionBody, expectedRevision: 1 });
    assert.equal(blockedDecision.status, 409); assert.equal(blockedDecision.body.code, 'information_locked', 'Decision handling masked the archive guard');
    let archived = await move('archived');
    if (archived.status === 409) { state = (await leader.request(path)).body; assert.equal(state.stage, 'archived'); }
    else { assert.equal(archived.status, 200, JSON.stringify(archived.body)); state = archived.body; }
    const blockedStatus = await leader.put(`${work}/status`, { status: 'under_review', priority: 'normal' });
    assert.equal(blockedStatus.status, 409); assert.equal(blockedStatus.body.code, 'information_locked');
    const history = await leader.request(`${activity}?workItemId=${id}`); assert.equal(history.status, 200); assert.ok(history.body.items.some(x => x.type === 'information.archived'));
    const restore = await move('closed'); assert.equal(restore.status, 200); state = restore.body;
    const reopen = await move('active'); assert.equal(reopen.status, 200); state = reopen.body;
    const comment = await leader.post(`${work}/comments`, { text: 'Restored editable information' }); assert.equal(comment.status, 201);
    const commentHistory = await leader.request(`${activity}?workItemId=${id}&eventType=comment.created`);
    assert.equal(commentHistory.status, 200); assert.equal(commentHistory.body.items.length, 1, 'Blocked closed comment created activity');
    assert.equal(commentHistory.body.items[0].resourceId, comment.body.id);
    assert.ok(!JSON.stringify(commentHistory.body).includes('Restored editable information'));
    assert.equal((await leader.put(`${work}/status`, { status: 'under_review', priority: 'normal' })).status, 204);
  } finally { assert.equal((await siteManager.put(`/api/site-notifications/sites/${siteId}`, saved.body)).status, 204); }
  return { activityTimeline: 'passed', informationArchive: 'passed', activityAccessBoundaries: 'passed' };
}
