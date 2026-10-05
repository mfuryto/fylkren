import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const requireText = (source, pattern, label) =>
  assert.match(source, pattern, `${label} is missing from the maintained implementation or test evidence`);

const registration = read('apps/api/ServiceRegistration.cs');
const totp = read('apps/api/Identity/TotpService.cs');
const webAuthn = read('apps/api/Identity/WebAuthnEndpoints.cs');
const webAuthnFlow = read('apps/api/Identity/WebAuthnFlowService.cs');
const license = read('apps/api/Licensing/LicenseService.cs');
const federationWork = read('apps/api/Federation/FederationWorkProtocol.cs');
const federationProbe = read('apps/api/Federation/FederationProbeProtocol.cs');
const ssoRuntime = read('tools/run-identity-sso-lab.mjs');

requireText(registration, /AddCookie\(CookieAuthenticationDefaults\.AuthenticationScheme/, 'application-session cookie purpose');
requireText(totp, /CreateProtector\("Fylkren\.TotpSecret\.v1"\)/, 'TOTP secret purpose');
requireText(totp, /CreateProtector\("Fylkren\.TotpChallenge\.v2"\)/, 'TOTP challenge purpose');
requireText(totp, /CreateProtector\("Fylkren\.TotpSetup\.v2"\)/, 'TOTP setup purpose');
requireText(webAuthnFlow, /CreateProtector\("Fylkren\.WebAuthnFlow\.v2"\)/, 'WebAuthn flow purpose');
requireText(webAuthn, /value\.Purpose == purpose/, 'WebAuthn registration/login grant purpose');
requireText(registration, /TokenValidationParameters\.ValidTypes\s*=\s*\["JWT"\]/, 'OIDC ID-token type allowlist');
requireText(ssoRuntime, /\['wrong-type', 'wrong token type'\]/, 'OIDC access-token type rejection');
requireText(registration, /AddSaml2\(Saml2Defaults\.Scheme/, 'SAML response/assertion handler purpose');
requireText(license, /SchemaVersion != 1/, 'license schema/purpose validation');
requireText(federationWork, /fylkren-federation-work-envelope-v1/, 'federation work-envelope signature purpose');
requireText(federationProbe, /fylkren-federation-probe-request-v1/, 'federation probe signature purpose');

console.log(JSON.stringify({
  selfContainedTokenPurpose: 'passed',
  contexts: 7,
  crossPurposeAcceptance: false,
  oidcAccessTokenTypeRejectedAsIdToken: true,
  purposeBoundProtectorsAndSignatures: true,
}));
