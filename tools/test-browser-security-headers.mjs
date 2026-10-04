import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';
const hostileOrigin = 'https://untrusted.example.invalid';

function assertBrowserPolicy(response, label) {
  const hsts = response.headers.get('strict-transport-security') ?? '';
  const maxAge = Number(/(?:^|;)\s*max-age=(\d+)/i.exec(hsts)?.[1]);
  assert.ok(maxAge >= 31_536_000, `${label}: HSTS max-age was ${maxAge || 'missing'}`);
  assert.match(hsts, /(?:^|;)\s*includesubdomains(?:;|$)/i, `${label}: HSTS did not include subdomains`);
  assert.equal(response.headers.get('x-content-type-options')?.toLowerCase(), 'nosniff', `${label}: nosniff missing`);
  assert.equal(response.headers.get('referrer-policy')?.toLowerCase(), 'no-referrer', `${label}: referrer policy missing`);
  const csp = response.headers.get('content-security-policy') ?? '';
  for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'"])
    assert.ok(csp.toLowerCase().includes(directive), `${label}: CSP missing ${directive}`);
}

async function request(path, expectedStatus, init = {}) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual', ...init });
  assert.equal(response.status, expectedStatus, `${path}: unexpected status`);
  assertBrowserPolicy(response, path);
  return response;
}

const home = await request('/', 200);
const html = await home.text();
const assetPath = /(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/.exec(html)?.[1];
assert.ok(assetPath, 'No versioned JS/CSS asset was found');
const asset = await request(assetPath, 200);
assert.match(asset.headers.get('cache-control') ?? '', /(?:^|,)\s*(?:public|immutable)/i);
await request('/assets/asvs-header-does-not-exist.js', 404);
await request('/api/configuration/public', 200, { headers: { Origin: hostileOrigin } });
await request('/api/configuration', 401);
await request('/api/asvs-header-does-not-exist', 401);
await request('/health', 200);

const username = `headers-${randomBytes(6).toString('hex')}`;
const password = `H8!${randomBytes(22).toString('base64url')}#x`;
const bootstrap = await request('/api/bootstrap/platform-manager', 201, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, displayName: 'Synthetic Header Manager',
    email: `${username}@example.invalid`, password }),
});
const sessionCookie = bootstrap.headers.getSetCookie().find(value =>
  value.startsWith('__Host-Fylkren=') || value.startsWith('Fylkren.Session='));
assert.ok(sessionCookie, 'Bootstrap did not issue the application cookie');
await request('/api/configuration', 200, { headers: { Cookie: sessionCookie.split(';', 1)[0] } });

const crossOriginGet = await fetch(`${base}/api/configuration/public`, { headers: { Origin: hostileOrigin } });
assert.equal(crossOriginGet.headers.has('access-control-allow-origin'), false, 'Hostile origin received CORS access');
const preflight = await fetch(`${base}/api/configuration`, {
  method: 'OPTIONS', headers: { Origin: hostileOrigin, 'Access-Control-Request-Method': 'GET' }, redirect: 'manual',
});
assertBrowserPolicy(preflight, 'hostile preflight');
assert.equal(preflight.headers.has('access-control-allow-origin'), false, 'Hostile preflight received CORS access');

process.stdout.write(`${JSON.stringify({ browserSecurityHeaders: 'passed', responseClasses: 9,
  hstsMinimumSeconds: 31_536_000, includeSubDomains: true, cspRequiredDirectives: true,
  nosniff: true, noReferrer: true, staticSuccessAndError: true, hostileCorsDenied: true })}\n`);
