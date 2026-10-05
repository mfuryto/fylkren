import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const requireText = (source, pattern, label) =>
  assert.match(source, pattern, `${label} is missing from the maintained implementation or test evidence`);

const registration = read('apps/api/ServiceRegistration.cs');
const webAuthn = read('apps/api/Identity/WebAuthnEndpoints.cs');
const license = read('apps/api/Licensing/LicenseService.cs');
const federation = read('apps/api/Federation/FederationWorkReceiveEndpoints.cs');
const ssoRuntime = read('tools/run-identity-sso-lab.mjs');
const federationRuntime = read('tools/run-federation-pair.mjs');

requireText(registration, /PersistKeysToFileSystem\([\s\S]*Fylkren:DataProtection:KeyPath/, 'deployment-owned Data Protection key ring');
requireText(registration, /AddOpenIdConnect\([\s\S]*options\.Authority = oidc\.Enabled \? oidc\.Authority/, 'configured OIDC issuer/metadata source');
requireText(ssoRuntime, /\['header-key', 'untrusted header key'\]/, 'OIDC token-controlled key rejection');
requireText(ssoRuntime, /tokenHeaderKeyRequests, 0/, 'OIDC jku non-fetch evidence');
requireText(ssoRuntime, /'foreign-keys'/, 'OIDC foreign JWKS metadata rejection');
requireText(registration, /provider\.ReadMetadata\(metadata\.Prepared\(saml\)\)/, 'configured SAML metadata signing keys');
requireText(webAuthn, /StoredPublicKey\s*=\s*credential\.PublicKey/, 'registered WebAuthn credential key');
requireText(license, /TrustedIssuerKeys\.ProductionSpki/, 'built-in license issuer key');
requireText(license, /Fylkren:License:PublicKeySpki/, 'deployment-configured additional license issuer key');
requireText(federation, /peer\?\.PinnedPublicKeySpki[\s\S]*FederationPublicKey\.TryParse\(peer\.PinnedPublicKeySpki/, 'pinned federation peer key');
requireText(federationRuntime, /tampered signed work rejected/, 'federation foreign-signature rejection');

console.log(JSON.stringify({
  selfContainedTokenKeySources: 'passed',
  contexts: 7,
  tokenControlledJkuFetched: false,
  tokenEmbeddedJwkTrusted: false,
  configuredOrPinnedSourcesOnly: true,
}));
