import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFileSync, rmSync } from 'node:fs';

export async function verifyGovernanceArchive({ request, navigate, waitFor, setInput, clickButton, evaluate, assertNoOverflow, platformCredentials, pause, call }) {
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
  const preservation = 'document.querySelector("[role=dialog] .preservation-controls")';
  await evaluate(`${preservation}.open = true`);
  await setInput('[role=dialog] .preservation-controls > div > .field textarea', 'Preserve evidence until review');
  await waitFor(`${preservation}?.querySelector('button')?.disabled === false`, 'loaded preservation controls with a reason');
  await clickButton('Add · Preservation hold', preservation);
  await waitFor('document.querySelector("[role=dialog]")?.innerText.includes("A preservation hold blocks this change") || document.querySelector("[role=dialog] > .field textarea")?.disabled', 'held lifecycle action');
  assert.equal(await evaluate('document.querySelector("[role=dialog] > .field textarea").disabled'), true);
  await setInput('[role=dialog] .preservation-controls > div > .field textarea', 'Review completed, release this hold');
  await waitFor(`[...${preservation}.querySelectorAll('button')].some(b => b.textContent.trim() === 'Release hold' && !b.disabled)`, 'hold release reason');
  await clickButton('Release hold', preservation);
  await waitFor('document.querySelector("[role=dialog] > .field textarea")?.disabled === false', 'hold release restores eligible lifecycle action');
  await assertNoOverflow('Preservation controls');
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
  const packagePath = `output/pdf/archive-handoff-${suffix}.zip`;
  const bytes = await evaluate(`(async () => {
    const token = await (await fetch('/api/security/antiforgery')).json();
    const response = await fetch('/api/portability/sites/${siteId}/export', { method: 'POST', headers: { 'X-Fylkren-CSRF': token.token } });
    if (!response.ok) throw new Error('Archive export failed: ' + response.status);
    return Array.from(new Uint8Array(await response.arrayBuffer()));
  })()`);
  writeFileSync(packagePath, Buffer.from(bytes));
  try {
    await evaluate(`[...document.querySelectorAll('details')].find(d => d.querySelector('summary')?.textContent === 'Confirm export custody').open = true`);
    await waitFor('document.querySelector("input[type=file]") !== null', 'recorded export custody controls');
    const document = await call('DOM.getDocument');
    const fileNode = await call('DOM.querySelector', { nodeId: document.root.nodeId, selector: 'input[type=file]' });
    await call('DOM.setFileInputFiles', { nodeId: fileNode.nodeId, files: [`/work/${packagePath}`] });
    const handoff = `[...document.querySelectorAll('details')].find(d => d.querySelector('summary')?.textContent === 'Confirm export custody')`;
    await setInput('details textarea', 'Synthetic customer verified the saved ZIP');
    await waitFor(`${handoff}?.querySelector('button')?.disabled === false`, 'matching saved export and custody rationale');
    await clickButton('Confirm export custody', handoff);
    await waitFor('document.body.innerText.includes("Export custody confirmed.")', 'browser digest-matched custody acknowledgement');
    assert.equal((await request(`/api/portability/sites/${siteId}/exit`)).body.handoffAcknowledged, true);
  } finally { rmSync(packagePath, { force: true }); }

  await signIn(platformCredentials, 'Platform');
  return { siteArchiveGovernance: true, archiveCustodianSearch: true, archiveOnlyBrowserSession: true, readOnlyArchiveTimeline: true, savedExportCustodyBrowser: true };
}
