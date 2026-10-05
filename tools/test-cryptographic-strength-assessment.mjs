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
assert.match(policy, /SV-102/, 'tracked RSA strength finding');
assert.match(registration, /EncryptionAlgorithm\.AES_256_CBC/, 'AES-256 Data Protection');
assert.match(registration, /ValidationAlgorithm\.HMACSHA256/, 'HMAC-SHA-256 Data Protection');
assert.match(license, /verifier\.KeySize != 256/, 'P-256 license restriction');
assert.match(federation, /ECDsa\.Create\(ECCurve\.NamedCurves\.nistP256\)/, 'P-256 federation generation');
assert.match(webAuthn, /COSE\.Algorithm\.EdDSA/, '128-bit WebAuthn EdDSA option');
assert.match(webAuthn, /COSE\.Algorithm\.RS256/, 'RSA WebAuthn option requiring key-size assessment');
assert.match(negativeOidc, /modulusLength: 2048/, 'accepted-provider RSA-2048 test fixture');
assert.doesNotMatch(registration, /IssuerSigningKeyValidator|rsaKeySize|KeySize\s*>?=\s*3072/,
  'OIDC RSA minimum is now enforced; reassess SV-102');
assert.doesNotMatch(registration, /saml[\s\S]{0,300}KeySize\s*>?=\s*3072/i,
  'SAML RSA minimum is now enforced; reassess SV-102');

console.log(JSON.stringify({
  cryptographicStrengthAssessment: 'finding',
  finding: 'SV-102',
  localSymmetricAndEcMinimumBits: 128,
  externalRsaMinimumBitsEnforced: false,
  acceptedRsa2048ClassicalStrengthBits: 112,
}));
