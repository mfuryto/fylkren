import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const documentation = readFileSync('docs/administration/ACCESS_AND_IDENTITY.md', 'utf8');
const identityEndpoints = readFileSync('apps/api/Identity/IdentityEndpoints.cs', 'utf8');
const directoryEndpoints = readFileSync('apps/api/Identity/DirectoryEndpoints.cs', 'utf8');
const webauthn = readFileSync('apps/api/Identity/WebAuthnEndpoints.cs', 'utf8');
const oidc = readFileSync('apps/api/Identity/OidcEndpoints.cs', 'utf8');
const saml = readFileSync('apps/api/Identity/SamlEndpoints.cs', 'utf8');
const publicConfiguration = readFileSync('apps/api/Platform/PublicConfigurationEndpoints.cs', 'utf8');

for (const pathway of ['Local password |', 'Local password plus TOTP |', 'WebAuthn/passkey |',
  'Active Directory or LDAP |', 'OIDC authorization code |', 'SAML 2.0 SP-initiated SSO |'])
  assert.ok(documentation.includes(pathway), `Authentication pathway is undocumented: ${pathway}`);
for (const limitation of ['minimum single-factor strength', 'does not require a particular `acr`, `amr` or `auth_time`',
  'does not enforce an authentication-context class', 'does not bypass its password, MFA, rate, lockout or session controls'])
  assert.ok(documentation.includes(limitation), `Authentication strength/fallback statement is missing: ${limitation}`);

assert.match(identityEndpoints, /MapPost\("\/session", SignIn\).*RequireRateLimiting\("authentication"\)/);
assert.match(directoryEndpoints, /MapPost\("\/api\/session\/directory", SignIn\).*RequireRateLimiting\("authentication"\)/);
assert.match(webauthn, /UserVerification = UserVerificationRequirement\.Required/);
assert.match(oidc, /Results\.Challenge[\s\S]*OpenIdConnectDefaults\.AuthenticationScheme/);
assert.match(saml, /Results\.Challenge[\s\S]*Saml2Defaults\.Scheme/);
for (const flag of ['localEnabled', 'mfaEnabled', 'oidcConfigurationEnabled', 'samlConfigurationEnabled',
  'activeDirectoryConfigurationEnabled', 'ldapConfigurationEnabled', 'webAuthnEnabled'])
  assert.ok(publicConfiguration.includes(flag), `Public pathway configuration omitted ${flag}`);

process.stdout.write(`${JSON.stringify({ authenticationPathwayDocumentation: 'passed',
  documentedPathways: 6, sharedLocalRateBoundary: true, webauthnUserVerificationRequired: true,
  providerStrengthFallbacksDocumented: 2, publicPathwayFlags: 7 })}\n`);
