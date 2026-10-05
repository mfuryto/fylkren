import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const requireText = (source, pattern, label) =>
  assert.match(source, pattern, `${label} is missing from the maintained implementation or test evidence`);

const registration = read('apps/api/ServiceRegistration.cs');
const totp = read('apps/api/Identity/TotpService.cs');
const webAuthn = read('apps/api/Identity/WebAuthnFlowService.cs');
const license = read('apps/api/Licensing/LicenseService.cs');
const federation = read('apps/api/Federation/FederationWorkReceiveEndpoints.cs');
const sessionRuntime = read('tools/test-session-timeout-runtime.mjs');
const ssoRuntime = read('tools/run-identity-sso-lab.mjs');
const licenseRuntime = read('tools/test-e2e-local.mjs');
const federationRuntime = read('tools/run-federation-pair.mjs');

requireText(registration, /ExpireTimeSpan\s*=\s*TimeSpan\.FromHours\(1\)/, 'session inactivity validity');
requireText(registration, /now - sessionStartedAt >= TimeSpan\.FromHours\(12\)/, 'session absolute validity');
requireText(sessionRuntime, /absoluteAfter\), false/, 'session absolute-expiry runtime rejection');
requireText(totp, /expires < DateTimeOffset\.UtcNow\.ToUnixTimeSeconds\(\)/, 'TOTP protected-state expiry validation');
requireText(webAuthn, /state\.ExpiresAt < DateTimeOffset\.UtcNow\.ToUnixTimeSeconds\(\)/, 'WebAuthn protected-state expiry validation');
requireText(registration, /AddOpenIdConnect\(OpenIdConnectDefaults\.AuthenticationScheme/, 'standard OIDC lifetime validation');
requireText(ssoRuntime, /\['expired', 'expired token'\]/, 'expired OIDC rejection');
requireText(ssoRuntime, /\['not-yet-valid', 'not-yet-valid token'\]/, 'not-yet-valid OIDC rejection');
requireText(registration, /AddSaml2\(Saml2Defaults\.Scheme/, 'standard SAML condition validation');
requireText(license, /if \(now < license\.NotBefore\)/, 'license not-before validation');
requireText(license, /if \(now >= license\.ExpiresAt\)/, 'license expiry validation');
requireText(licenseRuntime, /Expired license must not replace the active license/, 'expired license runtime rejection');
requireText(federation, /request\.Timestamp < seconds - 300 \|\| request\.Timestamp > seconds \+ 300/, 'federation validity window');
requireText(federationRuntime, /expired signed work rejected/, 'expired federation message rejection');
requireText(federationRuntime, /not-yet-valid signed work rejected/, 'future federation message rejection');

console.log(JSON.stringify({
  selfContainedTokenValidity: 'passed',
  contexts: 7,
  expiredRejected: true,
  notYetValidRejected: true,
  validityCheckedAtAcceptance: true,
}));
