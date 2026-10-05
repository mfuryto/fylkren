import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const support = readFileSync('apps/api/Identity/IdentitySupport.cs', 'utf8');
const access = readFileSync('docs/administration/ACCESS_AND_IDENTITY.md', 'utf8');
const security = readFileSync('docs/security/SECURITY_AND_RETENTION.md', 'utf8');

assert.match(registration, /ExpireTimeSpan = TimeSpan\.FromHours\(1\)/);
assert.match(registration, /SlidingExpiration = true/);
assert.match(registration, /now - sessionStartedAt >= TimeSpan\.FromHours\(12\)/);
assert.match(registration, /CreatePrincipal\(\s*sessionIdentity, browserSession\.Id, sessionStartedAt/);
assert.match(support, /"fylkren:session_started_at"/);
assert.match(access, /one-hour sliding inactivity limit and a twelve-hour absolute limit/);
assert.match(access, /NIST SP 800-63B-4 AAL2 reauthentication limits/);
assert.match(access, /does not claim AAL2 while mandatory MFA remains unresolved under SV-094/);
assert.match(security, /one-hour sliding inactivity lifetime and a twelve-hour absolute lifetime/);

process.stdout.write(`${JSON.stringify({ sessionPolicyDocumentation: 'passed',
  inactivityHours: 1, absoluteHours: 12, slidingInactivity: true,
  absoluteStartPreservedOnRenewal: true, nistReference: 'SP-800-63B-4-AAL2',
  nistRecommendedMaximums: { inactivityHours: 1, absoluteHours: 24 },
  aal2Claimed: false, mandatoryMfaFinding: 'SV-094' })}\n`);
