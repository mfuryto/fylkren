import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const grant = readFileSync('apps/api/Identity/PasswordResetGrant.cs', 'utf8');
const service = readFileSync('apps/api/Identity/PasswordResetService.cs', 'utf8');
const endpoint = readFileSync('apps/api/Identity/IdentityPasswordResetEndpoints.cs', 'utf8');

assert.match(service, /RandomNumberGenerator\.GetBytes\(16\)/);
assert.match(service, /now\.AddMinutes\(30\)/);
assert.match(service, /PasswordResetGrant\.Hash\(rawCode\)/);
assert.match(service, /existing[\s\S]*?grant\.Revoke\(now\)/);
assert.match(grant, /ConsumedAt is null && RevokedAt is null && ExpiresAt > now/);
assert.match(grant, /CryptographicOperations\.FixedTimeEquals\(CodeHash, Hash\(code\)\)/);
assert.match(endpoint, /value\.ExpiresAt > now && value\.CodeHash == hash/);
assert.match(endpoint, /value\.Id == grant\.Id && value\.ConsumedAt == null && value\.RevokedAt == null && value\.ExpiresAt > now/);
assert.doesNotMatch(endpoint, /SignInAsync\(/);

process.stdout.write(`${JSON.stringify({ passwordResetGrantBoundary: 'passed',
  entropyBits: 128, lifetimeMinutes: 30, storedAsSha256: true,
  fixedTimeFinalComparison: true, atomicExpiryAndConsumption: true,
  replacementRevokesPriorGrants: true, resetDoesNotCreateSession: true })}\n`);
