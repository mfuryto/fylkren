import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function collect(directory, extension) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collect(path, extension);
    return entry.name.endsWith(extension) ? [readFileSync(path, 'utf8')] : [];
  }).join('\n');
}

const api = collect('apps/api', '.cs');
const web = collect('apps/web/src', '.tsx') + collect('apps/web/src', '.ts');
const persistence = readFileSync('apps/api/Persistence/FylkrenDbContext.cs', 'utf8');
const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const profile = readFileSync('apps/web/src/profile/ProfilePage.tsx', 'utf8');
const access = readFileSync('docs/administration/ACCESS_AND_IDENTITY.md', 'utf8');

assert.match(registration, /AddCookie\(CookieAuthenticationDefaults\.AuthenticationScheme/);
assert.match(registration, /sessionIdentity\?\.SecurityVersion == securityVersion/);
assert.doesNotMatch(persistence, /DbSet<[^>]*(?:BrowserSession|UserSession|ActiveSession)/i);
assert.doesNotMatch(api, /MapGet\([^\n]*(?:active-)?sessions[^\n]*List|MapDelete\([^\n]*sessions\/{/i);
assert.doesNotMatch(web, /terminateSelectedSession|sessionDevice|sessionIpAddress|activeSessions/i);
assert.match(profile, /onClick=\{onSignOut\}/);
assert.match(access, /There is no per-session list, selective termination or oldest-session eviction/);
assert.match(access, /adding a numeric maximum requires a server-side session registry/);

process.stdout.write(`${JSON.stringify({
  userSessionManagementAssessment: 'finding', finding: 'SV-096',
  selfContainedCookies: true, serverSessionRegistry: false,
  userCanViewActiveSessions: false, selectiveTermination: false,
  explicitSignOutTerminatesAccountSessions: true,
  requiredRemediation: 'reauthenticated-server-session-registry',
})}\n`);
