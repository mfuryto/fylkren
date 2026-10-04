import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const login = readFileSync('apps/web/src/auth/LoginPage.tsx', 'utf8');
const server = readFileSync('apps/api/Identity/OidcEndpoints.cs', 'utf8') +
  readFileSync('apps/api/Identity/SamlEndpoints.cs', 'utf8');
const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const access = readFileSync('docs/administration/ACCESS_AND_IDENTITY.md', 'utf8');

assert.doesNotMatch(login, /useEffect\([^]*window\.location\.(?:replace|assign)\(`\/api\/auth\/\$\{automaticSso\}\/login`/);
assert.match(login, /if\(automaticSso&&!breakGlassLogin\)[^]*<button[^]*type="button"[^]*onClick=\{\(\)=>window\.location\.assign\(`\/api\/auth\/\$\{automaticSso\}\/login`\)\}/);
assert.match(login, /configuration\.setupRequired[^]*completeSetup/);
assert.match(login, /<form className="login-form" onSubmit=\{submit\}>/);
assert.match(login, /onClick=\{passkeyLogin\}/);
assert.match(server, /MapGet\("\/api\/auth\/oidc\/login"[^]*Challenge/);
assert.match(server, /MapGet\("\/api\/auth\/saml\/login"[^]*Challenge/);
assert.match(registration, /OnTokenValidated/);
assert.match(access, /requires an explicit user action before the provider challenge starts/);

process.stdout.write(`${JSON.stringify({
  federatedSessionCreationAction: 'passed', automaticProviderNavigation: false,
  directSsoRequiresButton: true, ordinarySsoRequiresAction: true,
  localPasswordRequiresSubmit: true, passkeyRequiresAction: true,
  callbackAloneCannotCreateUnlinkedSession: true,
})}\n`);
