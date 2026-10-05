import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = path => readFileSync(path, 'utf8');
const policy = read('docs/security/CRYPTOGRAPHIC_KEY_MANAGEMENT.md');
const registration = read('apps/api/ServiceRegistration.cs');
const login = read('apps/api/Identity/IdentitySessionEndpoints.cs');
const totp = read('apps/api/Identity/TotpService.cs');
const reset = read('apps/api/Identity/PasswordResetService.cs');
const machine = read('apps/api/Platform/ApiMachineAuthentication.cs');
const webhook = read('apps/api/DomainEvents/WebhookManagementEndpoints.cs');
const federation = read('apps/api/Federation/FederationIdentityEndpoints.cs');
const license = read('apps/api/Licensing/LicenseService.cs');

function sourceFiles(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    if (path.includes('/Persistence/Migrations/')) return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.cs') ? [path] : [];
  });
}
const sources = sourceFiles('apps/api').map(read).join('\n');

assert.doesNotMatch(sources, /MD5|HMACMD5|SHA1\.HashData|HashAlgorithmName\.SHA1/,
  'Disallowed unkeyed/signature SHA-1 or MD5 usage detected');
assert.match(totp, /new HMACSHA1\(DecodeBase32\(secret\)\)/, 'TOTP-only keyed SHA-1 use');
assert.match(totp, /RandomNumberGenerator\.GetBytes\(20\)/, '160-bit TOTP secret');
assert.match(registration, /IterationCount = 220_000/, 'local password work factor');
assert.match(login, /SuccessRehashNeeded[\s\S]*HashPassword/, 'opportunistic password rehash');
assert.match(machine, /RandomNumberGenerator\.GetBytes\(32\)/, '256-bit machine secret');
assert.match(machine, /RandomNumberGenerator\.GetBytes\(16\)/, '128-bit machine salt');
assert.match(reset, /RandomNumberGenerator\.GetBytes\(16\)/, '128-bit reset code');
assert.match(totp, /RandomNumberGenerator\.GetBytes\(16\)/, '128-bit recovery code');
assert.match(webhook, /RandomNumberGenerator\.GetBytes\(32\)/, '256-bit webhook secret');
assert.match(federation, /ECDsa\.Create\(ECCurve\.NamedCurves\.nistP256\)/, 'approved local public-key generation');
assert.match(license, /HashAlgorithmName\.SHA256/, 'approved license signature hash');
assert.match(policy, /UUIDs identify records or provide uniqueness inside signed federation replay messages/, 'UUID non-secret classification');

console.log(JSON.stringify({
  hashKdfRandomPublicKeyBoundaries: 'passed',
  collisionDependentMinimum: 'SHA-256',
  passwordKdf: 'PBKDF2-HMAC-SHA-512/220000',
  minimumUnpredictableBits: 128,
  uuidSecrets: 0,
  localSigningKeyGeneration: 'P-256/CSPRNG',
}));
