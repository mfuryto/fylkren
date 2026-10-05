import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const optionsSource = readFileSync('apps/api/Platform/FylkrenOptions.cs', 'utf8');
const programSource = readFileSync('apps/api/Program.cs', 'utf8');
const directorySource = readFileSync('apps/api/Identity/DirectoryEndpoints.cs', 'utf8');
const externalSource = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const webAuthnSource = readFileSync('apps/api/Identity/WebAuthnEndpoints.cs', 'utf8');
assert.match(optionsSource, /MfaRequired \{ get; set; \} = true/);
assert.match(programSource, /error = "mfa_required"/);
assert.match(programSource, /StartsWithSegments\("\/api\/profile\/2fa"\)/);
assert.match(directorySource, /CreatePrincipal\(identity, browserSession\.Id, now, directoryManaged: true\)/);
assert.match(externalSource, /CreatePrincipal\(identity, browserSession\.Id\)/);
assert.match(externalSource, /CreatePrincipal\(identity, samlBrowserSession\.Id, externalSessionStartedAt\)/);
assert.match(webAuthnSource, /CreatePrincipal\(login, browserSession\.Id, now, mfaSatisfied: true\)/);
assert.match(webAuthnSource, /At least one multi-factor sign-in method must remain active/);

function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of secret.replace(/=+$/u, '').toUpperCase()) bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/gu)?.map(value => Number.parseInt(value, 2)) ?? []);
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, '0');
}

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
assert.equal(configuration.body.authentication.mfaRequired, true);
let session = await browser.request('/api/session');
assert.equal(session.body.authenticated, true);
assert.equal(session.body.mfaRequired, true);
assert.equal(session.body.mfaEnrollmentRequired, true);
assert.equal((await browser.request('/api/sites/')).status, 403);
await browser.csrf();
const setup = await browser.post('/api/profile/2fa/setup', { currentPassword: '' });
assert.equal(setup.status, 200, JSON.stringify(setup.body));
assert.equal((await browser.post('/api/profile/2fa/confirm', { setupToken: setup.body.setupToken, code: totp(setup.body.secret) })).status, 200);
session = await browser.request('/api/session');
assert.equal(session.body.mfaRequired, false);
assert.equal(session.body.twoFactorEnabled, true);
assert.equal((await browser.request('/api/session', { method: 'DELETE' })).status, 204);
browser.clear();
const passwordOnly = await browser.post('/api/session', { username, password });
assert.equal(passwordOnly.status, 202);
assert.ok(passwordOnly.body.challengeToken);
assert.equal((await browser.post('/api/session/2fa', { challengeToken: passwordOnly.body.challengeToken, code: totp(setup.body.secret) })).status, 204);
session = await browser.request('/api/session');
assert.equal(session.status, 200);
assert.equal(session.body.authenticated, true);
assert.equal(session.body.mfaRequired, false);
assert.equal(session.body.twoFactorEnabled, true);
assert.equal((await browser.request('/api/sites/')).status, 200);

process.stdout.write(`${JSON.stringify({ mfaEnforcementAssessment: 'passed', findingClosed: 'SV-094',
  deploymentMfaRequired: true, unenrolledSessionRestrictedToEnrollment: true,
  operationalAccessBeforeSecondFactor: false, totpEnrollmentCompleted: true,
  subsequentPasswordSignInRequiresSecondFactor: true, operationalAccessAfterSecondFactor: true })}\n`);
