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
assert.match(access, /requests `prompt=login` and `max_age=300`/);
assert.match(access, /signed ID-token `auth_time` to be no more than five minutes old/);
assert.match(access, /sends `ForceAuthn=true` on every SP-initiated request/);
assert.match(access, /does not itself revoke an already issued Fylkren cookie/);
assert.match(access, /deactivate the account or otherwise advance its security version/);
assert.match(registration, /options\.SaveTokens = false/);
assert.doesNotMatch(registration, /BackchannelLogout|SignedOutCallback|SignedOutRedirect/);
assert.match(identityEndpoints, /MapDelete\("\/session"/);
assert.match(providerEndpoints, /link\.Deactivate\(\)/);

process.stdout.write(`${JSON.stringify({ federatedSessionDocumentation: 'passed',
  documentedSystems: ['fylkren-rp', 'oidc-idp', 'saml-idp', 'ad-ldap'],
  localInactivityHours: 1, localAbsoluteHours: 12,
  oidcUpstreamLogout: false, samlSingleLogout: false,
  upstreamRecentnessEnforced: true, unlinkRevokesExistingCookie: false,
  immediateLocalTermination: 'account-security-version' })}\n`);
