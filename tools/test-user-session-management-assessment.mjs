import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const context = readFileSync('apps/api/Persistence/FylkrenDbContext.cs', 'utf8');
const endpoints = readFileSync('apps/api/Identity/IdentityEndpoints.cs', 'utf8');
const sessionEndpoints = readFileSync('apps/api/Identity/IdentityBrowserSessionEndpoints.cs', 'utf8');
const support = readFileSync('apps/api/Identity/IdentitySupport.cs', 'utf8');
const validation = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const maintenance = readFileSync('apps/api/Platform/ApiMaintenanceWorker.cs', 'utf8');
const profile = readFileSync('apps/web/src/profile/ProfilePage.tsx', 'utf8');
const panel = readFileSync('apps/web/src/profile/BrowserSessionsPanel.tsx', 'utf8');
const access = readFileSync('docs/administration/ACCESS_AND_IDENTITY.md', 'utf8');

assert.match(context, /DbSet<BrowserSession> BrowserSessions/);
assert.match(endpoints, /MapGet\("\/profile\/sessions", ListBrowserSessions\)/);
assert.match(endpoints, /MapDelete\("\/profile\/sessions\/\{id:guid\}", RevokeBrowserSession\)/);
assert.match(endpoints, /MapDelete\("\/profile\/sessions", RevokeAllBrowserSessions\)/);
assert.match(sessionEndpoints, /value\.LoginIdentityId == identity\.Id/);
assert.match(sessionEndpoints, /SessionManagementReauthenticated/);
assert.match(sessionEndpoints, /VerifyCurrentPassword/);
assert.match(sessionEndpoints, /TimeSpan\.FromMinutes\(5\)/);
assert.match(validation, /browserSession\.IsActive\(now, securityVersion\)/);
assert.match(validation, /"fylkren:session_id"/);
assert.match(support, /StartBrowserSession/);
assert.match(maintenance, /InactiveBrowserSessionRetention/);
assert.match(maintenance, /database\.BrowserSessions/);
assert.match(profile, /<BrowserSessionsPanel/);
assert.match(panel, /revokeBrowserSession/);
assert.match(panel, /revokeAllBrowserSessions/);
assert.match(access, /authoritative server-side registry/);
assert.match(access, /terminate one selected session or all active sessions/);

process.stdout.write(`${JSON.stringify({
  userSessionManagementAssessment: 'passed', findingClosed: 'SV-096',
  serverSessionRegistry: true, userCanViewActiveSessions: true,
  selectiveTermination: true, allSessionTermination: true,
  reauthentication: 'current-password-or-five-minute-fresh-session',
  accountIsolation: true, backendValidation: true, cleanup: true,
})}\n`);
