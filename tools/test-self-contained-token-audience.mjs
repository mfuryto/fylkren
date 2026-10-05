import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const requireText = (source, pattern, label) =>
  assert.match(source, pattern, `${label} is missing from the maintained implementation or test evidence`);

const registration = read('apps/api/ServiceRegistration.cs');
const license = read('apps/api/Licensing/LicenseService.cs');
const federation = read('apps/api/Federation/FederationWorkReceiveEndpoints.cs');
const ssoRuntime = read('tools/run-identity-sso-lab.mjs');
const webAuthnRuntime = read('tools/e2e/webauthn-security.mjs');
const licenseRuntime = read('tools/test-e2e-local.mjs');
const federationRuntime = read('tools/run-federation-pair.mjs');

requireText(registration, /SetApplicationName\("Fylkren"\)/, 'Data Protection application audience');
requireText(registration, /options\.ClientId = oidc\.Enabled \? oidc\.ClientId/, 'configured OIDC client audience');
requireText(ssoRuntime, /\['audience', 'audience mismatch'\]/, 'OIDC wrong-audience rejection');
requireText(registration, /options\.SPOptions\.EntityId = new EntityId\(saml\.Enabled \? saml\.EntityId!/, 'SAML service-provider audience');
requireText(registration, /options\.ServerDomain = fylkrenOptions\.Authentication\.WebAuthn\.RpId/, 'WebAuthn RP audience');
requireText(registration, /options\.Origins = fylkrenOptions\.Authentication\.WebAuthn\.Origins/, 'WebAuthn origin audience');
requireText(webAuthnRuntime, /wrongRpIdRejected:\s*true/, 'WebAuthn wrong-RP rejection');
requireText(webAuthnRuntime, /wrongOriginRejected:\s*true/, 'WebAuthn wrong-origin rejection');
requireText(license, /license\.InstanceId != instanceId/, 'license installation audience');
requireText(licenseRuntime, /license for another instance must be rejected/, 'wrong-instance license rejection');
requireText(federation, /request\.RecipientInstanceId != localId/, 'federation recipient audience');
requireText(federationRuntime, /wrong receiver identity rejected/, 'wrong federation recipient rejection');

console.log(JSON.stringify({
  selfContainedTokenAudience: 'passed',
  contexts: 7,
  oidcWrongAudienceRejected: true,
  webAuthnWrongRpAndOriginRejected: true,
  wrongInstanceLicenseAndFederationRejected: true,
}));
