import assert from 'node:assert/strict';
export async function testActivityLifecycle({ leader, sibling, unrelated, platform, siteManager, siteId, otherSiteId, taskId, base, suffix }) {
  const activity = `/api/activity/sites/${siteId}`;
  const object = `${activity}?workItemId=${taskId}`;
  const initial = await leader.request(object); assert.equal(initial.status, 200, JSON.stringify(initial.body));
  assert.ok(initial.body.items.length > 0);
  assert.ok(initial.body.items.some(x => x.type === 'assignment.completed'));
  assert.ok(initial.body.items.every(x => !('payloadJson' in x) && !('activityMetadataJson' in x)));
  for (const account of [sibling, unrelated, platform, siteManager]) assert.equal((await account.request(object)).status, 403);
  assert.equal((await leader.request(`/api/activity/sites/${otherSiteId}?workItemId=${taskId}`)).status, 403);
  for (const query of ['limit=0', 'limit=51', 'eventType=security.secret', 'resourceType=password', 'before=2026-10-02T00:00:00Z', 'from=2026-10-03T00:00:00Z&until=2026-10-02T00:00:00Z'])
    assert.equal((await leader.request(`${activity}?${query}`)).status, 400, query);
  const filtered = await leader.request(`${object}&eventType=task.created`); assert.equal(filtered.status, 200); assert.equal(filtered.body.items.length, 1); assert.ok(filtered.body.items.every(x => x.type === 'task.created'));
  const first = await leader.request(`${activity}?limit=2`); assert.equal(first.status, 200); assert.equal(first.body.items.length, 2); assert.equal(first.body.hasMore, true);
  const next = await leader.request(`${activity}?limit=2&before=${encodeURIComponent(first.body.next.before)}&beforeId=${first.body.next.beforeId}`); assert.equal(next.status, 200);
  assert.ok(next.body.items.every(x => !first.body.items.some(y => x.id === y.id)));
  const none = await leader.request(`${object}&from=2100-01-01T00:00:00Z`); assert.equal(none.status, 200); assert.equal(none.body.items.length, 0);
  const saved = await siteManager.request(`/api/site-notifications/sites/${siteId}`); assert.equal(saved.status, 200);
  assert.equal((await siteManager.put(`/api/site-notifications/sites/${siteId}`, { newWorkItems: false, workItemChanges: false, decisionsRequired: false, childWorkCompleted: false, planningCompleted: false, executionCompleted: false })).status, 204);
  try {
    const created = await leader.post(`/api/work/sites/${siteId}/items`, { title: `Synthetic lifecycle ${suffix}`, description: 'Internal archive fixture' }); assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.id, work = `/api/work/sites/${siteId}/items/${id}`, path = `/api/information/sites/${siteId}/work-items/${id}`;
    let state = (await leader.request(path)).body; assert.equal(state.stage, 'active'); assert.equal(state.irreversibleEnabled, false);
    const move = (stage, expectedVersion = state.version) => leader.post(`${path}/transitions`, { stage, expectedVersion, reason: 'Synthetic disposition rationale' });
    assert.equal((await move('closed')).status, 409, 'Active unfinished work was closed');
    assert.equal((await move('deleted')).status, 400); assert.equal((await move('anonymised')).status, 400); assert.equal((await move('retention')).status, 400);
    const noCsrf = await fetch(`${base}${path}/transitions`, { method: 'POST', headers: { Cookie: leader.cookieHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'closed', expectedVersion: state.version, reason: 'Missing CSRF' }) }); assert.equal(noCsrf.status, 400);
    assert.equal((await platform.request(path)).status, 403); assert.equal((await sibling.post(`${path}/transitions`, { stage: 'closed', expectedVersion: state.version, reason: 'Wrong authority' })).status, 403);
    assert.equal((await leader.put(`${work}/status`, { status: 'under_review', priority: 'normal' })).status, 204);
    assert.equal((await leader.put(`${work}/status`, { status: 'rejected', decisionNote: 'Synthetic terminal decision' })).status, 204);
    const closed = await move('closed'); assert.equal(closed.status, 200, JSON.stringify(closed.body)); state = closed.body;
    assert.equal((await move('archived', state.version - 1)).status, 409);
    assert.equal((await leader.post(`${work}/comments`, { text: 'Forbidden closed write' })).status, 409);
    const archived = await move('archived'); assert.equal(archived.status, 200, JSON.stringify(archived.body)); state = archived.body;
    assert.equal((await leader.put(`${work}/status`, { status: 'under_review', priority: 'normal' })).status, 409);
    const history = await leader.request(`${activity}?workItemId=${id}`); assert.equal(history.status, 200); assert.ok(history.body.items.some(x => x.type === 'information.archived'));
    const restore = await move('closed'); assert.equal(restore.status, 200); state = restore.body;
    const reopen = await move('active'); assert.equal(reopen.status, 200); state = reopen.body;
    assert.equal((await leader.post(`${work}/comments`, { text: 'Restored editable information' })).status, 201);
    assert.equal((await leader.put(`${work}/status`, { status: 'under_review', priority: 'normal' })).status, 204);
  } finally { assert.equal((await siteManager.put(`/api/site-notifications/sites/${siteId}`, saved.body)).status, 204); }
  return { activityTimeline: 'passed', informationArchive: 'passed', activityAccessBoundaries: 'passed' };
}
