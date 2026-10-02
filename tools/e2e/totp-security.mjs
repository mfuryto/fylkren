import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
const base = process.env.FYLKREN_BROWSER_TARGET_URL ?? 'http://localhost:18082/';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function client() {
  const cookies = new Map(); let csrf;
  async function request(path, method = 'GET', body) {
    const response = await fetch(new URL(path, base), { method, redirect: 'manual', headers: {
      ...(cookies.size && { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') }),
      ...(csrf && method !== 'GET' && { 'X-Fylkren-CSRF': csrf }),
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    }, ...(body !== undefined && { body: JSON.stringify(body) }) });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], separator = pair.indexOf('=');
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    const text = await response.text(); let value; try { value = JSON.parse(text); } catch { value = text; }
    return { status: response.status, body: value };
  }
  return { request, async csrf() { const value = await request('/api/security/antiforgery'); assert.equal(value.status, 200); csrf = value.body.token; } };
}
function code(secret, offset = 0) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, buffer = 0; const bytes = [];
  for (const char of secret) { buffer = (buffer << 5) | alphabet.indexOf(char); bits += 5; if (bits >= 8) { bytes.push((buffer >> (bits - 8)) & 255); bits -= 8; } }
  const counter = Buffer.alloc(8); counter.writeBigInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offset));
  const hash = createHmac('sha1', Buffer.from(bytes)).update(counter).digest(), index = hash.at(-1) & 15;
  return String((hash.readUInt32BE(index) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
async function stableWindow() { if (Date.now() % 30_000 > 24_000) await pause(30_100 - Date.now() % 30_000); }
const account = client(), anonymous = client();
const username = `totp-${randomBytes(6).toString('hex')}`, password = `V8!${randomBytes(24).toString('base64url')}#z`;
assert.equal((await account.request('/api/bootstrap/platform-manager', 'POST', { username, password, displayName: 'Synthetic TOTP Manager', email: `${username}@example.invalid` })).status, 201);
await account.csrf();
assert.equal((await account.request('/api/profile/2fa/setup', 'POST', { currentPassword: 'incorrect-synthetic-password' })).status, 400);
const setup = await account.request('/api/profile/2fa/setup', 'POST', { currentPassword: password }); assert.equal(setup.status, 200);
await stableWindow();
const confirmed = await account.request('/api/profile/2fa/confirm', 'POST', { setupToken: setup.body.setupToken, code: code(setup.body.secret) });
assert.equal(confirmed.status, 200); assert.equal(confirmed.body.recoveryCodes.length, 8);
assert.equal((await account.request('/api/profile/2fa/confirm', 'POST', { setupToken: setup.body.setupToken, code: code(setup.body.secret) })).status, 400);
async function challenge() { const value = await anonymous.request('/api/session', 'POST', { username, password }); assert.equal(value.status, 202); return value.body.challengeToken; }
async function complete(challengeToken, value) { return client().request('/api/session/2fa', 'POST', { challengeToken, code: value }); }
let token = await challenge(); await stableWindow();
assert.equal((await complete(token, code(setup.body.secret, -1))).status, 401);
assert.equal((await complete(token, code(setup.body.secret, 1))).status, 401);
await pause(61_000); // Auth endpoints deliberately share a small per-client request budget.
const parallelRecovery = await Promise.all([complete(token, confirmed.body.recoveryCodes[0]), complete(token, confirmed.body.recoveryCodes[0])]);
assert.deepEqual(parallelRecovery.map(value => value.status).sort(), [204, 401]);
const stale = await challenge();
assert.equal((await account.request('/api/session', 'DELETE')).status, 204);
assert.equal((await complete(stale, confirmed.body.recoveryCodes[1])).status, 401, 'A challenge issued before sign-out authenticated after security-version revocation');
const fresh = await challenge(); assert.equal((await complete(fresh, confirmed.body.recoveryCodes[1])).status, 204, 'Rejected stale challenge must not consume recovery material');
await pause(61_000);
token = await challenge(); await stableWindow();
const currentCode = code(setup.body.secret);
const parallelTotp = await Promise.all([complete(token, currentCode), complete(token, currentCode)]);
assert.deepEqual(parallelTotp.map(value => value.status).sort(), [204, 401]);
assert.equal((await complete('tampered-synthetic-challenge', confirmed.body.recoveryCodes[2])).status, 401);
console.log(JSON.stringify({ totpSecurity: 'passed', passwordReauthentication: true, setupReplayRejected: true, adjacentWindowsRejected: true, parallelRecoverySingleUse: true, staleChallengeAfterSignOutRejected: true, parallelTotpSingleUse: true, tamperedChallengeRejected: true }));
