import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const session = readFileSync('apps/api/Identity/IdentitySessionEndpoints.cs', 'utf8');
const bootstrap = readFileSync('apps/api/Identity/IdentityBootstrapEndpoints.cs', 'utf8');
const profile = readFileSync('apps/api/Identity/IdentityProfileEndpoints.cs', 'utf8');
const reset = readFileSync('apps/api/Identity/IdentityPasswordResetEndpoints.cs', 'utf8');
const policy = readFileSync('apps/api/Identity/PasswordSecurityPolicy.cs', 'utf8');

assert.match(session, /var password = request\.Password \?\? string\.Empty;/);
assert.match(session, /VerifyHashedPassword\(identity, identity\.PasswordHash, password\)/);
assert.match(bootstrap, /var password = request\.Password \?\? "";/);
assert.match(bootstrap, /HashPassword\(identity, password\)/);
assert.match(profile, /HashPassword\(identity, request\.NewPassword\)/);
assert.match(reset, /HashPassword\(identity, request\.NewPassword!\)/);
for (const source of [session, bootstrap, profile, reset]) {
  assert.doesNotMatch(source, /(?:Password|password)(?:\?\.)?\.(?:Trim|TrimStart|TrimEnd|ToLower|ToUpper|Substring)\(/,
    'A local password flow transforms or truncates a received password');
}
assert.match(policy, /MaximumLength = 128/);

process.stdout.write(`${JSON.stringify({
  passwordExactnessBoundary: 'passed',
  unchangedVerification: true,
  unchangedHashingFlows: ['bootstrap', 'change', 'reset'],
  maximumAcceptedLength: 128,
})}\n`);
