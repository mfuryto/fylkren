import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';
const cookies = new Map(); let csrfToken;
async function request(path, method = 'GET', body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookies.size) headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  if (csrfToken && method !== 'GET') headers['X-Fylkren-CSRF'] = csrfToken;
  const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  for (const value of response.headers.getSetCookie()) { const pair=value.split(';',1)[0]; const i=pair.indexOf('='); if(i>0) cookies.set(pair.slice(0,i),pair.slice(i+1)); }
  const text=await response.text(); let parsed; try{parsed=JSON.parse(text)}catch{parsed=text} return {status:response.status,body:parsed};
}
function expire(username) {
  assert.equal(process.env.FYLKREN_COMPOSE_PROJECT, 'fylkren-edition-e2e');
  const sql = `UPDATE password_reset_grants g SET expires_at=now()-interval '1 second' FROM login_identities i WHERE g.login_identity_id=i.id AND i.normalized_username='${username.toUpperCase()}';`;
  const output = execFileSync('docker', ['compose', '-p', 'fylkren-edition-e2e', 'exec', '-T', 'postgres',
    'psql', '-U', 'fylkren', '-d', 'fylkren', '-tA', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' });
  assert.match(output, /UPDATE 1/);
}

const suffix = randomBytes(6).toString('hex');
const initialPassword = `A7!${randomBytes(18).toString('base64url')}#`;
assert.equal((await request('/api/bootstrap/platform-manager', 'POST', {
  username: `reset-expiry-manager-${suffix}`, password: initialPassword,
  displayName: 'Synthetic Reset Expiry Manager', email: `reset-expiry-manager-${suffix}@example.invalid`,
})).status, 201);
const csrf = await request('/api/security/antiforgery'); assert.equal(csrf.status, 200); csrfToken = csrf.body.token;
const site = await request('/api/sites/', 'POST', { name: `Reset Expiry Site ${suffix}`, overviewDesign: 'classic' });
assert.equal(site.status, 201);
async function create(label) {
  const username = `${label}-${suffix}`;
  const result = await request(`/api/sites/${site.body.id}/access/local-users`, 'POST', {
    displayName: `Synthetic ${label}`, email: `${username}@example.invalid`, username, organizationUnitId: null,
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return { username, resetCode: result.body.resetCode };
}
const fresh = await create('fresh-reset');
const expired = await create('expired-reset');
const freshPassword = `B8!${randomBytes(18).toString('base64url')}#`;
const expiredCandidate = `C9!${randomBytes(18).toString('base64url')}#`;
assert.equal((await request('/api/password-reset/complete', 'POST', { resetCode: fresh.resetCode, newPassword: freshPassword })).status, 204);
expire(expired.username);
const expiredResult = await request('/api/password-reset/complete', 'POST', { resetCode: expired.resetCode, newPassword: expiredCandidate });
assert.equal(expiredResult.status, 400);
assert.match(JSON.stringify(expiredResult.body), /invalid or expired/i);
cookies.clear(); csrfToken = undefined;
assert.equal((await request('/api/session', 'POST', { username: fresh.username, password: freshPassword })).status, 204);
cookies.clear();
assert.equal((await request('/api/session', 'POST', { username: expired.username, password: expiredCandidate })).status, 401);

process.stdout.write(`${JSON.stringify({ passwordResetExpiryRuntime: 'passed',
  freshGrantAccepted: true, expiredGrantRejected: true,
  expiredGrantDidNotSetPassword: true, testedLifetimeMinutes: 30 })}\n`);
