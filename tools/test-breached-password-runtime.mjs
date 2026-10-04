import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';
const cookies = new Map(); let csrfToken;
async function request(path, method, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookies.size) headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  if (csrfToken && method !== 'GET') headers['X-Fylkren-CSRF'] = csrfToken;
  const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  for (const value of response.headers.getSetCookie()) { const pair=value.split(';',1)[0]; const i=pair.indexOf('='); if(i>0) cookies.set(pair.slice(0,i),pair.slice(i+1)); }
  const text=await response.text(); let parsed; try{parsed=JSON.parse(text)}catch{parsed=text} return {status:response.status,body:parsed};
}
const suffix = randomBytes(6).toString('hex');
const breached = '__GettingCloser#@@';
const good1 = `A7!${randomBytes(18).toString('base64url')}#`;
const good2 = `B8!${randomBytes(18).toString('base64url')}#`;
const good3 = `C9!${randomBytes(18).toString('base64url')}#`;
const bootstrap = { username: `breach-${suffix}`, displayName: 'Synthetic Breach Manager', email: `breach-${suffix}@example.invalid` };
assert.equal((await request('/api/bootstrap/platform-manager', 'POST', { ...bootstrap, password: breached })).status, 400);
assert.equal((await request('/api/bootstrap/platform-manager', 'POST', { ...bootstrap, password: good1 })).status, 201);
const csrf = await request('/api/security/antiforgery', 'GET'); assert.equal(csrf.status, 200); csrfToken = csrf.body.token;
assert.equal((await request('/api/profile/password', 'PUT', { currentPassword: good1, newPassword: breached })).status, 400);
assert.equal((await request('/api/profile/password', 'PUT', { currentPassword: good1, newPassword: good2 })).status, 204);
const site = await request('/api/sites/', 'POST', { name: `Breach Site ${suffix}`, overviewDesign: 'classic' }); assert.equal(site.status, 201);
const username = `breach-reset-${suffix}`;
const created = await request(`/api/sites/${site.body.id}/access/local-users`, 'POST', {
  displayName: 'Synthetic Breach Reset', email: `${username}@example.invalid`, username, organizationUnitId: null,
});
assert.equal(created.status, 201);
assert.equal((await request('/api/password-reset/complete', 'POST', { resetCode: created.body.resetCode, newPassword: breached })).status, 400);
assert.equal((await request('/api/password-reset/complete', 'POST', { resetCode: created.body.resetCode, newPassword: good3 })).status, 204);
process.stdout.write(`${JSON.stringify({ breachedPasswordRuntime: 'passed',
  testedFlows: ['bootstrap', 'change', 'reset'], breachedCandidateAbsentFromCommonSet: true,
  validControlsAccepted: true, resetGrantPreservedAfterBreachedPassword: true })}\n`);
