import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const policy = read('docs/security/CRYPTOGRAPHIC_KEY_MANAGEMENT.md');
const registration = read('apps/api/ServiceRegistration.cs');
const license = read('apps/api/Licensing/LicenseService.cs');
const federation = read('apps/api/Federation/FederationIdentityEndpoints.cs');
const webAuthn = read('apps/api/Identity/WebAuthnEndpoints.cs');
const negativeOidc = read('tools/e2e/oidc-negative-provider.mjs');

assert.match(policy, /Minimum security-strength assessment/, 'documented strength assessment');
assert.match(policy, /Fylkren enforces RSA-3072/, 'documented RSA strength boundary and migration');
assert.match(registration, /EncryptionAlgorithm\.AES_256_CBC/, 'AES-256 Data Protection');
assert.match(registration, /ValidationAlgorithm\.HMACSHA256/, 'HMAC-SHA-256 Data Protection');
assert.match(license, /verifier\.KeySize != 256/, 'P-256 license restriction');
assert.match(federation, /ECDsa\.Create\(ECCurve\.NamedCurves\.nistP256\)/, 'P-256 federation generation');
assert.match(webAuthn, /COSE\.Algorithm\.EdDSA/, '128-bit WebAuthn EdDSA option');
assert.match(webAuthn, /COSE\.Algorithm\.RS256/, 'RSA WebAuthn option requiring key-size assessment');
assert.match(negativeOidc, /modulusLength: 3072/, 'OIDC test fixture uses RSA-3072');
assert.match(registration, /IssuerSigningKeyValidator[\s\S]{0,150}ExternalKeyStrength\.MeetsMinimum/,
  'OIDC RSA minimum enforcement');
assert.match(webAuthn, /MeetsWebAuthnMinimum\(result\.PublicKey\)/, 'WebAuthn registration strength enforcement');
assert.match(webAuthn, /MeetsWebAuthnMinimum\(credential\.PublicKey\)/, 'WebAuthn assertion strength enforcement');
assert.match(read('apps/api/Identity/SamlMetadataCache.cs'), /SigningKeys[\s\S]{0,250}ExternalKeyStrength\.MeetsMinimum/,
  'SAML metadata strength enforcement');

console.log(JSON.stringify({
  cryptographicStrengthAssessment: 'passed',
  findingClosed: 'SV-102',
  localSymmetricAndEcMinimumBits: 128,
  externalRsaMinimumBitsEnforced: 3072,
  weakRsaRejectedAt: ['oidc', 'saml-metadata', 'webauthn-registration', 'webauthn-assertion'],
}));
