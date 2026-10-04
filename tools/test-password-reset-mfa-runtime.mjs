import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
function client() {
  const cookies = new Map(); let csrfToken;
  async function request(path, method = 'GET', body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookies.size) headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    if (csrfToken && method !== 'GET') headers['X-Fylkren-CSRF'] = csrfToken;
    const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(';', 1)[0]; const separator = pair.indexOf('=');
      if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    const text = await response.text(); let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: response.status, body: parsed };
  }
  return { request, async csrf() { const value = await request('/api/security/antiforgery'); assert.equal(value.status, 200); csrfToken = value.body.token; } };
}
function totpCode(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0; let buffer = 0; const bytes = [];
  for (const character of secret) {
    buffer = (buffer << 5) | alphabet.indexOf(character); bits += 5;
    if (bits >= 8) { bytes.push((buffer >> (bits - 8)) & 255); bits -= 8; }
  }
  const counter = Buffer.alloc(8); counter.writeBigInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hash = createHmac('sha1', Buffer.from(bytes)).update(counter).digest(); const offset = hash.at(-1) & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
async function stableTotpWindow() {
  const elapsed = Date.now() % 30_000;
  if (elapsed > 24_000) await pause(30_100 - elapsed);
}

const suffix = randomBytes(6).toString('hex');
const manager = client(); const user = client(); const anonymous = client();
const managerPassword = `A7!${randomBytes(18).toString('base64url')}#`;
assert.equal((await manager.request('/api/bootstrap/platform-manager', 'POST', {
  username: `reset-mfa-manager-${suffix}`, password: managerPassword,
  displayName: 'Synthetic Reset MFA Manager', email: `reset-mfa-manager-${suffix}@example.invalid`,
})).status, 201);
await manager.csrf();
const site = await manager.request('/api/sites/', 'POST', { name: `Reset MFA Site ${suffix}`, overviewDesign: 'classic' });
assert.equal(site.status, 201);
const username = `reset-mfa-user-${suffix}`;
const created = await manager.request(`/api/sites/${site.body.id}/access/local-users`, 'POST', {
  displayName: 'Synthetic Reset MFA User', email: `${username}@example.invalid`, username, organizationUnitId: null,
});
assert.equal(created.status, 201, JSON.stringify(created.body));
const firstPassword = `B8!${randomBytes(18).toString('base64url')}#`;
assert.equal((await user.request('/api/password-reset/complete', 'POST', { resetCode: created.body.resetCode, newPassword: firstPassword })).status, 204);
assert.equal((await user.request('/api/session', 'POST', { username, password: firstPassword })).status, 204);
await user.csrf();
const setup = await user.request('/api/profile/2fa/setup', 'POST', { currentPassword: firstPassword });
assert.equal(setup.status, 200, JSON.stringify(setup.body));
await stableTotpWindow();
const confirmed = await user.request('/api/profile/2fa/confirm', 'POST', { setupToken: setup.body.setupToken, code: totpCode(setup.body.secret) });
assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));

const reset = await manager.request('/api/platform/identity/users/password', 'POST', { personIds: [created.body.member.id] });
assert.equal(reset.status, 200, JSON.stringify(reset.body));
assert.equal(reset.body.resetCodes.length, 1);
const secondPassword = `C9!${randomBytes(18).toString('base64url')}#`;
assert.equal((await anonymous.request('/api/password-reset/complete', 'POST', { resetCode: reset.body.resetCodes[0].resetCode, newPassword: secondPassword })).status, 204);
const passwordStage = await anonymous.request('/api/session', 'POST', { username, password: secondPassword });
assert.equal(passwordStage.status, 202, JSON.stringify(passwordStage.body));
assert.equal(passwordStage.body.requiresTwoFactor, true);
const factorStage = await anonymous.request('/api/session/2fa', 'POST', { challengeToken: passwordStage.body.challengeToken, code: confirmed.body.recoveryCodes[0] });
assert.equal(factorStage.status, 204, JSON.stringify(factorStage.body));
const session = await anonymous.request('/api/session');
assert.equal(session.status, 200); assert.equal(session.body.authenticated, true); assert.equal(session.body.twoFactorEnabled, true);

process.stdout.write(`${JSON.stringify({ passwordResetMfaRuntime: 'passed', enrolledFactorPreserved: true,
  passwordStageDidNotCreateSession: true, secondFactorRequiredAfterReset: true,
  existingRecoveryFactorAcceptedAfterReset: true, authenticatedOnlyAfterSecondFactor: true })}\n`);
