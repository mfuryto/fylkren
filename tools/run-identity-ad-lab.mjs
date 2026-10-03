import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const project = 'fylkren-identity-ad-lab';
const base = 'http://localhost:18091';
const fixture = JSON.parse(readFileSync(new URL('./e2e/license-fixture.json', import.meta.url), 'utf8'));
const adAdminPassword = `A9!${randomBytes(18).toString('base64url')}#a`;
const adUserPassword = `U7!${randomBytes(18).toString('base64url')}#u`;
const env = {
  ...process.env,
  FYLKREN_DB_PASSWORD: 'synthetic-identity-ad-lab-only',
  FYLKREN_HTTP_PORT: '127.0.0.1:18091',
  FYLKREN_PUBLIC_URL: base,
  FYLKREN_MFA_ENABLED: 'false',
  FYLKREN_LICENSE_PUBLIC_KEY_SPKI: fixture.publicKeySpki,
  FYLKREN_IDENTITY_AD_LAB_ADMIN_PASSWORD: adAdminPassword,
};
const composeFiles = ['-f', 'compose.yaml', '-f', 'tools/e2e/identity-ad-lab.compose.yaml'];
if (process.argv.includes('--no-build')) composeFiles.push('-f', 'tools/e2e/reuse-images.compose.yaml');

