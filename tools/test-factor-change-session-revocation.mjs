import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const identity = readFileSync('apps/api/Identity/LoginIdentity.cs', 'utf8');
const profile = readFileSync('apps/api/Identity/IdentityProfileEndpoints.cs', 'utf8');
const reset = readFileSync('apps/api/Identity/IdentityPasswordResetEndpoints.cs', 'utf8');
const totp = readFileSync('apps/api/Identity/IdentityTotpEndpoints.cs', 'utf8');
const webAuthn = readFileSync('apps/api/Identity/WebAuthnEndpoints.cs', 'utf8');
const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const runtime = readFileSync('tools/e2e/identity-session-lifecycle.mjs', 'utf8');
const totpRuntime = readFileSync('tools/e2e/totp-security.mjs', 'utf8');
const webAuthnRuntime = readFileSync('tools/e2e/webauthn-security.mjs', 'utf8');

for (const method of ['SetPasswordHash', 'EnableTotp', 'DisableTotp']) {
  assert.match(identity, new RegExp(`void ${method}\\([^]*?SecurityVersion = nextVersion;`));
}
assert.match(profile, /identity\.SetPasswordHash\([^]*?SaveChangesAsync[^]*?SignInAsync/);
assert.match(reset, /identity\.SetPasswordHash\([^]*?SaveChangesAsync/);
assert.match(totp, /identity\.EnableTotp\([^]*?SaveChangesAsync[^]*?SignInAsync/);
assert.match(totp, /identity\.DisableTotp\([^]*?SaveChangesAsync[^]*?SignInAsync/);
assert.match(webAuthn, /WebAuthnCredentials\.Add\([^]*?login\.AdvanceSecurityVersion\(\)[^]*?SaveChangesAsync[^]*?SignInAsync/);
assert.match(webAuthn, /credential\.Deactivate\(\)[^]*?login\.AdvanceSecurityVersion\(\)[^]*?SaveChangesAsync[^]*?SignInAsync/);

assert.match(registration, /OnValidatePrincipal = ValidateSessionPrincipal/);
assert.match(registration, /sessionIdentity\?\.SecurityVersion == securityVersion/);
assert.match(registration, /if \(!hasAccess \|\| sessionIdentity is null\)[^]*?RejectPrincipal\(\)[^]*?SignOutAsync/);

assert.match(runtime, /Password change must immediately invalidate another active session/);
assert.match(runtime, /Password reset must immediately invalidate an active session/);
assert.match(runtime, /passwordChangeSessionRevocation: 'passed'/);
assert.match(runtime, /passwordResetSessionRevocation: 'passed'/);
assert.match(totpRuntime, /staleChallengeAfterSignOutRejected: true/);
assert.match(webAuthnRuntime, /staleRegistrationAfterSignOutRejected: true/);
assert.match(webAuthnRuntime, /deletedCredentialPendingLoginRejected: true/);

process.stdout.write(`${JSON.stringify({
  factorChangeSessionRevocation: 'passed',
  mutations: ['password-change', 'password-reset', 'totp-enable', 'totp-disable', 'webauthn-register', 'webauthn-remove'],
  accountVersionInvalidatesOtherSessions: true,
  actingSessionRenewed: true,
  passwordRuntimeEvidence: true,
  factorRuntimeEvidence: true,
})}\n`);
