import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';
const cookies = new Map();
function cookieHeader() { return [...cookies].map(([name, value]) => `${name}=${value}`).join('; '); }
function saveCookies(response) {
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';', 1)[0]; const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}
async function request(path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (cookies.size) headers.Cookie = cookieHeader();
  const response = await fetch(`${base}${path}`, { ...options, headers, redirect: 'manual' });
  saveCookies(response); const text = await response.text(); let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { response, body };
}

const suffix = randomBytes(6).toString('hex');
const password = `R8!${randomBytes(22).toString('base64url')}#v`;
const bootstrap = await request('/api/bootstrap/platform-manager', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    username: `reauth-${suffix}`, displayName: 'Synthetic Reauthentication Manager',
    email: `reauth-${suffix}@example.invalid`, password,
  }),
});
assert.equal(bootstrap.response.status, 201, JSON.stringify(bootstrap.body));
const csrf = await request('/api/security/antiforgery');
assert.equal(csrf.response.status, 200, JSON.stringify(csrf.body));

let permitted = 0; let limited;
for (let attempt = 0; attempt < 9; attempt++) {
  const result = await request('/api/profile', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Fylkren-CSRF': csrf.body.token },
    body: JSON.stringify({ displayName: 'Synthetic Reauthentication Manager',
      email: `changed-${suffix}@example.invalid`, currentPassword: 'incorrect-synthetic-password' }),
  });
  if (result.response.status === 429) { limited = result; break; }
  assert.equal(result.response.status, 400, JSON.stringify(result.body)); permitted++;
}
assert.equal(permitted, 7, 'The bootstrap plus seven credential checks must exhaust the eight-request partition');
assert.ok(limited, 'Authenticated current-password verification was not rate-limited');
assert.match(limited.response.headers.get('retry-after') ?? '', /^\d+$/);
assert.match(limited.response.headers.get('cache-control') ?? '', /no-store/i);
process.stdout.write(`${JSON.stringify({ authenticatedReauthenticationRateLimit: 'passed',
  sharedPartitionPermitLimit: 8, credentialChecksAfterBootstrap: permitted,
  rejectedStatus: limited.response.status, numericRetryAfter: true })}\n`);
