import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const documentation = readFileSync('docs/administration/ACCESS_AND_IDENTITY.md', 'utf8');
const identityEndpoints = readFileSync('apps/api/Identity/IdentityEndpoints.cs', 'utf8');
const directoryEndpoints = readFileSync('apps/api/Identity/DirectoryEndpoints.cs', 'utf8');
const webauthn = readFileSync('apps/api/Identity/WebAuthnEndpoints.cs', 'utf8');
const oidc = readFileSync('apps/api/Identity/OidcEndpoints.cs', 'utf8');
const saml = readFileSync('apps/api/Identity/SamlEndpoints.cs', 'utf8');
const publicConfiguration = readFileSync('apps/api/Platform/PublicConfigurationEndpoints.cs', 'utf8');
const serviceRegistration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const machineAuthentication = readFileSync('apps/api/Platform/ApiMachineAuthentication.cs', 'utf8');

for (const pathway of ['Local password |', 'Local password plus TOTP |', 'WebAuthn/passkey |',
  'Active Directory or LDAP |', 'OIDC authorization code |', 'SAML 2.0 SP-initiated SSO |'])
  assert.ok(documentation.includes(pathway), `Authentication pathway is undocumented: ${pathway}`);
for (const limitation of ['minimum single-factor strength', 'does not require a particular `acr` or `amr`',
  'does not enforce an authentication-context class', 'does not bypass its password, MFA, rate, lockout or session controls',
  'complete inventory of interactive human sign-in pathways', 'cannot create a human browser session'])
  assert.ok(documentation.includes(limitation), `Authentication strength/fallback statement is missing: ${limitation}`);

assert.match(identityEndpoints, /MapPost\("\/session", SignIn\).*RequireRateLimiting\("authentication"\)/);
assert.match(directoryEndpoints, /MapPost\("\/api\/session\/directory", SignIn\).*RequireRateLimiting\("authentication"\)/);
assert.match(webauthn, /UserVerification = UserVerificationRequirement\.Required/);
assert.match(oidc, /Results\.Challenge[\s\S]*OpenIdConnectDefaults\.AuthenticationScheme/);
assert.match(saml, /Results\.Challenge[\s\S]*Saml2Defaults\.Scheme/);
for (const flag of ['localEnabled', 'mfaEnabled', 'oidcConfigurationEnabled', 'samlConfigurationEnabled',
  'activeDirectoryConfigurationEnabled', 'ldapConfigurationEnabled', 'webAuthnEnabled'])
  assert.ok(publicConfiguration.includes(flag), `Public pathway configuration omitted ${flag}`);

const expectedSessionWriters = new Map([
  ['DirectoryEndpoints.cs', 1], ['IdentityBootstrapEndpoints.cs', 1], ['IdentityProfileEndpoints.cs', 2],
  ['IdentitySessionEndpoints.cs', 2], ['IdentityTotpEndpoints.cs', 2], ['WebAuthnEndpoints.cs', 3],
]);
const actualSessionWriters = new Map();
for (const name of readdirSync('apps/api/Identity').filter(value => value.endsWith('.cs'))) {
  const count = (readFileSync(`apps/api/Identity/${name}`, 'utf8').match(/SignInAsync\(/g) ?? []).length;
  if (count) actualSessionWriters.set(name, count);
}
assert.deepEqual(actualSessionWriters, expectedSessionWriters,
  'A browser-session writer was added, removed or moved without authentication-pathway review');
assert.match(serviceRegistration, /OnTokenValidated[\s\S]*?context\.Principal = IdentityEndpoints\.CreatePrincipal\(identity\)/);
assert.match(serviceRegistration, /Saml2Defaults\.Scheme[\s\S]*?context\.ReplacePrincipal\(IdentityEndpoints\.CreatePrincipal\(identity/);
assert.match(machineAuthentication, /new ClaimsIdentity\(claims, "FylkrenMachine"\)/);
assert.doesNotMatch(machineAuthentication, /SignInAsync\(|CreatePrincipal\(/);

process.stdout.write(`${JSON.stringify({ authenticationPathwayDocumentation: 'passed',
  documentedPathways: 6, sharedLocalRateBoundary: true, webauthnUserVerificationRequired: true,
  providerStrengthFallbacksDocumented: 2, publicPathwayFlags: 7,
  reviewedBrowserSessionWriterFiles: actualSessionWriters.size,
  reviewedBrowserSessionWriterCalls: [...actualSessionWriters.values()].reduce((sum, value) => sum + value, 0),
  machineAuthenticationSeparated: true })}\n`);