function command(program, args, options = {}) {
  const result = spawnSync(program, args, { env, encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${program} exited with ${result.status}`);
  }
  return result.stdout?.trim() ?? '';
}
function compose(args, options) { return command('docker', ['compose', ...composeFiles, '-p', project, ...args], options); }
function browserClient() {
  const cookies = new Map();
  let csrfToken;
  async function request(path, options = {}) {
    const headers = { ...(options.headers ?? {}) };
    if (cookies.size) headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    if (csrfToken && options.method && options.method !== 'GET') headers['X-Fylkren-CSRF'] = csrfToken;
    const response = await fetch(`${base}${path}`, { ...options, headers, redirect: 'manual' });
    for (const value of response.headers.getSetCookie()) {
      const [pair] = value.split(';');
      const separator = pair.indexOf('=');
      if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: response.status, body };
  }
  return {
    request,
    post(path, body) { return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); },
    put(path, body) { return request(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); },
    async csrf() {
      const response = await request('/api/security/antiforgery');
      assert.equal(response.status, 200, JSON.stringify(response.body));
      csrfToken = response.body.token;
    },
  };
}

let started = false;
try {
  process.stdout.write('Building and starting the isolated Samba Active Directory lab...\n');
  started = true;
  compose(['up', '-d', process.argv.includes('--no-build') ? '--no-build' : '--build', '--wait'], { stdio: 'inherit' });
  compose(['exec', '-T', 'ad', 'samba-tool', 'user', 'create', 'live-ad', adUserPassword,
    '--given-name=Live', '--surname=AD Person', '--mail-address=live-ad@example.invalid',
    '-s', '/samba/etc/smb.conf'], { stdio: 'inherit' });
  compose(['exec', '-T', 'postgres', 'psql', '-U', 'fylkren', '-d', 'fylkren', '-v', 'ON_ERROR_STOP=1', '-c',
    `UPDATE instance_identity SET instance_id = '${fixture.instanceId}' WHERE key = 1`], { stdio: 'inherit' });

  const manager = browserClient();
  const managerUsername = `ad-manager-${randomBytes(5).toString('hex')}`;
  const managerPassword = `M6!${randomBytes(22).toString('base64url')}#m`;
  const bootstrap = await manager.post('/api/bootstrap/platform-manager', {
    username: managerUsername, displayName: 'Synthetic AD Manager',
    email: `${managerUsername}@example.invalid`, password: managerPassword,
  });
  assert.equal(bootstrap.status, 201, JSON.stringify(bootstrap.body));
  await manager.csrf();
  const license = await manager.post('/api/platform/license', fixture.valid);
  assert.equal(license.status, 200, JSON.stringify(license.body));
  const site = await manager.post('/api/sites/', { name: 'Identity AD Lab', overviewDesign: 'classic' });
  assert.equal(site.status, 201, JSON.stringify(site.body));
  const anchorUsername = `ad-anchor-${randomBytes(4).toString('hex')}`;
  const anchor = await manager.post(`/api/sites/${site.body.id}/access/local-users`, {
    displayName: 'Synthetic AD Anchor', email: `${anchorUsername}@example.invalid`,
    username: anchorUsername, organizationUnitId: null,
  });
  assert.equal(anchor.status, 201, JSON.stringify(anchor.body));

  const configuration = {
    server: 'ad.example.test', port: 636, security: 'ldaps', baseDn: 'DC=example,DC=test',
    userSearchBase: 'CN=Users,DC=example,DC=test',
    bindDn: 'CN=Administrator,CN=Users,DC=example,DC=test', secret: adAdminPassword,
    domain: 'EXAMPLE.TEST', usernameAttribute: 'sAMAccountName', displayNameAttribute: 'displayName',
    emailAttribute: 'mail', stableIdAttribute: 'objectGUID', lifecycleActiveFilter: '(objectClass=user)',
    authority: null, clientId: null, callbackPath: '/signin-oidc', metadataUrl: null,
    entityId: null, identityProviderEntityId: null, modulePath: '/api/auth/saml2', ssoAutoRedirectProvider: null,
  };
  const saved = await manager.put('/api/platform/identity/providers/ad', { enabled: false, clearSecret: false, configuration });
  assert.equal(saved.status, 204, JSON.stringify(saved.body));
  const tested = await manager.post('/api/platform/identity/providers/ad/test', {});
  assert.equal(tested.status, 204, JSON.stringify(tested.body));
  const stored = await manager.request('/api/platform/identity/providers/ad');
  assert.equal(stored.body.lastTestSucceeded, true);
  assert.equal(stored.body.hasSecret, true);
  assert.equal(stored.body.configuration.secret, null);
  const activated = await manager.put('/api/platform/identity/providers/ad', { enabled: true, clearSecret: false, configuration: stored.body.configuration });
  assert.equal(activated.status, 204, JSON.stringify(activated.body));
  const linked = await manager.post('/api/platform/identity/directory-links', {
    provider: 'ad', localUsername: anchorUsername, directoryUsername: 'live-ad',
  });
  assert.equal(linked.status, 201, JSON.stringify(linked.body));
  assert.match(linked.body.subjectId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

  const directoryUser = browserClient();
  const signedIn = await directoryUser.post('/api/session/directory', { provider: 'ad', username: 'live-ad', password: adUserPassword });
  assert.equal(signedIn.status, 204, JSON.stringify(signedIn.body));
  const session = await directoryUser.request('/api/session');
  assert.equal(session.body.authenticated, true);
  assert.equal(session.body.isDirectoryManaged, true);
  assert.equal(session.body.displayName, 'Live AD Person');

  compose(['exec', '-T', 'ad', 'samba-tool', 'user', 'disable', 'live-ad', '-s', '/samba/etc/smb.conf'], { stdio: 'inherit' });
  const suspended = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(suspended.status, 200, JSON.stringify(suspended.body));
  assert.equal(suspended.body.suspended, 1);
  const rejectedSession = await directoryUser.request('/api/session');
  assert.equal(rejectedSession.body.authenticated, false, 'The existing AD session must be rejected after suspension');
  const rejectedLogin = await browserClient().post('/api/session/directory', { provider: 'ad', username: 'live-ad', password: adUserPassword });
  assert.equal(rejectedLogin.status, 401);

  compose(['exec', '-T', 'ad', 'samba-tool', 'user', 'enable', 'live-ad', '-s', '/samba/etc/smb.conf'], { stdio: 'inherit' });
  const resumed = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(resumed.status, 200, JSON.stringify(resumed.body));
  assert.equal(resumed.body.resumed, 1);
  const restoredLogin = await browserClient().post('/api/session/directory', { provider: 'ad', username: 'live-ad', password: adUserPassword });
  assert.equal(restoredLogin.status, 204, JSON.stringify(restoredLogin.body));

  const expirySession = browserClient();
  assert.equal((await expirySession.post('/api/session/directory', {
    provider: 'ad', username: 'live-ad', password: adUserPassword,
  })).status, 204);
  compose(['exec', '-T', 'ad', 'samba-tool', 'user', 'setexpiry', 'live-ad', '--days=0', '-s', '/samba/etc/smb.conf'], { stdio: 'inherit' });
  const expired = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(expired.status, 200, JSON.stringify(expired.body));
  assert.equal(expired.body.suspended, 1, JSON.stringify(expired.body));
  assert.equal((await expirySession.request('/api/session')).body.authenticated, false,
    'An existing AD session must be revoked when accountExpires is reached');
  compose(['exec', '-T', 'ad', 'samba-tool', 'user', 'setexpiry', 'live-ad', '--noexpiry', '-s', '/samba/etc/smb.conf'], { stdio: 'inherit' });
  const resumedAfterExpiry = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(resumedAfterExpiry.status, 200, JSON.stringify(resumedAfterExpiry.body));
  assert.equal(resumedAfterExpiry.body.resumed, 1, JSON.stringify(resumedAfterExpiry.body));
  assert.equal((await browserClient().post('/api/session/directory', {
    provider: 'ad', username: 'live-ad', password: adUserPassword,
  })).status, 204);

  compose(['stop', 'ad'], { stdio: 'inherit' });
  const unavailable = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(unavailable.status, 200, JSON.stringify(unavailable.body));
  assert.equal(unavailable.body.unavailable, 1);
  const linksDuringOutage = await manager.request('/api/platform/identity/directory-links');
  assert.equal(linksDuringOutage.body[0].accessEnabled, true, 'AD outage must fail safe without suspension');
  assert.equal(linksDuringOutage.body[0].lifecycleStatus, 'unavailable');

  const apiLogs = compose(['logs', '--no-color', 'api']);
  assert.equal(apiLogs.includes(adAdminPassword), false, 'AD bind secret must not appear in API logs');
  assert.equal(apiLogs.includes(adUserPassword), false, 'AD user secret must not appear in API logs');

  process.stdout.write(`${JSON.stringify({
    liveSambaActiveDirectoryTls: 'passed',
    adObjectGuidLinkAndPasswordAuthentication: 'passed',
    userAccountControlSuspensionAndSessionRevocation: 'passed',
    accountExpirySuspensionAndSessionRevocation: 'passed',
    activeDirectoryRestoration: 'passed',
    activeDirectorySecretSafeLogging: 'passed',
    activeDirectoryOutageFailSafe: 'passed',
  }, null, 2)}\n`);
} finally {
  if (started) {
    try { compose(['down', '-v'], { stdio: 'inherit' }); }
    catch (error) { process.stderr.write(`Cleanup failed: ${error.message}\n`); }
  }
}
