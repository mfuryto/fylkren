import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

export async function createLocalLeader({
  request, siteId, roleId, suffix, key, displayName, siteManager = false,
}) {
  const username = `browser-${key}-${suffix}`;
  const password = `V8!${randomBytes(24).toString('base64url')}#x`;
  const created = await request(`/api/sites/${siteId}/access/local-users`, 'POST', {
    displayName, email: `${username}@example.invalid`, username, organizationUnitId: null,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  if (siteManager) {
    const manager = await request(`/api/sites/${siteId}/site-managers`, 'POST', {
      personId: created.body.member.id,
    });
    assert.equal(manager.status, 201, JSON.stringify(manager.body));
  }
  const assignment = await request(`/api/sites/${siteId}/access/role-assignments`, 'POST', {
    roleId, personId: created.body.member.id,
    validFrom: new Date(Date.now() - 60_000).toISOString(), validTo: null,
    canLeadParentLevel: false,
  });
  assert.equal(assignment.status, 201, JSON.stringify(assignment.body));
  const reset = await request('/api/password-reset/complete', 'POST', {
    resetCode: created.body.resetCode, newPassword: password,
  });
  assert.equal(reset.status, 204, JSON.stringify(reset.body));
  return { username, password, displayName, personId: created.body.member.id };
}

export async function signInLocalActor({
  request, navigate, waitFor, setInput, evaluate, actor,
}) {
  const logout = await request('/api/session', 'DELETE');
  assert.equal(logout.status, 204, JSON.stringify(logout.body));
  await navigate('/');
  await waitFor('document.body.innerText.includes("Logg inn")', `${actor.displayName} login`);
  await setInput('#username', actor.username);
  await setInput('#password', actor.password);
  await evaluate('document.querySelector("#password").closest("form").requestSubmit()');
  await waitFor(`document.body.innerText.includes("Oppgaver") &&
    document.body.innerText.includes("Synthetic Browser Site")`, `${actor.displayName} shell`);
  const session = await request('/api/session');
  assert.equal(session.status, 200, JSON.stringify(session.body));
  assert.equal(session.body.displayName, actor.displayName, JSON.stringify(session.body));
}
