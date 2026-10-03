import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

export async function verifyGovernanceArchive({ request, navigate, waitFor, setInput, clickButton, evaluate, assertNoOverflow, platformCredentials, pause }) {
  const suffix = randomBytes(5).toString('hex');
  const name = `Synthetic archive browser ${suffix}`, displayName = `Synthetic custodian ${suffix}`;
  const created = await request('/api/sites/', 'POST', { name, overviewDesign: 'classic' }); assert.equal(created.status, 201, JSON.stringify(created.body));
  const siteId = created.body.id;
  const username = `archive-browser-${suffix}`, password = `V8!${randomBytes(24).toString('base64url')}#x`;
  const person = await request(`/api/sites/${siteId}/access/local-users`, 'POST', { displayName, email: `${username}@example.invalid`, username, organizationUnitId: null }); assert.equal(person.status, 201, JSON.stringify(person.body));
  assert.equal((await request('/api/password-reset/complete', 'POST', { resetCode: person.body.resetCode, newPassword: password })).status, 204);
  await navigate('/#/sites');
  await waitFor(`document.body.innerText.includes(${JSON.stringify(name)})`, 'governance Site row');
  const row = `[...document.querySelectorAll('.site-tree-row')].find(row => row.innerText.includes(${JSON.stringify(name)}))`;
  await waitFor(`${row}?.innerText.includes("Lock/Archive · Active")`, 'Site information state');
  await clickButton('Lock/Archive · Active', row);
  await waitFor('document.querySelector("[role=dialog]")?.innerText.includes("Resolve these before closing")', 'explicit Site blockers');
  await evaluate('document.querySelector("[role=dialog] details").open = true');
  const details = 'document.querySelector("[role=dialog] details")';
  await setInput('[role=dialog] details input[type=search]', displayName);
  await clickButton('Search', details);
  await waitFor(`document.querySelector("[role=dialog] details")?.innerText.includes(${JSON.stringify(displayName)})`, 'custodian search by name');
  await clickButton(displayName, details);
  await setInput('[role=dialog] details textarea', 'Explicit full Site archive custody');
  await clickButton('Add', details);
  await waitFor('document.querySelector("[role=dialog] summary")?.innerText.includes("(1)")', 'custodian granted');
  await assertNoOverflow('Site archive governance dialog');
  await clickButton('Cancel', 'document.querySelector("[role=dialog]")');
  assert.equal((await request(`/api/sites/${siteId}`, 'DELETE')).status, 204);
  // Refresh the Site list after a fixture-side API change.
  await navigate('/#/platform'); await navigate('/#/sites');
  await waitFor(`${row}?.innerText.includes("Lock/Archive · Active")`, 'inactive Site lifecycle action');
  await clickButton('Lock/Archive · Active', row);
  await waitFor('document.querySelector("[role=dialog] select") !== null', 'Site closure dialog');
  await setInput('[role=dialog] > .field textarea', 'All local obligations resolved');
  await clickButton('Lock content', 'document.querySelector("[role=dialog]")');
  await waitFor('document.querySelector("[role=dialog] [role=status]")?.innerText === "Locked"', 'Site closed');
  await setInput('[role=dialog] > .field textarea', 'Preserve independently owned customer history');
  await clickButton('Archive', 'document.querySelector("[role=dialog]")');
  await waitFor('document.querySelector("[role=dialog] [role=status]")?.innerText === "Archived"', 'Site archived');
  await clickButton('Cancel', 'document.querySelector("[role=dialog]")');
  const grants = await request(`/api/information/governance/sites/${siteId}/custodians`);
  assert.ok(grants.body.some(g => g.personId === person.body.member.id && g.isActive && g.canExport), 'Custody was not assigned to the selected person');
  // Isolate the extra authentication cases from the eight-attempt/minute core fixture.
  await pause(60_000);
  const freshLogin = await evaluate(`fetch('/api/session', { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: ${JSON.stringify(JSON.stringify({ username, password }))} }).then(r => r.status)`);
  assert.equal(freshLogin, 204, 'Fresh archive-only authentication rejected current custody');
  async function signIn(account, shell) {
    assert.equal((await request('/api/session', 'DELETE')).status, 204);
    await navigate('/'); await waitFor('document.body.innerText.includes("Sign in")', 'archive sign-in form');
    await setInput('#username', account.username); await setInput('#password', account.password);
    await evaluate('document.querySelector("#password").closest("form").requestSubmit()');
    await waitFor(`document.body.innerText.includes(${JSON.stringify(shell)})`, 'archive session shell');
  }
  await signIn({ username, password }, 'Archives');
  await navigate('/#/archives');
  await waitFor(`document.body.innerText.includes(${JSON.stringify(name)}) && document.body.innerText.includes("History before this feature")`, 'read-only custodian archive');
  assert.equal((await request('/api/session')).body.hasArchiveAccess, true);
  assert.equal(await evaluate('[...document.querySelectorAll("nav a, nav button")].some(node => node.textContent.trim() === "Tasks")'), false);
  assert.equal((await request(`/api/information/archives/${siteId}/activity`)).status, 200);
  await assertNoOverflow('Read-only Site archive');
  await signIn(platformCredentials, 'Platform');
  return { siteArchiveGovernance: true, archiveCustodianSearch: true, archiveOnlyBrowserSession: true, readOnlyArchiveTimeline: true };
}
