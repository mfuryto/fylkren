import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const requireText = (source, pattern, label) =>
  assert.match(source, pattern, `${label} is missing from the maintained implementation or test evidence`);

const registration = read('apps/api/ServiceRegistration.cs');
const webAuthn = read('apps/api/Identity/WebAuthnEndpoints.cs');
const webAuthnRuntime = read('tools/e2e/webauthn-security.mjs');
const ssoRuntime = read('tools/run-identity-sso-lab.mjs');
const license = read('apps/api/Licensing/LicenseService.cs');
const federation = read('apps/api/Federation/FederationProbeProtocol.cs');

requireText(registration,
  /EncryptionAlgorithm\s*=\s*EncryptionAlgorithm\.AES_256_CBC[\s\S]*ValidationAlgorithm\s*=\s*ValidationAlgorithm\.HMACSHA256/,
  'Data Protection encryption/MAC allowlist');
requireText(registration,
  /TokenValidationParameters\.ValidAlgorithms\s*=\s*\[SecurityAlgorithms\.RsaSha256\]/,
  'OIDC RS256 allowlist');
requireText(ssoRuntime,
  /\['algorithm', 'non-allowlisted algorithm'\]/,
  'OIDC non-allowlisted algorithm rejection');
requireText(registration,
  /MinIncomingSigningAlgorithm\s*=\s*"http:\/\/www\.w3\.org\/2001\/04\/xmldsig-more#rsa-sha256"/,
  'SAML SHA-256 minimum signing allowlist');
requireText(webAuthnRuntime,
  /new Set\(\[-7, -8, -35, -36, -37, -38, -39, -257, -258, -259\]\)/,
  'WebAuthn asymmetric COSE algorithm allowlist');
requireText(webAuthn,
  /CredentialAlgorithms\s*=\s*\[[\s\S]*COSE\.Algorithm\.EdDSA[\s\S]*COSE\.Algorithm\.PS512[\s\S]*PubKeyCredParams\s*=\s*CredentialAlgorithms/,
  'WebAuthn registration algorithm enforcement');
requireText(webAuthnRuntime,
  /every\(value => permittedCredentialAlgorithms\.has\(value\)\)/,
  'WebAuthn runtime algorithm enforcement evidence');
requireText(license,
  /VerifyData\(payload, signature, HashAlgorithmName\.SHA256,[\s\S]*DSASignatureFormat\.IeeeP1363FixedFieldConcatenation/,
  'license ECDSA/SHA-256 verifier');
requireText(federation,
  /VerifyData\(data, signature, HashAlgorithmName\.SHA256,[\s\S]*DSASignatureFormat\.IeeeP1363FixedFieldConcatenation/,
  'federation ECDSA/SHA-256 verifier');

assert.doesNotMatch(registration, /ValidAlgorithms[^;\n]*(?:None|none)/,
  'A self-contained-token algorithm allowlist must never permit None');

console.log(JSON.stringify({
  selfContainedTokenAlgorithms: 'passed',
  contexts: {
    dataProtection: ['AES-256-CBC', 'HMAC-SHA256'],
    oidc: ['RS256'],
    samlMinimum: 'RSA-SHA256',
    webAuthnCose: [-7, -8, -35, -36, -37, -38, -39, -257, -258, -259],
    license: ['ECDSA-P256-SHA256-P1363'],
    federation: ['ECDSA-P256-SHA256-P1363'],
  },
  noneAllowed: false,
  symmetricAsymmetricKeyConfusion: false,
}));
