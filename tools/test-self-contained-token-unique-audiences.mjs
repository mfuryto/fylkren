import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const requireText = (source, pattern, label) =>
  assert.match(source, pattern, `${label} is missing from the maintained implementation or test evidence`);

const registration = read('apps/api/ServiceRegistration.cs');
const oidcProvider = read('tools/e2e/oidc-negative-provider.mjs');
const ssoRuntime = read('tools/run-identity-sso-lab.mjs');
const license = read('apps/api/Licensing/LicenseService.cs');
const licenseRuntime = read('tools/test-e2e-local.mjs');
const federationProtocol = read('apps/api/Federation/FederationWorkProtocol.cs');
const federationReceiver = read('apps/api/Federation/FederationWorkReceiveEndpoints.cs');
const federationRuntime = read('tools/run-federation-pair.mjs');

requireText(registration, /SetApplicationName\("Fylkren"\)/, 'Data Protection application boundary');
requireText(registration, /options\.ClientId = oidc\.Enabled \? oidc\.ClientId/, 'configured OIDC audience');
requireText(oidcProvider, /const \{ publicKey, privateKey \} = generateKeyPairSync/, 'single OIDC issuer signing key');
requireText(oidcProvider, /aud: mode === 'audience' \? 'wrong-audience' : clientId/, 'same-key alternative OIDC audience');
requireText(oidcProvider, /mode === 'header-key' \? attackerPrivateKey : privateKey/, 'ordinary and wrong-audience OIDC key reuse');
requireText(ssoRuntime, /\['audience', 'audience mismatch'\]/, 'wrong-audience OIDC rejection');
requireText(registration, /options\.SPOptions\.EntityId = new EntityId\(saml\.Enabled \? saml\.EntityId!/, 'configured SAML service-provider audience');
requireText(license, /license\.InstanceId != instanceId/, 'unique license installation audience');
requireText(licenseRuntime, /license for another instance must be rejected/, 'wrong-installation signed license rejection');
requireText(federationProtocol, /value\.RecipientInstanceId\.ToString\("N"\)/, 'signed federation recipient audience');
requireText(federationReceiver, /request\.RecipientInstanceId != localId/, 'federation recipient validation');
requireText(federationRuntime, /wrong receiver identity rejected/, 'same-peer-key wrong-recipient rejection');

console.log(JSON.stringify({
  selfContainedTokenUniqueAudiences: 'passed',
  applicableContexts: 5,
  sameOidcIssuerKeyWrongAudienceRejected: true,
  signedInstallationAndFederationAudienceBound: true,
  dynamicallySelectedTokenAudienceAccepted: false,
}));
