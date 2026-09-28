import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

async function sessionFromCookie(base, cookie) {
  const response = await fetch(`${base}/api/session`, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function postAnonymous(base, path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: response.status, body: parsed };
}

export async function testIdentitySessionLifecycle({
  base, platform, siteManager, siteId, makeUser, client,
}) {
  const actor = await makeUser('security-lifecycle');
  const parallelSession = client();
  const parallelLogin = await parallelSession.post('/api/session', {
    username: actor.username,
    password: actor.password,
  });
  assert.equal(parallelLogin.status, 204, JSON.stringify(parallelLogin.body));
  const parallelCookie = parallelSession.cookieHeader();

  const changedPassword = `V9!${randomBytes(24).toString('base64url')}#p`;
  const passwordChange = await actor.account.put('/api/profile/password', {
    currentPassword: actor.password,
    newPassword: changedPassword,
  });
  assert.equal(passwordChange.status, 204, JSON.stringify(passwordChange.body));
  assert.equal((await sessionFromCookie(base, parallelCookie)).authenticated, false,
    'Password change must immediately invalidate another active session');

  const resetStarted = await siteManager.post(`/api/sites/${siteId}/access/members/${actor.personId}/password-reset`, {});
  assert.equal(resetStarted.status, 200, JSON.stringify(resetStarted.body));
  const preResetCookie = actor.account.cookieHeader();
  const resetPassword = `V9!${randomBytes(24).toString('base64url')}#r`;
  const resetAttempts = await Promise.all([
    postAnonymous(base, '/api/password-reset/complete', {
      resetCode: resetStarted.body.resetCode, newPassword: resetPassword,
    }),
    postAnonymous(base, '/api/password-reset/complete', {
      resetCode: resetStarted.body.resetCode, newPassword: resetPassword,
    }),
  ]);
  assert.deepEqual(resetAttempts.map(value => value.status).sort((a, b) => a - b), [204, 400],
    `Exactly one concurrent reset must succeed: ${JSON.stringify(resetAttempts)}`);
  assert.equal((await sessionFromCookie(base, preResetCookie)).authenticated, false,
    'Password reset must immediately invalidate an active session');

  const activeAfterReset = client();
  const resetLogin = await activeAfterReset.post('/api/session', {
    username: actor.username,
    password: resetPassword,
  });
  assert.equal(resetLogin.status, 204, JSON.stringify(resetLogin.body));
  const cookieBeforeDeactivation = activeAfterReset.cookieHeader();

  const deactivated = await siteManager.request(`/api/sites/${siteId}/access/members/${actor.personId}`, {
    method: 'DELETE',
  });
  assert.equal(deactivated.status, 204, JSON.stringify(deactivated.body));
  assert.equal((await sessionFromCookie(base, cookieBeforeDeactivation)).authenticated, false,
    'Account deactivation must immediately invalidate an active session');

  const reactivated = await platform.post('/api/platform/identity/users/assign', {
    personIds: [actor.personId], siteId,
  });
  assert.equal(reactivated.status, 200, JSON.stringify(reactivated.body));
  assert.equal((await sessionFromCookie(base, cookieBeforeDeactivation)).authenticated, false,
    'A pre-deactivation session must not revive when the account is reactivated');

  return {
    passwordChangeSessionRevocation: 'passed',
    concurrentPasswordReset: 'passed',
    passwordResetSessionRevocation: 'passed',
    deactivationSessionRevocation: 'passed',
    reactivationCookieReplay: 'passed',
  };
}
