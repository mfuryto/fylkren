import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const totp = readFileSync('apps/api/Identity/TotpService.cs', 'utf8');
const reset = readFileSync('apps/api/Identity/PasswordResetService.cs', 'utf8');
const identitySources = readdirSync('apps/api/Identity')
  .filter((name) => name.endsWith('.cs'))
  .map((name) => readFileSync(`apps/api/Identity/${name}`, 'utf8'))
  .join('\n');

assert.match(totp, /CreateSecret\(\).*RandomNumberGenerator\.GetBytes\(20\)/);
assert.match(totp, /CreateRecoveryCodes\(\).*RandomNumberGenerator\.GetBytes\(16\)/);
assert.match(reset, /rawCode = Convert\.ToHexString\(RandomNumberGenerator\.GetBytes\(16\)\)/);
assert.doesNotMatch(identitySources, /\bnew Random\s*\(|\bRandom\.Shared\b/);

process.stdout.write(`${JSON.stringify({ authenticationSecretCsprngBoundary: 'passed',
  generatedSecrets: { totpSeedBits: 160, recoveryCodeBits: 128, resetCodeBits: 128 },
  generator: 'System.Security.Cryptography.RandomNumberGenerator',
  nonCryptographicRandomInIdentity: false, outOfBandAuthenticationMechanism: false })}\n`);
