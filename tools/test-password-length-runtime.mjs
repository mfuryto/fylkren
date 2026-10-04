import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';
const cookies = new Map(); let csrfToken;
function cookieHeader() { return [...cookies].map(([name, value]) => `${name}=${value}`).join('; '); }
async function request(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (cookies.size) headers.Cookie = cookieHeader();
  if (csrfToken && options.method && options.method !== 'GET') headers['X-Fylkren-CSRF'] = csrfToken;
  const response = await fetch(`${base}${path}`, { ...options, headers, redirect: 'manual' });
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';', 1)[0]; const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  const text = await response.text(); let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}
const post = (path, body) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const put = (path, body) => request(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const suffix = randomBytes(6).toString('hex');
const bootstrap = { username: `length-${suffix}`, displayName: 'Synthetic Length Manager',
  email: `length-${suffix}@example.invalid` };
const thirteen = 'N7!abcdefghi#';
const fourteen = 'N7!abcdefghij#';
assert.equal(thirteen.length, 13); assert.equal(fourteen.length, 14);
assert.equal((await post('/api/bootstrap/platform-manager', { ...bootstrap, password: thirteen })).status, 400);
assert.equal((await post('/api/bootstrap/platform-manager', { ...bootstrap, password: fourteen })).status, 201);
const csrf = await request('/api/security/antiforgery'); assert.equal(csrf.status, 200); csrfToken = csrf.body.token;

const changed13 = 'P8!abcdefghi#'; const changed14 = 'P8!abcdefghij#';
assert.equal((await put('/api/profile/password', { currentPassword: fourteen, newPassword: changed13 })).status, 400);
assert.equal((await put('/api/profile/password', { currentPassword: fourteen, newPassword: changed14 })).status, 204);

const site = await post('/api/sites/', { name: `Password Length Site ${suffix}`, overviewDesign: 'classic' });
assert.equal(site.status, 201, JSON.stringify(site.body));
const username = `reset-${suffix}`;
const created = await post(`/api/sites/${site.body.id}/access/local-users`, {
  displayName: 'Synthetic Reset User', email: `${username}@example.invalid`, username, organizationUnitId: null,
});
assert.equal(created.status, 201, JSON.stringify(created.body));
const reset13 = 'R9!abcdefghi#'; const reset14 = 'R9!abcdefghij#';
assert.equal((await post('/api/password-reset/complete', { resetCode: created.body.resetCode, newPassword: reset13 })).status, 400);
assert.equal((await post('/api/password-reset/complete', { resetCode: created.body.resetCode, newPassword: reset14 })).status, 204);

process.stdout.write(`${JSON.stringify({ passwordLengthRuntime: 'passed', rejectedLength: 13,
  acceptedLength: 14, testedFlows: ['bootstrap', 'change', 'reset'], resetGrantPreservedAfterInvalidPassword: true })}\n`);
