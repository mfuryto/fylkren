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

const suffix = randomBytes(6).toString('hex'); const password = `A7!${randomBytes(18).toString('base64url')}#`;
const enrollment = client(); const recovery = client(); const afterRemoval = client();
assert.equal((await enrollment.request('/api/bootstrap/platform-manager', 'POST', {
  username: `lost-factor-${suffix}`, password, displayName: 'Synthetic Lost Factor Manager', email: `lost-factor-${suffix}@example.invalid`,
})).status, 201);
await enrollment.csrf();
const setup = await enrollment.request('/api/profile/2fa/setup', 'POST', { currentPassword: password });
assert.equal(setup.status, 200, JSON.stringify(setup.body));
await stableTotpWindow();
const confirmed = await enrollment.request('/api/profile/2fa/confirm', 'POST', { setupToken: setup.body.setupToken, code: totpCode(setup.body.secret) });
assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
assert.equal((await enrollment.request('/api/session', 'DELETE')).status, 204);

const passwordStage = await recovery.request('/api/session', 'POST', { username: `lost-factor-${suffix}`, password });
assert.equal(passwordStage.status, 202); assert.equal(passwordStage.body.requiresTwoFactor, true);
assert.equal((await recovery.request('/api/session/2fa', 'POST', {
  challengeToken: passwordStage.body.challengeToken, code: confirmed.body.recoveryCodes[0],
})).status, 204);
await recovery.csrf();
assert.equal((await recovery.request('/api/profile/2fa', 'DELETE', { password: 'incorrect-synthetic-password' })).status, 400);
assert.equal((await recovery.request('/api/profile/2fa', 'DELETE', { password })).status, 204);
assert.equal((await recovery.request('/api/session', 'DELETE')).status, 204);
assert.equal((await afterRemoval.request('/api/session', 'POST', { username: `lost-factor-${suffix}`, password })).status, 204);

process.stdout.write(`${JSON.stringify({ lostMfaRecoveryRuntime: 'passed', enrollmentProof: ['currentPassword', 'newTotp'],
  recoveryProof: ['password', 'preIssuedRecoveryCode'], removalReauthenticationRequired: true,
  wrongPasswordRejected: true, passwordOnlyAcceptedOnlyAfterExplicitRemoval: true })}\n`);
