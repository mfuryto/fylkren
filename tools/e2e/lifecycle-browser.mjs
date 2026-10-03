import assert from 'node:assert/strict';

export async function verifyLifecyclePresentation({ request, requestExpectingHttpError, navigate, waitFor, clickButton, setInput, setSelect, pause, siteId }) {
  const created = await request(`/api/work/sites/${siteId}/items`, 'POST', { title: 'Synthetic archive presentation', description: 'Reversible archive browser fixture' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const work = `/api/work/sites/${siteId}/items/${created.body.id}`;
  const path = `/api/information/sites/${siteId}/work-items/${created.body.id}`;
  assert.equal((await request(`${work}/status`, 'PUT', { status: 'under_review', priority: 'normal' })).status, 204);
  assert.equal((await request(`${work}/status`, 'PUT', { status: 'rejected', decisionNote: 'Synthetic closure check' })).status, 204);
  const state = await request(path);
  assert.equal(state.status, 200); assert.equal(state.body.stage, "active");
  let closed;
  for (let attempt = 0; attempt < 40; attempt++) {
    closed = await requestExpectingHttpError(`${path}/transitions`, 'POST', { stage: 'closed', expectedVersion: state.body.version, reason: 'Finished browser fixture' }, [200, 409]);
    if (closed.status === 200) break;
    assert.equal(closed.body.code, 'lifecycle_unfinished_relationships');
    await pause(250);
  }
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  const blocked = await requestExpectingHttpError(`${work}/comments`, 'POST', { text: 'Blocked browser write' }, 409);
  assert.equal(blocked.status, 409); assert.equal(blocked.body.code, 'information_locked');
  await navigate(`/#/tasks?site=${siteId}&item=${created.body.id}`);
  await waitFor('document.body.innerText.includes("Lock/Archive · Locked")', 'visible locked state');
  await clickButton('Lock/Archive · Locked');
  await waitFor('document.querySelector("[role=dialog] textarea") !== null', 'locked dialog');
  await setInput('[role=dialog] textarea', 'Preserve completed information\nFor historical reference');
  await clickButton('Archive', 'document.querySelector("[role=dialog]")');
  await waitFor('document.querySelector("[role=dialog] [role=status]")?.innerText === "Archived"', 'archived dialog state');
  await clickButton('Cancel', 'document.querySelector("[role=dialog]")');
  await waitFor('document.body.innerText.includes("Lock/Archive · Archived")', 'visible archived state');
  await clickButton('Lock/Archive · Archived');
  await setInput('[role=dialog] textarea', 'Restore for new evidence');
  await clickButton('Restore to locked', 'document.querySelector("[role=dialog]")');
  await waitFor('document.querySelector("[role=dialog] [role=status]")?.innerText === "Locked"', 'restored locked state');
  await setSelect("[role=dialog] select", "active");
  await setInput('[role=dialog] textarea', 'Resume editing for new evidence');
  await clickButton('Reopen for editing', 'document.querySelector("[role=dialog]")');
  await waitFor('document.querySelector("[role=dialog] [role=status]")?.innerText === "Active"', 'reopened active state');
  await clickButton('Cancel', 'document.querySelector("[role=dialog]")');
  await waitFor('document.body.innerText.includes("Lock/Archive · Active")', 'visible reopened state');
  assert.equal((await request(`${work}/comments`, 'POST', { text: 'Editable after reopen' })).status, 201);
}
