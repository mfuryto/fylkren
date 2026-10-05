import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const policy = readFileSync('docs/security/CRYPTOGRAPHIC_KEY_MANAGEMENT.md', 'utf8');
const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const machine = readFileSync('apps/api/Platform/ApiMachineAuthentication.cs', 'utf8');
const totp = readFileSync('apps/api/Identity/TotpService.cs', 'utf8');
const webhook = readFileSync('apps/api/DomainEvents/WebhookDeliveryWorker.cs', 'utf8');
const license = readFileSync('apps/api/Licensing/LicenseService.cs', 'utf8');
const webAuthn = readFileSync('apps/api/Identity/WebAuthnEndpoints.cs', 'utf8');
const internalTls = readFileSync('apps/tls-init/initialize-internal-tls.sh', 'utf8');

const expectedFiles = [
  'apps/api/Approvals/FormalApprovalService.cs',
  'apps/api/DomainEvents/WebhookDeliveryWorker.cs',
  'apps/api/DomainEvents/WebhookManagementEndpoints.cs',
  'apps/api/Federation/FederationCancellationReceiveEndpoints.cs',
  'apps/api/Federation/FederationCapabilityClient.cs',
  'apps/api/Federation/FederationCapabilityEndpoints.cs',
  'apps/api/Federation/FederationCatalogEndpoints.cs',
  'apps/api/Federation/FederationCatalogProtocol.cs',
  'apps/api/Federation/FederationGrantCheckEndpoints.cs',
  'apps/api/Federation/FederationIdentityDiscoveryEndpoints.cs',
  'apps/api/Federation/FederationIdentityEndpoints.cs',
  'apps/api/Federation/FederationKeyRotationEndpoints.cs',
  'apps/api/Federation/FederationKeyRotationProtocol.cs',
  'apps/api/Federation/FederationKeyRotationWorker.cs',
  'apps/api/Federation/FederationOfficialAnswerReceiveEndpoints.cs',
  'apps/api/Federation/FederationOutboundDeliveryWorker.cs',
  'apps/api/Federation/FederationPeerDiscovery.cs',
  'apps/api/Federation/FederationProbeEndpoints.cs',
  'apps/api/Federation/FederationProbeProtocol.cs',
  'apps/api/Federation/FederationProgressReceiveEndpoints.cs',
  'apps/api/Federation/FederationPublicKey.cs',
  'apps/api/Federation/FederationRoutingEndpoints.cs',
  'apps/api/Federation/FederationSigningKeys.cs',
  'apps/api/Federation/FederationWorkProtocol.cs',
  'apps/api/Federation/FederationWorkReceiveEndpoints.cs',
  'apps/api/Identity/ExternalKeyStrength.cs',
  'apps/api/Identity/IdentityBootstrapEndpoints.cs',
  'apps/api/Identity/IdentityBrowserSessionEndpoints.cs',
  'apps/api/Identity/IdentityPasswordResetEndpoints.cs',
  'apps/api/Identity/IdentityProfileEndpoints.cs',
  'apps/api/Identity/IdentitySessionEndpoints.cs',
  'apps/api/Identity/IdentitySupport.cs',
  'apps/api/Identity/IdentityTotpEndpoints.cs',
  'apps/api/Identity/LoginIdentity.cs',
  'apps/api/Identity/PasswordResetGrant.cs',
  'apps/api/Identity/PasswordResetService.cs',
  'apps/api/Identity/PasswordSecurityPolicy.cs',
  'apps/api/Identity/TotpService.cs',
  'apps/api/Identity/WebAuthnEndpoints.cs',
  'apps/api/Identity/WebAuthnFlowService.cs',
  'apps/api/Licensing/LicenseService.cs',
  'apps/api/Notifications/NotificationDeliveryWorker.cs',
  'apps/api/Organization/AccessDirectoryCommandEndpoints.cs',
  'apps/api/Organization/LocalUserEndpoints.cs',
  'apps/api/Organization/SiteMemberEndpoints.cs',
  'apps/api/Platform/AdministrationApiEndpoints.cs',
  'apps/api/Platform/AdministrationUserCommandEndpoints.cs',
  'apps/api/Platform/AdministrationUserQueryEndpoints.cs',
  'apps/api/Platform/AdministrationUserSupport.cs',
  'apps/api/Platform/ApiMachineAuthentication.cs',
  'apps/api/Platform/IdentityProviderConfigurationService.cs',
  'apps/api/Platform/SmtpEndpoints.cs',
  'apps/api/Portability/PortableExportPackage.cs',
  'apps/api/Portability/PortableImportValidator.cs',
  'apps/api/ServiceRegistration.cs',
].sort();

