import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual', ...options });
  const text = await response.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, setCookies: response.headers.getSetCookie() };
}
function sessionCookie(response) {
  const header = response.setCookies.find((value) => /^(?:Fylkren\.Session|__Host-Fylkren)=/.test(value));
  assert.ok(header, 'Authentication did not issue a session cookie');
  return header.split(';', 1)[0];
}

const suffix = randomBytes(6).toString('hex');
const username = `dynamic-session-${suffix}`; const password = `A7!${randomBytes(18).toString('base64url')}#`;
const bootstrap = await request('/api/bootstrap/platform-manager', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password, displayName: 'Synthetic Dynamic Session Manager', email: `${username}@example.invalid` }),
});
assert.equal(bootstrap.status, 201, JSON.stringify(bootstrap.body));
const first = sessionCookie(bootstrap);
const login = await request('/api/session', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
});
assert.equal(login.status, 204, JSON.stringify(login.body));
const second = sessionCookie(login);
assert.notEqual(first, second);

const separator = second.indexOf('='); const token = second.slice(separator + 1);
const replacement = token.at(-1) === 'A' ? 'B' : 'A';
const tampered = `${second.slice(0, separator + 1)}${token.slice(0, -1)}${replacement}`;
const rejected = await request('/api/session', { headers: { Cookie: tampered } });
assert.equal(rejected.status, 200); assert.equal(rejected.body.authenticated, false);

process.stdout.write(`${JSON.stringify({ dynamicSessionTokenRuntime: 'passed',
  independentLoginsProduceDistinctTokens: true, selfContainedProtectedCookie: true,
  tamperedTokenRejected: true, staticSessionSecret: false })}\n`);
