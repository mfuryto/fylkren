import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policy = readFileSync('apps/api/Identity/PasswordSecurityPolicy.cs', 'utf8');
const bootstrap = readFileSync('apps/api/Identity/IdentityBootstrapEndpoints.cs', 'utf8');
const profile = readFileSync('apps/api/Identity/IdentityProfileEndpoints.cs', 'utf8');
const reset = readFileSync('apps/api/Identity/IdentityPasswordResetEndpoints.cs', 'utf8');

assert.match(policy, /MinimumLength = 14/);
assert.match(policy, /MaximumLength = 128/);
assert.match(policy, /password\?\.Length is not \(>= MinimumLength and <= MaximumLength\)/);
for (const source of [bootstrap, profile, reset])
  assert.equal((source.match(/passwordPolicy\.Validate\(/g) ?? []).length, 1,
    'Every local user-set password flow must invoke the shared policy exactly once');

process.stdout.write(`${JSON.stringify({ passwordLengthBoundary: 'passed', minimumLength: 14,
  maximumLength: 128, localUserSetPasswordFlows: 3 })}\n`);
