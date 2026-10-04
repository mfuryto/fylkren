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
    return { status: response.status, body, retryAfter: response.headers.get('retry-after') };
  }
  return {
    post: (path, body) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    put: (path, body) => request(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    async csrf() { const result = await request('/api/security/antiforgery'); assert.equal(result.status, 200); csrfToken = result.body.token; },
  };
}

async function authenticationRequest(action) {
  let result = await action();
  for (let attempt = 0; result.status === 429 && attempt < 3; attempt++) {
    assert.match(result.retryAfter ?? '', /^\d+$/, 'Authentication throttling omitted Retry-After');
    await new Promise(resolve => setTimeout(resolve, (Number(result.retryAfter) + 1) * 1000));
    result = await action();
  }
  return result;
}

const suffix = randomBytes(6).toString('hex');
const platform = client();
const bootstrap = { username: `orbit-${suffix}`, displayName: 'OpsCenter Person', email: `mailtoken-${suffix}@example.invalid` };
const blocked = ['Q7!ＦＹＬＫＲＥＮ-zone#', 'Q7!ORBIT-context#', 'Q7!opscenter-context#', 'Q7!MAILTOKEN-context#'];
for (const password of blocked)
  assert.equal((await authenticationRequest(() => platform.post('/api/bootstrap/platform-manager', { ...bootstrap, password }))).status, 400);
const initial = `A7!${randomBytes(18).toString('base64url')}#`;
assert.equal((await authenticationRequest(() => platform.post('/api/bootstrap/platform-manager', { ...bootstrap, password: initial }))).status, 201);
await platform.csrf();

for (const password of blocked)
  assert.equal((await authenticationRequest(() => platform.put('/api/profile/password', { currentPassword: initial, newPassword: password }))).status, 400);
const changed = `B8!${randomBytes(18).toString('base64url')}#`;
assert.equal((await authenticationRequest(() => platform.put('/api/profile/password', { currentPassword: initial, newPassword: changed }))).status, 204);

const site = await platform.post('/api/sites/', { name: `Password Context Site ${suffix}`, overviewDesign: 'classic' });
assert.equal(site.status, 201, JSON.stringify(site.body));
const resetUsername = `resetorbit-${suffix}`;
const created = await platform.post(`/api/sites/${site.body.id}/access/local-users`, {
  displayName: 'ResetCenter Person', email: `resetmail-${suffix}@example.invalid`,
  username: resetUsername, organizationUnitId: null,
});
assert.equal(created.status, 201, JSON.stringify(created.body));
const resetBlocked = ['Q7!ＦＹＬＫＲＥＮ-zone#', 'Q7!RESETORBIT-context#', 'Q7!resetcenter-context#', 'Q7!RESETMAIL-context#'];
for (const newPassword of resetBlocked)
  assert.equal((await authenticationRequest(() => platform.post('/api/password-reset/complete', { resetCode: created.body.resetCode, newPassword }))).status, 400);
const resetValid = `C9!${randomBytes(18).toString('base64url')}#`;
assert.equal((await authenticationRequest(() => platform.post('/api/password-reset/complete', { resetCode: created.body.resetCode, newPassword: resetValid }))).status, 204);

process.stdout.write(`${JSON.stringify({ passwordContextRuntime: 'passed',
  rejectedContextFamilies: ['product', 'username', 'display-name', 'email'],
  testedFlows: ['bootstrap', 'change', 'reset'], nfkcCaseNormalization: true,
  validControlsAccepted: true, resetGrantPreservedAfterContextRejections: true })}\n`);
