import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const totp = readFileSync('apps/api/Identity/TotpService.cs', 'utf8');
const totpEndpoints = readFileSync('apps/api/Identity/IdentityTotpEndpoints.cs', 'utf8');
const identity = readFileSync('apps/api/Identity/LoginIdentity.cs', 'utf8');
const resetService = readFileSync('apps/api/Identity/PasswordResetService.cs', 'utf8');
const resetGrant = readFileSync('apps/api/Identity/PasswordResetGrant.cs', 'utf8');
const model = readFileSync('apps/api/Persistence/OrganizationIdentityModelConfiguration.cs', 'utf8');

assert.match(totp, /CreateRecoveryCodes\(\).*RandomNumberGenerator\.GetBytes\(16\)/);
assert.match(totp, /HashRecoveryCode\(string code\).*SHA256\.HashData/);
assert.match(totpEndpoints, /recoveryCodes\.Select\(totp\.HashRecoveryCode\)/);
assert.match(identity, /RecoveryCodeHashes = string\.Join\(';', recoveryCodeHashes\)/);
assert.doesNotMatch(identity, /RecoveryCodes\s*\{/);
assert.match(model, /RecoveryCodeHashes\).*HasColumnName\("recovery_code_hashes"\)/);

assert.match(resetService, /rawCode = Convert\.ToHexString\(RandomNumberGenerator\.GetBytes\(16\)\)/);
assert.match(resetService, /PasswordResetGrant\.Hash\(rawCode\)/);
assert.match(resetGrant, /byte\[\] CodeHash/);
assert.match(resetGrant, /SHA256\.HashData\(Encoding\.UTF8\.GetBytes\(Normalize\(code\)\)\)/);
assert.match(model, /CodeHash\).*HasColumnName\("code_hash"\)\.IsRequired\(\)/);

process.stdout.write(`${JSON.stringify({ lookupSecretStorageBoundary: 'passed',
  lookupSecretTypes: ['totpRecoveryCode', 'passwordResetCode'], entropyBits: 128,
  persistedRepresentation: 'sha256', persistedRawSecrets: false,
  standardHashPermittedAboveBits: 112 })}\n`);
