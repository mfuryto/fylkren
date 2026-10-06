import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const policy = read('docs/security/CRYPTOGRAPHIC_KEY_MANAGEMENT.md');
const login = read('apps/api/Identity/IdentitySessionEndpoints.cs');
const machineIdentity = read('apps/api/Platform/ApiMachineIdentity.cs');
const machineAuth = read('apps/api/Platform/ApiMachineAuthentication.cs');
const federationIdentity = read('apps/api/Federation/FederationIdentityEndpoints.cs');
const federationProtocol = read('apps/api/Federation/FederationWorkProtocol.cs');
const federationSignature = read('apps/api/Federation/FederationSignatureProtocol.cs');
const federationCapability = read('apps/api/Federation/FederationCapabilityProtocol.cs');
const federationPeer = read('apps/api/Federation/FederationPeer.cs');
const license = read('apps/api/Licensing/LicenseService.cs');
const licenseEndpoints = read('apps/api/Licensing/LicenseEndpoints.cs');
const installedLicense = read('apps/api/Licensing/InstalledLicense.cs');
const reprotection = read('apps/api/Platform/CryptoReprotectionService.cs');
const reprotectionEndpoints = read('apps/api/Platform/CryptoReprotectionEndpoints.cs');

assert.match(policy, /Crypto-agility assessment/, 'documented crypto-agility assessment');
assert.match(policy, /SV-101/, 'tracked agility finding');
assert.match(login, /PasswordVerificationResult\.SuccessRehashNeeded[\s\S]*HashPassword/, 'opportunistic password rehash');
assert.match(federationIdentity, /StageRotation\(/, 'federation key rotation');
assert.match(federationIdentity, /identity\.Recover\(/, 'federation lost-key recovery');
assert.match(license, /IReadOnlyList<byte\[]> publicKeys/, 'overlapping license verification keys');
assert.match(license, /CurrentSignatureAlgorithm = "ecdsa-p256-sha256-p1363"/, 'explicit license signature algorithm');
assert.match(license, /SchemaVersion switch[\s\S]*1 =>[\s\S]*2 =>/, 'dual-read license format transition');
assert.match(licenseEndpoints, /SignatureAlgorithm[\s\S]*Evaluate\([\s\S]*request\.SignatureAlgorithm/,
  'license envelope algorithm verification');
assert.match(installedLicense, /SignatureAlgorithm/, 'persisted installed-license algorithm');

assert.match(machineIdentity, /SecretAlgorithm[\s\S]*SecretHashVersion[\s\S]*SecretIterations/,
  'versioned machine verifier metadata');
assert.match(machineAuth, /LegacyAlgorithm[\s\S]*CurrentAlgorithm[\s\S]*NeedsUpgrade[\s\S]*Upgrade/,
  'dual-read/new-write machine verifier migration');
assert.match(federationSignature, /CurrentAlgorithm = "ecdsa-p256-sha256-p1363"[\s\S]*Accepts/,
  'federation signature allowlist and downgrade check');
assert.match(federationCapability, /LegacyProtocolVersion = 1[\s\S]*ProtocolVersion = 2[\s\S]*SignatureAlgorithm/,
  'dual-version federation capability negotiation');
assert.match(federationPeer, /NegotiatedProtocolVersion[\s\S]*RecordProtocol[\s\S]*NegotiatedProtocolVersion < 2/,
  'persistent no-downgrade peer state');
assert.match(federationProtocol.split('internal sealed record FederationWorkEnvelope')[1].split(';')[0],
  /SignatureAlgorithm/, 'versioned federation work envelope');
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
  cryptographicAgilityAssessment: 'passed',
  closedFinding: 'SV-101',
  replacementCapabilities: 11,
  versionedMachineVerifier: true,
  versionedLicenseSignature: true,
  versionedFederationSignature: true,
  persistentReprotectionOperation: true,
}));
