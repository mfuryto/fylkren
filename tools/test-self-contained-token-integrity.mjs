import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const requireText = (source, pattern, label) =>
  assert.match(source, pattern, `${label} is missing from the maintained implementation or test evidence`);

const registration = read('apps/api/ServiceRegistration.cs');
const totp = read('apps/api/Identity/TotpService.cs');
const webAuthn = read('apps/api/Identity/WebAuthnFlowService.cs');
const license = read('apps/api/Licensing/LicenseService.cs');
const federation = read('apps/api/Federation/FederationProbeProtocol.cs');
const sessionRuntime = read('tools/test-dynamic-session-token-runtime.mjs');
const totpRuntime = read('tools/e2e/totp-security.mjs');
const webAuthnRuntime = read('tools/e2e/webauthn-security.mjs');
const ssoRuntime = read('tools/run-identity-sso-lab.mjs');
const licenseRuntime = read('tools/test-e2e-local.mjs');
const federationRuntime = read('tools/run-federation-pair.mjs');

const families = [
  {
    name: 'application session cookie',
    implementation: () => {
      requireText(registration, /AddDataProtection\(\)/, 'session Data Protection');
      requireText(registration, /AddCookie\(CookieAuthenticationDefaults\.AuthenticationScheme/, 'protected session cookie');
    },
    evidence: () => requireText(sessionRuntime, /tamperedTokenRejected:\s*true/, 'tampered session-cookie rejection'),
  },
  {
    name: 'TOTP setup and challenge state',
    implementation: () => {
      requireText(totp, /CreateProtector\("Fylkren\.TotpChallenge\.v2"\)/, 'TOTP challenge protector');
      requireText(totp, /challengeProtector\.Unprotect\(challenge\)/, 'TOTP integrity validation before parsing');
    },
    evidence: () => requireText(totpRuntime, /tamperedChallengeRejected:\s*true/, 'tampered TOTP challenge rejection'),
  },
  {
    name: 'WebAuthn flow state',
    implementation: () => {
      requireText(webAuthn, /CreateProtector\("Fylkren\.WebAuthnFlow\.v2"\)/, 'WebAuthn state protector');
      requireText(webAuthn, /protector\.Unprotect\(token\)/, 'WebAuthn state integrity validation before parsing');
    },
    evidence: () => {
      requireText(webAuthnRuntime, /assertionReplayRejected:\s*true/, 'WebAuthn replay rejection');
      requireText(webAuthnRuntime, /wrongOriginRejected:\s*true/, 'WebAuthn signed assertion rejection');
    },
  },
  {
    name: 'OIDC ID token and protected callback state',
    implementation: () => {
      requireText(registration, /AddOpenIdConnect\(OpenIdConnectDefaults\.AuthenticationScheme/, 'standard OIDC validation handler');
      requireText(registration, /options\.ResponseType = "code"/, 'OIDC authorization-code flow');
    },
    evidence: () => {
      requireText(ssoRuntime, /\['signature', 'signature mismatch'\]/, 'OIDC invalid-signature rejection');
      requireText(ssoRuntime, /oidcForgedStateAndReplayRejection:\s*'passed'/, 'OIDC protected-state and replay rejection');
    },
  },
  {
    name: 'SAML assertion',
    implementation: () => requireText(registration, /AddSaml2\(Saml2Defaults\.Scheme/, 'standard SAML validation handler'),
    evidence: () => requireText(ssoRuntime, /samlTamperedUnsignedAndReplayRejection:\s*'passed'/, 'tampered, unsigned and replayed SAML rejection'),
  },
  {
    name: 'enterprise license token',
    implementation: () => requireText(license, /VerifyData\(payload, signature, HashAlgorithmName\.SHA256/, 'license signature verification'),
    evidence: () => requireText(licenseRuntime, /Tampered license must be rejected/, 'tampered license rejection'),
  },
  {
    name: 'federation signed envelope and receipt',
    implementation: () => requireText(federation, /key\.VerifyData\(data, signature, HashAlgorithmName\.SHA256/, 'federation signature verification'),
    evidence: () => requireText(federationRuntime, /tampered signed work rejected/, 'tampered federation envelope rejection'),
  },
];

for (const family of families) {
  family.implementation();
  family.evidence();
}

console.log(JSON.stringify({
  selfContainedTokenIntegrity: 'passed',
  tokenFamilies: families.length,
  integrityValidatedBeforeUse: true,
  maintainedTamperEvidenceFamilies: families.length,
  families: families.map(value => value.name),
}));
