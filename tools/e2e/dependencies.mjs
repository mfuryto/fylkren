import assert from 'node:assert/strict';

export async function testDependencies({ leader, siteId, otherSiteTaskId, suffix, executeDefault }) {
  const root = `/api/work/sites/${siteId}/items`;
  async function create(label) {
    const response = await leader.post(root, {
      title: `Synthetic dependency ${label} ${suffix}`, description: `Dependency test ${label}`,
      recommendation: null, referenceUrl: null, dueAt: null, workItemTypeId: null,
      sourceTypeId: null, senderId: null, targetSiteId: null, targetUnitId: null,
      assignedUnitId: null,
    });
    assert.equal(response.status, 201, `${label}: ${JSON.stringify(response.body)}`);
    return response.body.id;
  }
  async function status(id, next, note = null) {
    return leader.put(`${root}/${id}/status`, {
      status: next, assignedUnitId: null, decisionNote: note,
      priority: next === 'under_review' ? 'normal' : null,
    });
  }
  async function summary(id) {
    const response = await leader.request(`${root}/overview`);
    assert.equal(response.status, 200);
    const item = response.body.find(value => value.id === id);
    assert.ok(item, `Task ${id} absent from overview`);
    return item;
  }
  const first = await create('first');
  const second = await create('second');
  const dependent = await create('dependent');
  for (const id of [first, second, dependent]) {
    const response = await status(id, 'under_review');
    assert.equal(response.status, 204, `Assess ${id}: ${JSON.stringify(response.body)}`);
  }
  const path = `${root}/${dependent}/dependencies`;
  const firstDependency = await leader.post(path, { predecessorWorkItemId: first, type: 'finish_to_start' });
  assert.equal(firstDependency.status, 201, `First dependency: ${JSON.stringify(firstDependency.body)}`);
  const secondDependency = await leader.post(path, { predecessorWorkItemId: second });
  assert.equal(secondDependency.status, 201, `Second dependency: ${JSON.stringify(secondDependency.body)}`);
  let item = await summary(dependent);
  assert.equal(item.isBlocked, true);
  assert.equal(item.dependencyCount, 2);
  assert.equal(item.blockingDependencyCount, 2);
  const dependencyList = await leader.request(path);
  assert.equal(dependencyList.status, 200);
  assert.equal(dependencyList.body.length, 2);
  assert.equal((await status(dependent, 'execution')).status, 409, 'Blocked task progressed through direct API');
  assert.equal((await leader.post(path, { predecessorWorkItemId: dependent })).status, 409, 'Self-dependency accepted');
  assert.equal((await leader.post(path, { predecessorWorkItemId: first })).status, 409, 'Duplicate dependency accepted');
  assert.equal((await leader.post(`${root}/${first}/dependencies`, { predecessorWorkItemId: dependent })).status, 409,
    'Cycle accepted');
  assert.ok([400, 403, 404].includes((await leader.post(path, { predecessorWorkItemId: otherSiteTaskId })).status),
    'Cross-site dependency accepted');
  const candidates = await leader.request(`${root}/${dependent}/dependency-candidates?search=dependency`);
  assert.equal(candidates.status, 200);
  assert.ok(!candidates.body.some(value => value.id === dependent || value.id === first || value.id === second),
    'Current task or existing predecessor appeared in candidates');
  const wait = await status(dependent, 'on_hold', 'Waiting for both predecessors');
  assert.equal(wait.status, 204, `Hold blocked task: ${JSON.stringify(wait.body)}`);
  async function completePredecessor(id) {
    assert.equal((await status(id, 'execution')).status, 204);
    await executeDefault(leader, id, siteId);
    assert.equal((await leader.put(`${root}/${id}/final-report`, {
    content: '# Summary\n\nSynthetic predecessor completed.', classification: null,
    })).status, 204);
    assert.equal((await leader.post(`${root}/${id}/final-report/approve`, {})).status, 204);
    assert.equal((await status(id, 'completed')).status, 204);
  }
  await completePredecessor(first);
  item = await summary(dependent);
  assert.equal(item.isBlocked, true, 'First completed predecessor prematurely released task');
  assert.equal(item.blockingDependencyCount, 1);
  assert.equal((await status(dependent, 'under_review')).status, 409);
  await completePredecessor(second);
  item = await summary(dependent);
  assert.equal(item.isBlocked, false);
  assert.equal(item.blockingDependencyCount, 0);
  assert.equal((await status(dependent, 'under_review')).status, 204);
  const removable = await create('removable');
  assert.equal((await status(removable, 'under_review')).status, 204);
  const added = await leader.post(`${root}/${removable}/dependencies`, { predecessorWorkItemId: dependent });
  assert.equal(added.status, 201);
  assert.equal((await summary(removable)).isBlocked, true);
  const removed = await leader.request(`${root}/${removable}/dependencies/${added.body.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 204);
  assert.equal((await summary(removable)).isBlocked, false);
  const planned = await create('approved-plan');
  assert.equal((await status(planned, 'under_review')).status, 204);
  assert.equal((await status(planned, 'planning')).status, 204);
  const queue = await leader.request(`/api/workflows/planning/sites/${siteId}`);
  assert.equal(queue.status, 200);
  const run = queue.body.items.find(value => value.item.id === planned);
  assert.ok(run?.id, 'Planning run missing for dependency hold test');
  assert.equal((await leader.post(`/api/workflows/planning/${run.id}/claim`, {})).status, 204);
  assert.equal((await leader.post(`/api/workflows/planning/${run.id}/submit`, {
    priority: 'normal', dueAt: null, allocations: [],
  })).status, 204);
  assert.equal((await leader.post(`/api/workflows/planning/${run.id}/decision`, {
    action: 'approve', note: null,
  })).status, 204);
  assert.equal((await summary(planned)).status, 'planning_approved');
  const planDependency = await leader.post(`${root}/${planned}/dependencies`, { predecessorWorkItemId: dependent });
  assert.equal(planDependency.status, 201);
  assert.equal((await leader.post(`/api/workflows/planning/${run.id}/decision`, {
    action: 'release', note: null,
  })).status, 409, 'Approved blocked plan was released');
  assert.equal((await leader.post(`/api/workflows/planning/${run.id}/decision`, {
    action: 'hold', note: 'Waiting for synthetic predecessor',
  })).status, 204);
  assert.equal((await status(planned, 'under_review')).status, 409,
    'Held approved plan resumed while dependency active');
  assert.equal((await leader.request(`${root}/${planned}/dependencies/${planDependency.body.id}`, {
    method: 'DELETE',
  })).status, 204);
  assert.equal((await status(planned, 'under_review')).status, 204);
  assert.equal((await summary(planned)).status, 'planning_approved');
  assert.equal((await leader.post(`/api/workflows/planning/${run.id}/decision`, {
    action: 'release', note: null,
  })).status, 204);
  return { dependencyTaskId: dependent, removedDependencyTaskId: removable, dependencyPlanTaskId: planned };
}
