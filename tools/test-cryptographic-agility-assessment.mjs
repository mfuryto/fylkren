import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const policy = read('docs/security/CRYPTOGRAPHIC_KEY_MANAGEMENT.md');
const login = read('apps/api/Identity/IdentitySessionEndpoints.cs');
const machineIdentity = read('apps/api/Platform/ApiMachineIdentity.cs');
const machineAuth = read('apps/api/Platform/ApiMachineAuthentication.cs');
const federationIdentity = read('apps/api/Federation/FederationIdentityEndpoints.cs');
const federationProtocol = read('apps/api/Federation/FederationWorkProtocol.cs');
const license = read('apps/api/Licensing/LicenseService.cs');
const reprotection = read('apps/api/Platform/CryptoReprotectionService.cs');
const reprotectionEndpoints = read('apps/api/Platform/CryptoReprotectionEndpoints.cs');

assert.match(policy, /Crypto-agility assessment/, 'documented crypto-agility assessment');
assert.match(policy, /SV-101/, 'tracked agility finding');
assert.match(login, /PasswordVerificationResult\.SuccessRehashNeeded[\s\S]*HashPassword/, 'opportunistic password rehash');
assert.match(federationIdentity, /StageRotation\(/, 'federation key rotation');
assert.match(federationIdentity, /identity\.Recover\(/, 'federation lost-key recovery');
assert.match(license, /IReadOnlyList<byte\[]> publicKeys/, 'overlapping license verification keys');

assert.match(machineIdentity, /SecretAlgorithm[\s\S]*SecretHashVersion[\s\S]*SecretIterations/,
  'versioned machine verifier metadata');
assert.match(machineAuth, /LegacyAlgorithm[\s\S]*CurrentAlgorithm[\s\S]*NeedsUpgrade[\s\S]*Upgrade/,
  'dual-read/new-write machine verifier migration');
assert.doesNotMatch(federationProtocol.split('internal sealed record FederationWorkEnvelope')[1].split(';')[0],
  /Algorithm|SignatureVersion/, 'Federation envelope now negotiates a signature algorithm; reassess SV-101');
for (const store of ['smtp', 'identity-provider', 'totp', 'webhook', 'federation'])
  assert.match(reprotection, new RegExp(`"${store}"`), `${store} protected-value inventory`);
assert.match(reprotection, /MaximumBatchSize = 100[\s\S]*FOR UPDATE[\s\S]*RecordBatch/,
  'bounded serialized re-protection batches');
assert.match(reprotection, /CryptographicException[\s\S]*RecordFailure[\s\S]*crypto-reprotection\.failed/,
  'resumable unavailable-key failure');
assert.match(reprotectionEndpoints, /RequireAuthorization[\s\S]*RequireRateLimiting/,
  'authorized and rate-limited re-protection operation');
assert.match(reprotectionEndpoints, /BackupReference[\s\S]*RollbackReference/,
  'backup and rollback references');

console.log(JSON.stringify({
  cryptographicAgilityAssessment: 'finding',
  finding: 'SV-101',
  replacementCapabilities: 9,
  versionedMachineVerifier: true,
  versionedFederationSignature: false,
  persistentReprotectionOperation: true,
}));
