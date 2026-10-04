import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.cs') ? [path] : [];
  });
}

const routeCounts = { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 };
for (const path of sourceFiles('apps/api')) {
  const source = readFileSync(path, 'utf8');
  for (const method of Object.keys(routeCounts))
    routeCounts[method] += [...source.matchAll(new RegExp(`\\.Map${method[0]}${method.slice(1).toLowerCase()}\\(`, 'g'))].length;
}
assert.deepEqual(routeCounts, { GET: 103, POST: 112, PUT: 45, PATCH: 0, DELETE: 25 },
  'Endpoint-method inventory changed; review safe methods and CSRF scope before updating the expected inventory');

const username = `csrf-${randomBytes(6).toString('hex')}`;
const password = `C9!${randomBytes(22).toString('base64url')}#r`;
const bootstrap = await fetch(`${base}/api/bootstrap/platform-manager`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, displayName: 'Synthetic CSRF Manager',
    email: `${username}@example.invalid`, password }),
});
assert.equal(bootstrap.status, 201, await bootstrap.text());
const session = bootstrap.headers.getSetCookie().find(value =>
  value.startsWith('__Host-Fylkren=') || value.startsWith('Fylkren.Session='));
assert.ok(session, 'Bootstrap did not issue an application session');
const sessionPair = session.split(';', 1)[0];

async function authenticated(path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cookie', sessionPair);
  return fetch(`${base}${path}`, { redirect: 'manual', ...init, headers });
}

const noTokenCases = [
  ['POST', '/api/sites/', { name: 'Must not be created' }],
  ['PUT', '/api/profile', { displayName: 'Must not change', email: `${username}@example.invalid`, currentPassword: null }],
  ['DELETE', '/api/profile/image', undefined],
];
for (const [method, path, body] of noTokenCases) {
  const response = await authenticated(path, {
    method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(response.status, 400, `${method} ${path} accepted a cookie-authenticated request without CSRF`);
  assert.match(await response.text(), /security check expired/i);
}

const hostile = await authenticated('/api/profile', {
  method: 'PUT', headers: { Origin: 'https://untrusted.example.invalid', 'Content-Type': 'application/json' },
  body: JSON.stringify({ displayName: 'Cross-site change', email: `${username}@example.invalid`, currentPassword: null }),
});
assert.equal(hostile.status, 400, 'Cross-site cookie-authenticated mutation was not rejected');

const tokenResponse = await authenticated('/api/security/antiforgery');
assert.equal(tokenResponse.status, 200);
const token = (await tokenResponse.json()).token;
const antiforgeryCookie = tokenResponse.headers.getSetCookie().find(value =>
  value.startsWith('__Host-Fylkren.Antiforgery=') || value.startsWith('Fylkren.Antiforgery='));
assert.ok(token && antiforgeryCookie, 'Antiforgery pair was not issued');
const protectedCookie = `${sessionPair}; ${antiforgeryCookie.split(';', 1)[0]}`;

const invalidToken = await fetch(`${base}/api/profile`, {
  method: 'PUT', headers: { Cookie: protectedCookie, 'X-Fylkren-CSRF': 'invalid', 'Content-Type': 'application/json' },
  body: JSON.stringify({ displayName: 'Invalid token', email: `${username}@example.invalid`, currentPassword: null }),
});
assert.equal(invalidToken.status, 400, 'Invalid CSRF token was accepted');

const validMutation = await fetch(`${base}/api/profile`, {
  method: 'PUT', headers: { Cookie: protectedCookie, 'X-Fylkren-CSRF': token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ displayName: 'Verified CSRF Manager', email: `${username}@example.invalid`, currentPassword: null }),
});
assert.equal(validMutation.status, 200, await validMutation.text());

async function auditTotal() {
  const response = await authenticated('/api/platform-audit');
  assert.equal(response.status, 200);
  return (await response.json()).total;
}
const auditBeforeSafeMethods = await auditTotal();
const safeMethodStatuses = {};
for (const method of ['GET', 'HEAD', 'OPTIONS']) {
  const response = await authenticated('/api/profile/password', { method });
  safeMethodStatuses[method] = response.status;
  assert.equal(response.status, 405, `${method} reached a password mutation route`);
}
assert.equal(await auditTotal(), auditBeforeSafeMethods, 'Safe-method probes created audit evidence');

process.stdout.write(`${JSON.stringify({ csrfMethodBoundary: 'passed', routeCounts,
  missingTokenRejections: noTokenCases.length, hostileOriginRejected: true,
  invalidTokenRejected: true, validTokenAccepted: true, safeMethodStatuses,
  safeMethodsCreatedAuditEvents: false })}\n`);
