import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const access = readFileSync('docs/administration/ACCESS_AND_IDENTITY.md', 'utf8');
const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const identityEndpoints = readFileSync('apps/api/Identity/IdentityEndpoints.cs', 'utf8');
const providerEndpoints = readFileSync('apps/api/Platform/IdentityProviderEndpoints.cs', 'utf8');

for (const system of ['Fylkren relying party', 'OIDC identity provider', 'SAML identity provider', 'AD or LDAP directory'])
  assert.match(access, new RegExp(system));
assert.match(access, /Fylkren sign-out does not call provider logout or back-channel logout/);
assert.match(access, /implements no SAML Single Logout/);
assert.match(access, /does not request `max_age` or verify `auth_time`, `acr` or `amr`/);
assert.match(access, /does not itself revoke an already issued Fylkren cookie/);
assert.match(access, /deactivate the account or otherwise advance its security version/);
assert.match(registration, /options\.SaveTokens = false/);
assert.doesNotMatch(registration, /BackchannelLogout|SignedOutCallback|SignedOutRedirect|ProtocolMessage\.MaxAge/);
assert.match(identityEndpoints, /MapDelete\("\/session"/);
assert.match(providerEndpoints, /link\.Deactivate\(\)/);

process.stdout.write(`${JSON.stringify({ federatedSessionDocumentation: 'passed',
  documentedSystems: ['fylkren-rp', 'oidc-idp', 'saml-idp', 'ad-ldap'],
  localInactivityHours: 1, localAbsoluteHours: 12,
  oidcUpstreamLogout: false, samlSingleLogout: false,
  upstreamRecentnessEnforced: false, unlinkRevokesExistingCookie: false,
  immediateLocalTermination: 'account-security-version' })}\n`);
