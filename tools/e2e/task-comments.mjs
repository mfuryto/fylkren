import assert from 'node:assert/strict';

export async function testTaskComments({ leader, reader, sibling, unrelated, platform, siteId, otherSiteId, taskId, readerPersonId, base }) {
  const path = `/api/work/sites/${siteId}/items/${taskId}/comments`;
  const initial = await reader.request(path);
  assert.equal(initial.status, 200, 'An unassigned reader cannot read task comments');
  assert.equal(initial.body.total, 0);
  const text = 'This issue is already solved. Check the existing result before starting again.\n<script>alert("synthetic")</script>';
  const created = await reader.post(path, { text: `  ${text}  ` });
  assert.equal(created.status, 201, `Unassigned reader comment: ${JSON.stringify(created.body)}`);
  const listed = await leader.request(path);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.items[0].id, created.body.id);
  assert.equal(listed.body.items[0].text, text);
  assert.equal(listed.body.items[0].authorPersonId, readerPersonId);
  assert.ok(listed.body.items[0].authorName);
  assert.ok(Number.isFinite(Date.parse(listed.body.items[0].createdAt)));
  for (const account of [sibling, unrelated, platform]) {
    assert.equal((await account.request(path)).status, 403, 'A user without operational task access read comments');
    assert.equal((await account.post(path, { text: 'Unauthorized comment' })).status, 403);
  }
  assert.equal((await reader.request(`/api/work/sites/${otherSiteId}/items/${taskId}/comments`)).status, 403);
  assert.equal((await reader.post(`/api/work/sites/${otherSiteId}/items/${taskId}/comments`, { text: 'Wrong Site' })).status, 403);
  for (const invalid of [null, '', '   ', 'x'.repeat(10001)]) {
    assert.equal((await reader.post(path, { text: invalid })).status, 400, 'Invalid comment accepted');
  }
  const noCsrf = await fetch(`${base}${path}`, {
    method: 'POST', headers: { Cookie: reader.cookieHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Missing CSRF' }),
  });
  assert.equal(noCsrf.status, 400);
  for (let index = 0; index < 20; index++) {
    assert.equal((await reader.post(path, { text: `Synthetic follow-up ${index}` })).status, 201);
  }
  const first = await reader.request(path);
  const second = await reader.request(`${path}?page=2`);
  assert.equal(first.body.total, 21);
  assert.equal(first.body.items.length, 20);
  assert.equal(second.body.items.length, 1);
  assert.equal(second.body.items[0].id, created.body.id);
  assert.equal(new Set([...first.body.items, ...second.body.items].map(value => value.id)).size, 21);
  return { commentId: created.body.id, count: 21, unassignedReader: true, accessBoundaries: true, csrf: true, pagination: true };
}
