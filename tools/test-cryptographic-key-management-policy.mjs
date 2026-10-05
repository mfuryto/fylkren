import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const requireText = (source, pattern, label) =>
  assert.match(source, pattern, `${label} is missing from the maintained policy or implementation`);

const policy = read('docs/security/CRYPTOGRAPHIC_KEY_MANAGEMENT.md');
const registration = read('apps/api/ServiceRegistration.cs');
const compose = read('compose.yaml');
const dockerfile = read('apps/api/Dockerfile');
const backup = read('deploy/compose/backup.sh');
const restore = read('deploy/compose/restore.sh');
const federation = read('apps/api/Federation/FederationIdentityEndpoints.cs');
const machine = read('apps/api/Platform/ApiMachineAuthentication.cs');
const webhooks = read('apps/api/DomainEvents/WebhookManagementEndpoints.cs');
const internalTls = read('apps/tls-init/initialize-internal-tls.sh');

for (const phase of ['Create and register', 'Distribute and activate', 'Operate and store',
  'Rotate and replace', 'Revoke and recover', 'Back up and archive', 'Destroy'])
  requireText(policy, new RegExp(`\\*\\*${phase}\\.\\*\\*`), `key lifecycle phase ${phase}`);
requireText(policy, /NIST SP 800-57 Part 1/, 'key-management standard alignment');
requireText(policy, /A private key belongs to one installation or external issuer/, 'private-key ownership rule');
requireText(policy, /shared secret may be held only by the two endpoints/, 'shared-secret distribution limit');
requireText(policy, /Production, test and development key material must be distinct/, 'environment separation');
requireText(policy, /Cryptographic key and secret inventory/, 'cryptographic inventory');

requireText(registration, /PersistKeysToFileSystem/, 'persistent Data Protection key ring');
requireText(registration, /EncryptionAlgorithm = EncryptionAlgorithm\.AES_256_CBC/, 'Data Protection encryption algorithm');
requireText(registration, /ValidationAlgorithm = ValidationAlgorithm\.HMACSHA256/, 'Data Protection authentication algorithm');
requireText(compose, /fylkren-keys:\/var\/lib\/fylkren\/keys/, 'dedicated API key volume');
assert.equal((compose.match(/fylkren-keys:\/var\/lib\/fylkren\/keys/g) ?? []).length, 1,
  'The production key volume must be mounted only once');
requireText(dockerfile, /chmod 700 \/var\/lib\/fylkren\/keys/, 'owner-only key directory');
requireText(backup, /chmod 0600 "\$target\/data-protection-keys\.tar\.gz"/, 'owner-only key backup');
requireText(restore, /database, configuration and Data Protection keys/, 'matched destructive restore boundary');
requireText(federation, /ECDsa\.Create\(ECCurve\.NamedCurves\.nistP256\)/, 'federation key generation');
requireText(federation, /federation_key_still_usable_use_rotation/, 'lost-key recovery guard');
requireText(machine, /RandomNumberGenerator\.GetBytes\(32\)/, 'machine credential entropy');
requireText(webhooks, /RandomNumberGenerator\.GetBytes\(32\)/, 'webhook secret entropy');
requireText(policy, /runtime services receive only the keys required for their role and the public CA/, 'internal TLS key separation policy');
requireText(policy, /a CA replacement requires a coordinated restart/, 'internal TLS CA rotation procedure');
requireText(compose, /tls-init:[\s\S]*network_mode: none/, 'networkless internal TLS initialization boundary');
requireText(internalTls, /issue_leaf api[\s\S]*issue_leaf postgres/, 'separate internal TLS service identities');
requireText(internalTls, /issue_client fylkren-api/, 'separate database client identity');

console.log(JSON.stringify({
  cryptographicKeyManagementPolicy: 'passed',
  lifecyclePhases: 7,
  privateKeyOwnersMaximum: 1,
  sharedSecretEndpointsMaximum: 2,
  productionKeyVolumeConsumers: 1,
  matchedBackupAndRestoreRequired: true,
}));
