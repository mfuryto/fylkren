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

const suffix = randomBytes(6).toString('hex');
const username = `change-${suffix}`;
const currentPassword = `A7!${randomBytes(18).toString('base64url')}#`;
const newPassword = `B8!${randomBytes(18).toString('base64url')}#`;
const actor = client();
assert.equal((await actor.post('/api/bootstrap/platform-manager', {
  username, displayName: 'Synthetic Password Change', email: `${username}@example.invalid`, password: currentPassword,
})).status, 201);
await actor.csrf();
for (const body of [
  { newPassword },
  { currentPassword },
  { currentPassword: 'incorrect-current-password', newPassword },
  { currentPassword, newPassword: currentPassword },
]) assert.equal((await actor.put('/api/profile/password', body)).status, 400, JSON.stringify(body));
assert.equal((await actor.put('/api/profile/password', { currentPassword, newPassword })).status, 204);

const oldLogin = client();
assert.equal((await oldLogin.post('/api/session', { username, password: currentPassword })).status, 401);
const newLogin = client();
assert.equal((await newLogin.post('/api/session', { username, password: newPassword })).status, 204);
process.stdout.write(`${JSON.stringify({ passwordChangeRuntime: 'passed', missingCurrentRejected: true,
  missingNewRejected: true, wrongCurrentRejected: true, reuseRejected: true,
  validChangeAccepted: true, oldPasswordRejected: true, newPasswordAccepted: true })}\n`);
