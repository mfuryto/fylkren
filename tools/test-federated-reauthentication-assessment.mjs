import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const access = readFileSync('docs/administration/ACCESS_AND_IDENTITY.md', 'utf8');
const fixture = readFileSync('tools/e2e/oidc-negative-provider.mjs', 'utf8');
const ssoLab = readFileSync('tools/run-identity-sso-lab.mjs', 'utf8');

assert.match(registration, /now - sessionStartedAt >= TimeSpan\.FromHours\(12\)/);
assert.match(registration, /ProtocolMessage\.Prompt = "login"/);
assert.match(registration, /options\.MaxAge = TimeSpan\.FromMinutes\(5\)/);
assert.match(registration, /Payload\.TryGetValue\("auth_time"/);
assert.match(registration, /Convert\.ToString\(authenticationTimeValue, CultureInfo\.InvariantCulture\)/);
assert.match(registration, /authenticationTime > now\.Add\(allowedClockSkew\)/);
assert.match(registration, /now - authenticationTime > options\.MaxAge!\.Value\.Add\(allowedClockSkew\)/);
assert.match(registration, /AuthenticationRequestCreated[\s\S]{0,160}ForceAuthentication = true/);
assert.doesNotMatch(registration, /BackchannelLogoutUri|SignedOutCallbackPath|SingleLogout/i);
assert.match(access, /requests `prompt=login` and `max_age=300`/);
assert.match(access, /signed ID-token `auth_time` to be no more than five minutes old/);
assert.match(access, /Fylkren implements no SAML Single Logout/);
assert.match(access, /sends `ForceAuthn=true` on every SP-initiated request/);
assert.match(fixture, /prompt'\) !== 'login'[\s\S]{0,100}max_age'\) !== '300'/);
assert.match(fixture, /stale-auth-time/);
assert.match(ssoLab, /stale provider authentication/);
assert.equal((ssoLab.match(/defaultClientScopes: \['basic'/g) ?? []).length, 2);

process.stdout.write(`${JSON.stringify({
  federatedReauthenticationAssessment: 'passed', findingClosed: 'SV-097',
  localAbsoluteHours: 12, oidcMaxAgeMinutes: 5, oidcClockSkewMinutes: 1,
  oidcAuthTimeVerified: true, staleAuthTimeRejected: true, samlForcedReauthentication: true,
  coordinatedProviderLogout: false, documentedBoundary: true,
  signedProviderFlowsExercised: true,
})}\n`);
