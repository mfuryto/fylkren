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
    async csrf() { const result = await request('/api/security/antiforgery'); assert.equal(result.status, 200); csrfToken = result.body.token; },
    clear() { cookies.clear(); csrfToken = undefined; },
  };
}

const suffix = randomBytes(6).toString('hex');
const username = `mfa-gap-${suffix}`;
const password = `A7!${randomBytes(18).toString('base64url')}#`;
const browser = client();
assert.equal((await browser.post('/api/bootstrap/platform-manager', {
  username, password, displayName: 'Synthetic MFA Assessment', email: `${username}@example.invalid`,
})).status, 201);
const configuration = await browser.request('/api/configuration/public');
assert.equal(configuration.status, 200);
assert.equal(configuration.body.authentication.mfaEnabled, true, 'Assessment requires the deployment MFA feature to be enabled');
await browser.csrf();
assert.equal((await browser.request('/api/session', { method: 'DELETE' })).status, 204);
browser.clear();
const passwordOnly = await browser.post('/api/session', { username, password });
assert.equal(passwordOnly.status, 204, 'The expected unenrolled password-only gap changed; reassess SV-094');
const session = await browser.request('/api/session');
assert.equal(session.status, 200);
assert.equal(session.body.authenticated, true);
assert.equal(session.body.twoFactorEnabled, false);

process.stdout.write(`${JSON.stringify({ mfaEnforcementAssessment: 'finding', finding: 'SV-094',
  deploymentMfaFeatureEnabled: true, unenrolledPasswordOnlySession: true,
  enforcedSecondFactor: false })}\n`);
