import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const identity = readFileSync('apps/api/Identity/LoginIdentity.cs', 'utf8');
const model = readFileSync('apps/api/Persistence/OrganizationIdentityModelConfiguration.cs', 'utf8');
const session = readFileSync('apps/api/Identity/IdentitySessionEndpoints.cs', 'utf8');
const accessDocumentation = readFileSync('docs/administration/ACCESS_AND_IDENTITY.md', 'utf8');

for (const source of [identity, model]) {
  assert.doesNotMatch(source, /Password(?:Changed|Created|Expires|Expired|ValidUntil|MaximumAge)|PasswordAge/i,
    'The local identity model contains a time-based password lifetime');
}
assert.doesNotMatch(session, /(?:PasswordHash|MustChangePassword).*(?:CreatedAt|LastSignedInAt|AddDays|AddMonths|AddYears)/,
  'Sign-in applies a time-based password lifetime');
assert.match(identity, /SetPasswordHash\(string passwordHash, bool mustChangePassword = false\)/);
assert.match(session, /PasswordVerificationResult\.SuccessRehashNeeded/);
assert.match(accessDocumentation, /does not expire local passwords on a schedule or require periodic rotation/);
assert.match(accessDocumentation, /Directory-managed password lifetime and compromise policy remain the responsibility of the configured identity provider/);

process.stdout.write(`${JSON.stringify({
  passwordLifetimeBoundary: 'passed',
  periodicRotation: false,
  passwordAgeFields: 0,
  allowedRotationReasons: ['user-change', 'recovery-or-compromise-reset', 'account-lifecycle', 'hash-upgrade'],
  directoryPolicyExternal: true,
})}\n`);
