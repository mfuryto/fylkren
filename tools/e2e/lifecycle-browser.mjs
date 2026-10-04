import assert from 'node:assert/strict';

export async function verifyLifecyclePresentation({ request, requestExpectingHttpError, navigate, waitFor, clickButton, setInput, pause, evaluate, siteId }) {
  const created = await request(`/api/work/sites/${siteId}/items`, 'POST', { title: 'Synthetic archive presentation', description: 'Reversible archive browser fixture' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const work = `/api/work/sites/${siteId}/items/${created.body.id}`;
  const path = `/api/information/sites/${siteId}/work-items/${created.body.id}`;
  assert.equal((await request(`${work}/status`, 'PUT', { status: 'under_review', priority: 'normal' })).status, 204);
  assert.equal((await request(`${work}/status`, 'PUT', { status: 'rejected', decisionNote: 'Synthetic closure check' })).status, 204);
  let state = await request(path);
  assert.equal(state.status, 200); assert.ok(['closed', 'archived'].includes(state.body.stage));
  const blocked = await requestExpectingHttpError(`${work}/comments`, 'POST', { text: 'Blocked browser write' }, 409);
  assert.equal(blocked.status, 409); assert.equal(blocked.body.code, 'information_locked');
  for (let attempt = 0; attempt < 80 && state.body.stage !== 'archived'; attempt++) { await pause(250); state = await request(path); }
  assert.equal(state.body.stage, 'archived', JSON.stringify(state.body));
  const archiveList = await request(`/api/work/sites/${siteId}/items?filter=archived&search=Synthetic%20archive%20presentation`);
  assert.equal(archiveList.status, 200); assert.ok(archiveList.body.items.some(item => item.id === created.body.id), 'Archive filter lost the task');
  await navigate(`/#/tasks?site=${siteId}&item=${created.body.id}`);
  await waitFor("document.querySelector('button[aria-label=\"Lock/Archive: Archived\"] svg[data-stage=\"archived\"]') !== null", 'visible automatic archive state');
  await clickButton('Lock/Archive');
  await waitFor('document.querySelector("[role=dialog] textarea") !== null', 'reopen dialog');
  assert.equal(await request(path).then(value => value.body.stage), 'archived');
  assert.equal(await evaluate(`(() => {
    const dialog = document.querySelector('[role=dialog]');
    return [...dialog.querySelectorAll('select, textarea')].every(control => {
      const label = dialog.querySelector('label[for="' + control.id + '"]');
      return label && control.getBoundingClientRect().top >= label.getBoundingClientRect().bottom;
    });
  })()`), true, 'Reopening controls share a row with their labels');
  await setInput('[role=dialog] textarea', 'Resume editing for new evidence\nPreserve original history');
  await clickButton('Reopen for editing', 'document.querySelector("[role=dialog]")');
  await waitFor('document.querySelector("[role=dialog] [role=status]")?.innerText === "Active"', 'reopened active state');
  await waitFor('document.querySelector("[role=dialog]")?.innerText.includes("paused")', 'explicit editing pause');
  assert.equal((await request(`${work}/comments`, 'POST', { text: 'Editable after reopen' })).status, 201);
  await pause(5500);
  state = await request(path); assert.equal(state.body.stage, 'active'); assert.equal(state.body.automationPaused, true);
  await setInput('[role=dialog] textarea', 'Editing completed');
  await clickButton('Finish editing', 'document.querySelector("[role=dialog]")');
  await waitFor('document.querySelector("[role=dialog] [role=status]")?.innerText === "Archived"', 'automatic archive after editing');
  await clickButton('Cancel', 'document.querySelector("[role=dialog]")');
  await waitFor("document.querySelector('button[aria-label=\"Lock/Archive: Archived\"] svg[data-stage=\"archived\"]') !== null", 'visible archived state after editing');
}
