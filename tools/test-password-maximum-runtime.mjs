import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';
function client() {
  const cookies = new Map(); let csrfToken;
  async function request(path, options = {}) {
    const headers = { ...(options.headers ?? {}) };
    if (cookies.size) headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
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
  return {
    request,
    post: (path, body) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    put: (path, body) => request(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    async csrf() { const result = await request('/api/security/antiforgery'); assert.equal(result.status, 200); csrfToken = result.body.token; },
  };
}
const exact = prefix => `${prefix}${'z'.repeat(124)}#`;
const over = prefix => `${prefix}${'z'.repeat(125)}#`;
const suffix = randomBytes(6).toString('hex');
const platform = client();
const bootstrap = { username: `maximum-${suffix}`, displayName: 'Synthetic Maximum Manager',
  email: `maximum-${suffix}@example.invalid` };
const initial128 = exact('A7!'); const initial129 = over('A7!');
assert.equal(initial128.length, 128); assert.equal(initial129.length, 129);
assert.equal((await platform.post('/api/bootstrap/platform-manager', { ...bootstrap, password: initial129 })).status, 400);
assert.equal((await platform.post('/api/bootstrap/platform-manager', { ...bootstrap, password: initial128 })).status, 201);
await platform.csrf();

const changed128 = exact('B8!'); const changed129 = over('B8!');
assert.equal((await platform.put('/api/profile/password', { currentPassword: initial128, newPassword: changed129 })).status, 400);
assert.equal((await platform.put('/api/profile/password', { currentPassword: initial128, newPassword: changed128 })).status, 204);
const site = await platform.post('/api/sites/', { name: `Password Maximum Site ${suffix}`, overviewDesign: 'classic' });
assert.equal(site.status, 201, JSON.stringify(site.body));
const resetUsername = `maximum-reset-${suffix}`;
const created = await platform.post(`/api/sites/${site.body.id}/access/local-users`, {
  displayName: 'Synthetic Maximum Reset', email: `${resetUsername}@example.invalid`,
  username: resetUsername, organizationUnitId: null,
});
assert.equal(created.status, 201, JSON.stringify(created.body));
const reset128 = exact('C9!'); const reset129 = over('C9!');
assert.equal((await platform.post('/api/password-reset/complete', { resetCode: created.body.resetCode, newPassword: reset129 })).status, 400);
assert.equal((await platform.post('/api/password-reset/complete', { resetCode: created.body.resetCode, newPassword: reset128 })).status, 204);

const login = client();
assert.equal((await login.post('/api/session', { username: resetUsername, password: reset128.slice(0, 127) })).status, 401,
  'A truncated 127-character candidate authenticated against the 128-character password');
assert.equal((await login.post('/api/session', { username: resetUsername, password: reset128 })).status, 204);
process.stdout.write(`${JSON.stringify({ passwordMaximumRuntime: 'passed', acceptedLength: 128,
  rejectedLength: 129, testedFlows: ['bootstrap', 'change', 'reset'], fullLengthAuthentication: true,
  truncatedCandidateRejected: true })}\n`);
