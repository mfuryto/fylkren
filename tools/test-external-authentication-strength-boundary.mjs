import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const access = readFileSync('docs/administration/ACCESS_AND_IDENTITY.md', 'utf8');
const ssoLab = readFileSync('tools/run-identity-sso-lab.mjs', 'utf8');

assert.match(access, /OIDC authorization code[\s\S]*minimum single-factor strength[\s\S]*`acr`, `amr` or `auth_time`/);
assert.match(access, /SAML 2\.0 SP-initiated SSO[\s\S]*minimum single-factor strength[\s\S]*does not enforce an authentication-context class/);
assert.match(access, /Do not use this pathway as application-enforced step-up authentication/g);
assert.doesNotMatch(registration, /FindFirst\("(?:acr|amr|auth_time)"\)|RequireClaim\("(?:acr|amr|auth_time)"\)|AuthnContextClassRef|RequestedAuthnContext/);
assert.match(registration, /context\.Principal = IdentityEndpoints\.CreatePrincipal\(identity\)/);
assert.match(registration, /external-authentication-rejected/);
assert.match(ssoLab, /OIDC/); assert.match(ssoLab, /SAML/);

process.stdout.write(`${JSON.stringify({ externalAuthenticationStrengthBoundary: 'passed',
  providers: ['oidc', 'saml'], specificStrengthExpected: false,
  documentedFallback: 'minimum-single-factor', stepUpAuthorization: false,
  strengthClaimsUsedForElevation: [], providerFailureFailsClosed: true })}\n`);
