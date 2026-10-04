import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const documentation = readFileSync('docs/security/SECURITY_TEST_PLAN.md', 'utf8');
const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const identity = readFileSync('apps/api/Identity/LoginIdentity.cs', 'utf8');
const endpoints = readFileSync('apps/api/Identity/IdentityEndpoints.cs', 'utf8');
const directoryEndpoints = readFileSync('apps/api/Identity/DirectoryEndpoints.cs', 'utf8');
const webauthn = readFileSync('apps/api/Identity/WebAuthnEndpoints.cs', 'utf8');
const gateway = readFileSync('apps/web/nginx.conf', 'utf8');

for (const text of ['eight', 'fixed one-minute window', 'numeric `Retry-After`',
  'twenty', 'failed password or MFA', '15 minutes', 'Successful', 'authentication clears',
  'single client cannot cheaply lock accounts', 'does not reveal whether an identity exists'])
  assert.ok(documentation.includes(text), `Authentication documentation is missing: ${text}`);

assert.match(registration, /options\.AddPolicy\("authentication"[\s\S]*?PermitLimit = 8,[\s\S]*?Window = TimeSpan\.FromMinutes\(1\)/);
assert.match(registration, /Response\.Headers\.RetryAfter/);
assert.match(registration, /X-Fylkren-Gateway-Client-IP[\s\S]*?IPAddress\.TryParse/);
assert.match(gateway, /proxy_set_header X-Fylkren-Gateway-Client-IP \$remote_addr;/);
assert.match(identity, /FailedAuthenticationCount >= 20/);
assert.match(identity, /AuthenticationLockedUntil = now\.AddMinutes\(15\)/);
assert.match(identity, /void ClearAuthenticationFailures\(\)[\s\S]*?FailedAuthenticationCount = 0;[\s\S]*?AuthenticationLockedUntil = null;/);
assert.match(endpoints, /MapPost\("\/profile\/2fa\/setup", BeginTotpSetup\)\.RequireAuthorization\(\)\.RequireRateLimiting\("authentication"\)/);
assert.match(endpoints, /MapPut\("\/profile", UpdateProfile\)\.RequireAuthorization\(\)\.RequireRateLimiting\("authentication"\)/);
assert.match(directoryEndpoints, /MapPost\("\/api\/session\/directory", SignIn\)\.AllowAnonymous\(\)\.RequireRateLimiting\("authentication"\)/);
assert.equal((webauthn.match(/RequireRateLimiting\("authentication"\)/g) ?? []).length, 5,
  'Every WebAuthn credential-verification route must retain the authentication policy');

process.stdout.write(`${JSON.stringify({ authenticationControlDocumentation: 'passed',
  addressPermitLimit: 8, addressWindowSeconds: 60, identityFailureLimit: 20,
  identityLockMinutes: 15, documentedLockoutAbuseMitigation: true,
  trustedClientAddressReplacement: true, directorySignInRateLimited: true,
  authenticatedReauthenticationRoutesCovered: 2, webauthnRoutesCovered: 5 })}\n`);