const directCrypto = /System\.Security\.Cryptography|SHA256|HMACSHA|ECDsa|RandomNumberGenerator|Rfc2898DeriveBytes|CryptographicOperations|IDataProtection|CreateProtector|IPasswordHasher|AddDataProtection|AddFido2|AddOpenIdConnect|AddSaml2/;
function sourceFiles(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    if (path.includes('/Persistence/Migrations/')) return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.cs') ? [path] : [];
  });
}
const actualFiles = sourceFiles('apps/api')
  .filter(path => directCrypto.test(readFileSync(path, 'utf8')))
  .sort();
assert.deepEqual(actualFiles, expectedFiles,
  'Production cryptographic source usage changed; review and update the maintained inventory');

for (const label of ['ASP.NET Data Protection key ring', 'Federation signing identity',
  'Pinned federation peer keys', 'Enterprise license issuer keys', 'TLS private keys and certificates',
  'Internal transport CA and service certificates',
  'OIDC/SAML trust material and client secret', 'WebAuthn credential keys',
  'TOTP secret and recovery codes', 'Local passwords', 'Machine API credentials',
  'Webhook signing secrets', 'Password-reset grants'])
  assert.match(policy, new RegExp(`\\| ${label.replaceAll('/', '\\/')} \\|`), `Missing key inventory entry: ${label}`);

for (const primitive of ['AES-256-CBC plus HMAC-SHA-256', 'PBKDF2 through ASP.NET Identity v3',
  'PBKDF2-HMAC-SHA-256', 'ECDSA NIST P-256 with SHA-256', 'HMAC-SHA-256', 'HMAC-SHA-1',
  'SHA-256', 'OIDC RS256', 'SAML RSA-SHA256', 'WebAuthn COSE', 'TLS 1.2 and 1.3',
  'Internal P-256 TLS CA and service certificates',
  'Operating-system CSPRNG'])
  assert.ok(policy.includes(primitive), `Missing algorithm inventory entry: ${primitive}`);

assert.match(registration, /IterationCount = 220_000/, 'local password work factor');
assert.match(machine, /Iterations = 210_000/, 'machine credential work factor');
assert.match(machine, /HashAlgorithmName\.SHA256, 32/, 'machine credential PBKDF2 algorithm');
assert.match(totp, /new HMACSHA1/, 'TOTP interoperability algorithm');
assert.match(webhook, /HMACSHA256\.HashData/, 'webhook MAC algorithm');
assert.match(license, /ECDsa\.Create\(\)/, 'license public-key implementation');
assert.match(license, /verifier\.KeySize != 256/, 'license P-256 restriction');
assert.match(webAuthn, /COSE\.Algorithm\.(EdDSA|ES256)/, 'WebAuthn asymmetric allowlist');
assert.match(internalTls, /ecparam -name prime256v1/, 'internal TLS P-256 key generation');
assert.match(internalTls, /CA:TRUE,pathlen:0/, 'internal TLS constrained CA');
assert.match(internalTls, /extendedKeyUsage=serverAuth/, 'internal TLS server-only leaf purpose');
assert.match(internalTls, /extendedKeyUsage=clientAuth/, 'internal TLS database-client leaf purpose');
assert.match(internalTls, /subjectAltName=DNS:\$name/, 'internal TLS exact service DNS identity');
assert.match(internalTls, /ca_private=\/var\/lib\/fylkren-tls\/ca-private[\s\S]*api_private=\/var\/lib\/fylkren-tls\/api[\s\S]*postgres_private=\/var\/lib\/fylkren-tls\/postgres[\s\S]*database_client_private=\/var\/lib\/fylkren-tls\/database-client/, 'internal TLS private-key separation');
assert.match(internalTls, /checkend 2592000/, 'internal TLS leaf renewal boundary');

console.log(JSON.stringify({
  cryptographicInventory: 'passed',
  productionSourceFiles: actualFiles.length,
  keyAndSecretClasses: 13,
  primitiveAndCertificateClasses: 13,
  newCryptographicUsageFailsClosed: true,
}));
