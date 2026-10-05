import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';
function client(userAgent) {
  const cookies = new Map(); let csrfToken;
  async function request(path, options = {}) {
    const headers = { 'User-Agent': userAgent, ...(options.headers ?? {}) };
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
    post: (path, body) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    delete: (path, body) => request(path, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    async csrf() { const result = await request('/api/security/antiforgery'); assert.equal(result.status, 200); csrfToken = result.body.token; },
  };
}

const suffix = randomBytes(6).toString('hex');
const username = `session-owner-${suffix}`;
const password = `A7!${randomBytes(18).toString('base64url')}#`;
const first = client('Fylkren session fixture A');
assert.equal((await first.post('/api/bootstrap/platform-manager', {
  username, password, displayName: 'Synthetic Session Owner', email: `${username}@example.invalid`,
})).status, 201);
const second = client('Fylkren session fixture B');
const third = client('Fylkren session fixture C');
assert.equal((await second.post('/api/session', { username, password })).status, 204);
assert.equal((await third.post('/api/session', { username, password })).status, 204);
await first.csrf(); await second.csrf(); await third.csrf();

const listed = await first.request('/api/profile/sessions');
assert.equal(listed.status, 200, JSON.stringify(listed.body));
assert.equal(listed.body.length, 3);
assert.equal(listed.body.filter(value => value.current).length, 1);
const secondSession = listed.body.find(value => value.userAgent === 'Fylkren session fixture B');
assert.ok(secondSession && !secondSession.current);
assert.equal((await first.delete(`/api/profile/sessions/${secondSession.id}`, { currentPassword: password })).status, 204);
assert.equal((await second.request('/api/session')).body.authenticated, false);
assert.equal((await first.request('/api/session')).body.authenticated, true);
assert.equal((await third.request('/api/session')).body.authenticated, true);

const otherUsername = `session-other-${suffix}`;
const manager = first;
const site = await manager.post('/api/sites/', { name: `Session Ownership ${suffix}`, overviewDesign: 'classic' });
assert.equal(site.status, 201, JSON.stringify(site.body));
const created = await manager.post(`/api/sites/${site.body.id}/access/local-users`, {
  displayName: 'Synthetic Other Session', email: `${otherUsername}@example.invalid`, username: otherUsername, organizationUnitId: null,
});
assert.equal(created.status, 201, JSON.stringify(created.body));
const otherPassword = `B8!${randomBytes(18).toString('base64url')}#`;
const reset = client('reset fixture');
assert.equal((await reset.post('/api/password-reset/complete', { resetCode: created.body.resetCode, newPassword: otherPassword })).status, 204);
const other = client('Fylkren other account fixture');
assert.equal((await other.post('/api/session', { username: otherUsername, password: otherPassword })).status, 204);
const otherList = await other.request('/api/profile/sessions');
assert.equal(otherList.status, 200);
assert.equal((await first.delete(`/api/profile/sessions/${otherList.body[0].id}`, { currentPassword: password })).status, 404);
assert.equal((await other.request('/api/session')).body.authenticated, true);

const all = await first.delete('/api/profile/sessions', { currentPassword: password });
assert.equal(all.status, 204, JSON.stringify(all.body));
assert.equal((await first.request('/api/session')).body.authenticated, false);
assert.equal((await third.request('/api/session')).body.authenticated, false);
assert.equal((await other.request('/api/session')).body.authenticated, true);

assert.equal(process.env.FYLKREN_COMPOSE_PROJECT, 'fylkren-edition-e2e');
const auditEvents = execFileSync('docker', ['compose', '-p', 'fylkren-edition-e2e', 'exec', '-T', 'postgres',
  'psql', '-U', 'fylkren', '-d', 'fylkren', '-tA', '-v', 'ON_ERROR_STOP=1', '-c',
  "SELECT event_type FROM audit_events WHERE event_type IN ('browser-session.revoked','browser-sessions.revoked') ORDER BY event_type;"],
{ encoding: 'utf8' }).trim().split('\n');
assert.deepEqual(auditEvents, ['browser-session.revoked', 'browser-sessions.revoked'].sort());

process.stdout.write(`${JSON.stringify({
  userSessionManagementRuntime: 'passed', visibleSessions: 3, currentSessionIdentified: true,
  selectedSessionRevoked: true, unrelatedSessionPreserved: true, crossAccountAccessRejected: true,
  allOwnSessionsRevoked: true, reauthentication: 'current-password-or-five-minute-fresh-session', auditEventsRecorded: true,
})}\n`);
