import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const access = readFileSync('docs/administration/ACCESS_AND_IDENTITY.md', 'utf8');
const ssoLab = readFileSync('tools/run-identity-sso-lab.mjs', 'utf8');

assert.match(registration, /now - sessionStartedAt >= TimeSpan\.FromHours\(12\)/);
assert.doesNotMatch(registration, /ProtocolMessage\.MaxAge|GetParameter\("max_age"\)|"auth_time"|ForceAuthn/i);
assert.doesNotMatch(registration, /BackchannelLogoutUri|SignedOutCallbackPath|SingleLogout/i);
assert.match(access, /Fylkren does not request `max_age` or verify `auth_time`, `acr` or `amr`/);
assert.match(access, /Fylkren implements no SAML Single Logout/);
assert.match(access, /a later OIDC flow can authenticate without another visible credential prompt/);
assert.match(access, /a later SP-initiated flow can authenticate without another visible credential prompt/);
assert.match(access, /authentication recentness and forced upstream reauthentication remain separate controls/);
assert.match(ssoLab, /oidc|saml/i);

process.stdout.write(`${JSON.stringify({
  federatedReauthenticationAssessment: 'finding', finding: 'SV-097',
  localAbsoluteHours: 12, oidcMaxAgeRequested: false,
  oidcAuthTimeVerified: false, samlForcedReauthentication: false,
  coordinatedProviderLogout: false, documentedBoundary: true,
  signedProviderFlowsPreviouslyExercised: true,
})}\n`);
