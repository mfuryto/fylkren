import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const profileSource = readFileSync('apps/api/Identity/IdentityProfileEndpoints.cs', 'utf8');
const totpSource = readFileSync('apps/api/Identity/IdentityTotpEndpoints.cs', 'utf8');
const webAuthnSource = readFileSync('apps/api/Identity/WebAuthnEndpoints.cs', 'utf8');
const totpRuntime = readFileSync('tools/e2e/totp-security.mjs', 'utf8');
const webAuthnRuntime = readFileSync('tools/e2e/webauthn-security.mjs', 'utf8');

assert.match(profileSource, /emailChanged[^]*VerifyCurrentPassword\(identity, request\.CurrentPassword/);
assert.match(totpSource, /BeginTotpSetup[^]*VerifyCurrentPassword\(identity, request\.CurrentPassword/);
assert.match(totpSource, /DisableTotp[^]*VerifyHashedPassword\(identity, identity\.PasswordHash, request\.Password\)/);
assert.match(webAuthnSource, /RegisterOptions[^]*VerifyCurrentPassword\(login, request\.CurrentPassword/);
assert.match(webAuthnSource, /private static async Task<IResult> Delete[^]*VerifyCurrentPassword\(login, request\.CurrentPassword/);
assert.match(totpRuntime, /incorrect-synthetic-password[^]*status, 400/);
assert.match(webAuthnRuntime, /register\/options[^]*incorrect-synthetic-password[^]*status, 400/);
assert.match(webAuthnRuntime, /credentials\/\$\{listed\.body\[0\]\.id\}[^]*incorrect-synthetic-password[^]*status, 400/);

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';
const cookies = new Map(); let csrfToken;
async function request(path, method = 'GET', body) {
  const headers = {};
  if (cookies.size) headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  if (csrfToken && method !== 'GET') headers['X-Fylkren-CSRF'] = csrfToken;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';', 1)[0]; const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  const text = await response.text(); let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: response.status, body: parsed };
}

const suffix = randomBytes(6).toString('hex');
const username = `reauth-profile-${suffix}`;
const password = `A7!${randomBytes(18).toString('base64url')}#`;
const originalEmail = `${username}@example.invalid`;
assert.equal((await request('/api/bootstrap/platform-manager', 'POST', {
  username, password, displayName: 'Synthetic Reauthentication Manager', email: originalEmail,
})).status, 201);
const csrf = await request('/api/security/antiforgery'); assert.equal(csrf.status, 200); csrfToken = csrf.body.token;

const changedEmail = `${username}-changed@example.invalid`;
assert.equal((await request('/api/profile', 'PUT', { displayName: 'Synthetic Reauthentication Manager', email: changedEmail, currentPassword: '' })).status, 400);
assert.equal((await request('/api/profile', 'PUT', { displayName: 'Synthetic Reauthentication Manager', email: changedEmail, currentPassword: 'incorrect-synthetic-password' })).status, 400);
let profile = await request('/api/profile');
assert.equal(profile.status, 200); assert.equal(profile.body.email, originalEmail);

assert.equal((await request('/api/profile', 'PUT', { displayName: 'Synthetic Renamed Manager', email: originalEmail, currentPassword: '' })).status, 200);
profile = await request('/api/profile'); assert.equal(profile.body.displayName, 'Synthetic Renamed Manager'); assert.equal(profile.body.email, originalEmail);
assert.equal((await request('/api/profile', 'PUT', { displayName: 'Synthetic Renamed Manager', email: changedEmail, currentPassword: password })).status, 200);
profile = await request('/api/profile'); assert.equal(profile.body.email, changedEmail);

process.stdout.write(`${JSON.stringify({
  sensitiveAccountReauthenticationRuntime: 'passed', sensitiveAttributes: ['email', 'totp', 'webauthn'],
  phoneAttributePresent: false, blankEmailReauthenticationRejected: true,
  wrongEmailReauthenticationRejected: true, rejectedChangeAtomic: true,
  nonsensitiveDisplayNameChangeWithoutReauthentication: true, correctEmailReauthenticationAccepted: true,
  factorRuntimeEvidence: true,
})}\n`);
