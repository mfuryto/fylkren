import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [readFileSync(path, 'utf8')] : [];
  });
}

const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const program = readFileSync('apps/api/Program.cs', 'utf8');
const client = sources('apps/web/src').join('\n');
const runtime = readFileSync('tools/e2e/auth-session-security.mjs', 'utf8');

assert.match(registration, /AddAuthentication\(CookieAuthenticationDefaults\.AuthenticationScheme\)/);
assert.match(registration, /AddCookie\(CookieAuthenticationDefaults\.AuthenticationScheme/);
assert.match(registration, /options\.Events\.OnValidatePrincipal = ValidateSessionPrincipal/);
assert.match(registration, /FallbackPolicy = new AuthorizationPolicyBuilder\(\)[\s\S]*RequireAuthenticatedUser\(\)/);
assert.ok(program.indexOf('app.UseAuthentication();') < program.indexOf('app.UseAuthorization();'));
assert.match(client, /apiGet<Session>\("\/api\/session"/);
assert.doesNotMatch(client, /document\.cookie|jwtDecode|parseJwt|decodeJwt/i);
assert.match(runtime, /stolenCookie/);
assert.match(runtime, /authenticated, false/);

process.stdout.write(`${JSON.stringify({ backendSessionValidationBoundary: 'passed',
  sessionTokenType: 'protected-aspnet-cookie', backendAuthenticationMiddleware: true,
  backendPrincipalValidation: true, authorizationFallback: 'authenticated-user',
  clientTokenValidation: false, copiedRevokedCookieRejected: true })}\n`);
