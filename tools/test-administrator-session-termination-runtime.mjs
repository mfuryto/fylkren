import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';
function client() {
  const cookies = new Map(); let csrfToken;
  async function request(path, options = {}) {
    const headers = { ...(options.headers ?? {}) };
    if (cookies.size) headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    if (csrfToken && options.method && options.method !== 'GET') headers['X-Fylkren-CSRF'] = csrfToken;
    const response = await fetch(`${base}${path}`, { ...options, headers, redirect: 'manual' });
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(';', 1)[0]; const separator = pair.indexOf('=');
      if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    const text = await response.text(); let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: response.status, body };
  }
  return {
    request,
    post: (path, body) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }),
    async csrf() { const result = await request('/api/security/antiforgery'); assert.equal(result.status, 200); csrfToken = result.body.token; },
  };
}

const suffix = randomBytes(6).toString('hex');
const managerUsername = `session-admin-${suffix}`;
const managerPassword = `A7!${randomBytes(18).toString('base64url')}#`;
const manager = client();
assert.equal((await manager.post('/api/bootstrap/platform-manager', {
  username: managerUsername, password: managerPassword,
  displayName: 'Synthetic Session Administrator', email: `${managerUsername}@example.invalid`,
})).status, 201);
await manager.csrf();
const site = await manager.post('/api/sites/', { name: `Session Termination ${suffix}`, overviewDesign: 'classic' });
assert.equal(site.status, 201, JSON.stringify(site.body));

async function createUser(label) {
  const username = `${label}-${suffix}`;
  const created = await manager.post(`/api/sites/${site.body.id}/access/local-users`, {
    displayName: `Synthetic ${label}`, email: `${username}@example.invalid`, username, organizationUnitId: null,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const password = `B8!${randomBytes(18).toString('base64url')}#`;
  const anonymous = client();
  const completed = await anonymous.post('/api/password-reset/complete', { resetCode: created.body.resetCode, newPassword: password });
  assert.equal(completed.status, 204, JSON.stringify(completed.body));
  const session = client();
  assert.equal((await session.post('/api/session', { username, password })).status, 204);
  return { personId: created.body.member.id, session };
}

const first = await createUser('individual-session');
const second = await createUser('global-session');
const parallelManager = client();
assert.equal((await parallelManager.post('/api/session', { username: managerUsername, password: managerPassword })).status, 204);

const individual = await manager.post(`/api/platform/identity/users/${first.personId}/terminate-sessions`);
assert.equal(individual.status, 200, JSON.stringify(individual.body));
assert.equal((await first.session.request('/api/session')).body.authenticated, false);
assert.equal((await second.session.request('/api/session')).body.authenticated, true);
assert.equal((await parallelManager.request('/api/session')).body.authenticated, true);

const all = await manager.post('/api/platform/identity/users/terminate-sessions');
assert.equal(all.status, 200, JSON.stringify(all.body));
assert.ok(all.body.terminatedIdentities >= 3);
assert.equal((await second.session.request('/api/session')).body.authenticated, false);
assert.equal((await parallelManager.request('/api/session')).body.authenticated, false);
assert.equal((await manager.request('/api/session')).body.authenticated, false);

assert.equal(process.env.FYLKREN_COMPOSE_PROJECT, 'fylkren-edition-e2e');
const auditEvents = execFileSync('docker', ['compose', '-p', 'fylkren-edition-e2e', 'exec', '-T', 'postgres',
  'psql', '-U', 'fylkren', '-d', 'fylkren', '-tA', '-v', 'ON_ERROR_STOP=1', '-c',
  "SELECT event_type FROM audit_events WHERE event_type IN ('platform-user.sessions-terminated','platform.sessions-terminated-all') ORDER BY event_type;"],
{ encoding: 'utf8' }).trim().split('\n');
assert.deepEqual(auditEvents, ['platform-user.sessions-terminated', 'platform.sessions-terminated-all'].sort());

process.stdout.write(`${JSON.stringify({
  administratorSessionTerminationRuntime: 'passed', individualUserOnly: true,
  unrelatedUserPreservedBeforeGlobalAction: true, allUsersTerminated: true,
  actingAdministratorTerminatedByGlobalAction: true, auditEventsRecorded: true,
})}\n`);
