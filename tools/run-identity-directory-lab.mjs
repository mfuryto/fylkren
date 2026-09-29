import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const project = 'fylkren-identity-directory-lab';
const base = 'http://localhost:18088';
const fixture = JSON.parse(readFileSync(new URL('./e2e/license-fixture.json', import.meta.url), 'utf8'));
const labDirectory = mkdtempSync(join(tmpdir(), 'fylkren-identity-directory-lab-'));
chmodSync(labDirectory, 0o755);
const ldapAdminPassword = `A9!${randomBytes(18).toString('base64url')}#a`;
const ldapConfigPassword = `C8!${randomBytes(18).toString('base64url')}#c`;
const ldapUserPassword = `U7!${randomBytes(18).toString('base64url')}#u`;
const env = {
  ...process.env,
  FYLKREN_DB_PASSWORD: 'synthetic-identity-directory-lab-only',
  FYLKREN_HTTP_PORT: '127.0.0.1:18088',
  FYLKREN_PUBLIC_URL: base,
  FYLKREN_MFA_ENABLED: 'false',
  FYLKREN_LICENSE_PUBLIC_KEY_SPKI: fixture.publicKeySpki,
  FYLKREN_IDENTITY_LAB_DIR: labDirectory,
  FYLKREN_IDENTITY_LAB_LDAP_ADMIN_PASSWORD: ldapAdminPassword,
  FYLKREN_IDENTITY_LAB_LDAP_CONFIG_PASSWORD: ldapConfigPassword,
  FYLKREN_IDENTITY_LAB_IMPORTED_LDAP_SERVER: 'ldap',
};
const composeFiles = ['-f', 'compose.yaml', '-f', 'tools/e2e/identity-lab.compose.yaml'];
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

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

function compose(args, options) {
  return command('docker', ['compose', ...composeFiles, '-p', project, ...args], options);
}

function openssl(args) {
  return command('openssl', args);
}

function createCertificates() {
  const caKey = join(labDirectory, 'ca.key');
  const caCertificate = join(labDirectory, 'ca.crt');
  const ldapKey = join(labDirectory, 'ldap.key');
  const ldapRequest = join(labDirectory, 'ldap.csr');
  const ldapCertificate = join(labDirectory, 'ldap.crt');
  const extensions = join(labDirectory, 'ldap.ext');
  openssl(['genpkey', '-algorithm', 'EC', '-pkeyopt', 'ec_paramgen_curve:P-256', '-out', caKey]);
  openssl(['req', '-x509', '-new', '-key', caKey, '-sha256', '-days', '2', '-subj', '/CN=Fylkren identity lab CA', '-out', caCertificate]);
  openssl(['genpkey', '-algorithm', 'EC', '-pkeyopt', 'ec_paramgen_curve:P-256', '-out', ldapKey]);
  openssl(['req', '-new', '-key', ldapKey, '-subj', '/CN=ldap', '-out', ldapRequest]);
  writeFileSync(extensions, 'subjectAltName=DNS:ldap\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyAgreement\n');
  openssl(['x509', '-req', '-in', ldapRequest, '-CA', caCertificate, '-CAkey', caKey, '-CAcreateserial', '-days', '2', '-sha256', '-extfile', extensions, '-out', ldapCertificate]);
  chmodSync(caCertificate, 0o644);
  chmodSync(ldapCertificate, 0o644);
  chmodSync(ldapKey, 0o600);
}

function createLdif() {
  writeFileSync(join(labDirectory, 'bootstrap.ldif'), `dn: ou=people,dc=example,dc=test
objectClass: organizationalUnit
ou: people

dn: ou=quarantine,dc=example,dc=test
objectClass: organizationalUnit
ou: quarantine

dn: uid=live-ldap,ou=people,dc=example,dc=test
objectClass: inetOrgPerson
uid: live-ldap
cn: Live LDAP Person
sn: Person
displayName: Live LDAP Person
mail: live-ldap@example.invalid
employeeNumber: stable-001
employeeType: active
userPassword: ${ldapUserPassword}
`);
}

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
    delete(path) { return request(path, { method: 'DELETE' }); },
    async csrf() {
      const response = await request('/api/security/antiforgery');
      assert.equal(response.status, 200, JSON.stringify(response.body));
      csrfToken = response.body.token;
    },
  };
}

function ldapModify(lines) {
  const result = spawnSync('docker', ['compose', ...composeFiles, '-p', project, 'exec', '-T',
    '-e', 'LDAPTLS_CACERT=/container/service/slapd/assets/certs/ca.crt', '-e', 'LDAPTLS_REQCERT=demand', 'ldap',
    'ldapmodify', '-x', '-H', 'ldaps://ldap:636',
    '-D', 'cn=admin,dc=example,dc=test', '-w', ldapAdminPassword],
  { env, encoding: 'utf8', input: `${lines.trim()}\n` });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`ldapmodify exited with ${result.status}`);
  }
}

function databaseScalar(sql) {
  return compose(['exec', '-T', 'postgres', 'psql', '-U', 'fylkren', '-d', 'fylkren', '-tA', '-v', 'ON_ERROR_STOP=1', '-c', sql]);
}

function rotateDirectoryAdminPassword(password) {
  const databaseSearch = compose(['exec', '-T', '-e', 'LDAPTLS_CACERT=/container/service/slapd/assets/certs/ca.crt',
    '-e', 'LDAPTLS_REQCERT=demand', 'ldap', 'ldapsearch', '-LLL', '-x', '-H', 'ldaps://ldap:636',
    '-D', 'cn=admin,cn=config', '-w', ldapConfigPassword, '-b', 'cn=config',
    '(olcSuffix=dc=example,dc=test)', 'dn']);
  const databaseDn = databaseSearch.match(/^dn: (.+)$/m)?.[1];
  assert.ok(databaseDn, `Could not find the OpenLDAP database DN: ${databaseSearch}`);
  const passwordHash = compose(['exec', '-T', 'ldap', 'slappasswd', '-s', password]);
  const result = spawnSync('docker', ['compose', ...composeFiles, '-p', project, 'exec', '-T',
    '-e', 'LDAPTLS_CACERT=/container/service/slapd/assets/certs/ca.crt', '-e', 'LDAPTLS_REQCERT=demand', 'ldap',
    'ldapmodify', '-x', '-H', 'ldaps://ldap:636', '-D', 'cn=admin,cn=config', '-w', ldapConfigPassword],
  { env, encoding: 'utf8', input: `dn: ${databaseDn}\nchangetype: modify\nreplace: olcRootPW\nolcRootPW: ${passwordHash}\n` });
  if (result.status !== 0) throw new Error(`OpenLDAP root-password rotation failed: ${result.stderr || result.stdout}`);
}

let started = false;
try {
  createCertificates();
  createLdif();
  process.stdout.write('Building and starting the isolated OpenLDAP identity lab...\n');
  started = true;
  compose(['up', '-d', '--build', '--wait'], { stdio: 'inherit' });
  compose(['exec', '-T', 'postgres', 'psql', '-U', 'fylkren', '-d', 'fylkren', '-v', 'ON_ERROR_STOP=1', '-c',
    `UPDATE instance_identity SET instance_id = '${fixture.instanceId}' WHERE key = 1`], { stdio: 'inherit' });

  const manager = browserClient();
  const managerUsername = `directory-manager-${randomBytes(5).toString('hex')}`;
  const managerPassword = `M6!${randomBytes(22).toString('base64url')}#m`;
  const bootstrap = await manager.post('/api/bootstrap/platform-manager', {
    username: managerUsername,
    displayName: 'Synthetic Directory Manager',
    email: `${managerUsername}@example.invalid`,
    password: managerPassword,
  });
  assert.equal(bootstrap.status, 201, JSON.stringify(bootstrap.body));
  await manager.csrf();
  const license = await manager.post('/api/platform/license', fixture.valid);
  assert.equal(license.status, 200, JSON.stringify(license.body));
  assert.equal(license.body.status.edition, 'enterprise');
  const site = await manager.post('/api/sites/', { name: 'Identity Directory Lab', overviewDesign: 'classic' });
  assert.equal(site.status, 201, JSON.stringify(site.body));
  const anchorUsername = `directory-anchor-${randomBytes(4).toString('hex')}`;
  const anchor = await manager.post(`/api/sites/${site.body.id}/access/local-users`, {
    displayName: 'Synthetic Directory Anchor',
    email: `${anchorUsername}@example.invalid`,
    username: anchorUsername,
    organizationUnitId: null,
  });
  assert.equal(anchor.status, 201, JSON.stringify(anchor.body));

  const configuration = {
    server: 'ldap',
    port: 636,
    security: 'ldaps',
    baseDn: 'dc=example,dc=test',
    userSearchBase: 'ou=people,dc=example,dc=test',
    bindDn: 'cn=admin,dc=example,dc=test',
    secret: ldapAdminPassword,
    domain: null,
    usernameAttribute: 'uid',
    displayNameAttribute: 'displayName',
    emailAttribute: 'mail',
    stableIdAttribute: 'employeeNumber',
    lifecycleActiveFilter: '(employeeType=active)',
    authority: null,
    clientId: null,
    callbackPath: '/signin-oidc',
    metadataUrl: null,
    entityId: null,
    identityProviderEntityId: null,
    modulePath: '/api/auth/saml2',
    ssoAutoRedirectProvider: null,
  };
  const imported = await manager.request('/api/platform/identity/providers/ldap');
  assert.equal(imported.status, 200, JSON.stringify(imported.body));
  assert.equal(imported.body.enabled, false);
  assert.equal(imported.body.configuration.server, 'ldap');
  assert.equal(imported.body.configuration.stableIdAttribute, 'employeeNumber');
  assert.equal(imported.body.hasSecret, true);
  assert.equal(imported.body.configuration.secret, null);
  const saved = await manager.put('/api/platform/identity/providers/ldap', { enabled: false, clearSecret: false, configuration });
  assert.equal(saved.status, 204, JSON.stringify(saved.body));
  const connectionTest = await manager.post('/api/platform/identity/providers/ldap/test', {});
  assert.equal(connectionTest.status, 204, JSON.stringify(connectionTest.body));
  const stored = await manager.request('/api/platform/identity/providers/ldap');
  assert.equal(stored.status, 200, JSON.stringify(stored.body));
  assert.equal(stored.body.lastTestSucceeded, true);
  assert.equal(stored.body.hasSecret, true);
  assert.equal(stored.body.configuration.secret, null);
  const activated = await manager.put('/api/platform/identity/providers/ldap', { enabled: true, clearSecret: false, configuration: stored.body.configuration });
  assert.equal(activated.status, 204, JSON.stringify(activated.body));

  env.FYLKREN_IDENTITY_LAB_IMPORTED_LDAP_SERVER = 'environment-change-must-not-overwrite';
  compose(['up', '-d', '--force-recreate', '--wait', 'api'], { stdio: 'inherit' });
  const afterRestart = await manager.request('/api/platform/identity/providers/ldap');
  assert.equal(afterRestart.status, 200, JSON.stringify(afterRestart.body));
  assert.equal(afterRestart.body.enabled, true);
  assert.equal(afterRestart.body.configuration.server, 'ldap',
    'Environment values must be imported only once and never overwrite stored GUI configuration');
  assert.equal(afterRestart.body.lastTestSucceeded, true);

  const linked = await manager.post('/api/platform/identity/directory-links', {
    provider: 'ldap', localUsername: anchorUsername, directoryUsername: 'live-ldap',
  });
  assert.equal(linked.status, 201, JSON.stringify(linked.body));
  assert.equal(linked.body.provider, 'ldap');
  assert.ok(linked.body.subjectId);
  const injectionLogin = await browserClient().post('/api/session/directory', {
    provider: 'ldap', username: 'live-ldap)(|(uid=*)', password: ldapUserPassword,
  });
  assert.equal(injectionLogin.status, 401, 'LDAP filter metacharacters must be treated as literal username data');
  const injectionLink = await manager.post('/api/platform/identity/directory-links', {
    provider: 'ldap', localUsername: anchorUsername, directoryUsername: '*)(|(uid=*)',
  });
  assert.equal(injectionLink.status, 404, 'LDAP link lookup must escape filter metacharacters');

  const directoryUser = browserClient();
  const signedIn = await directoryUser.post('/api/session/directory', {
    provider: 'ldap', username: 'live-ldap', password: ldapUserPassword,
  });
  assert.equal(signedIn.status, 204, JSON.stringify(signedIn.body));
  const directorySession = await directoryUser.request('/api/session');
  assert.equal(directorySession.status, 200);
  assert.equal(directorySession.body.authenticated, true);
  assert.equal(directorySession.body.isPlatformManager, false);
  assert.equal(directorySession.body.isDirectoryManaged, true);
  const linkedPersonId = directorySession.body.personId;
  const initialMembershipCount = databaseScalar(`SELECT COUNT(*) FROM site_memberships WHERE person_id = '${linkedPersonId}' AND is_active`);
  assert.equal(initialMembershipCount, '1');
  let scheduledChecked = false;
  for (let attempt = 0; attempt < 75; attempt += 1) {
    const scheduledLinks = await manager.request('/api/platform/identity/directory-links');
    if (scheduledLinks.body[0]?.lastCheckedAt) { scheduledChecked = true; break; }
    await pause(1_000);
  }
  assert.equal(scheduledChecked, true, 'The scheduled directory lifecycle worker did not check the active link');

  ldapModify(`dn: uid=live-ldap,ou=people,dc=example,dc=test
changetype: modify
replace: employeeType
employeeType: inactive`);
  const suspended = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(suspended.status, 200, JSON.stringify(suspended.body));
  assert.equal(suspended.body.suspended, 1);
  const rejectedSession = await directoryUser.request('/api/session');
  assert.equal(rejectedSession.status, 200);
  assert.equal(rejectedSession.body.authenticated, false, 'The existing LDAP session must be rejected after suspension');
  const rejectedLogin = await browserClient().post('/api/session/directory', {
    provider: 'ldap', username: 'live-ldap', password: ldapUserPassword,
  });
  assert.equal(rejectedLogin.status, 401);

  ldapModify(`dn: uid=live-ldap,ou=people,dc=example,dc=test
changetype: modify
replace: employeeType
employeeType: active
-
replace: displayName
displayName: Restored LDAP Person`);
  const resumed = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(resumed.status, 200, JSON.stringify(resumed.body));
  assert.equal(resumed.body.resumed, 1);
  const restoredUser = browserClient();
  const restoredLogin = await restoredUser.post('/api/session/directory', {
    provider: 'ldap', username: 'live-ldap', password: ldapUserPassword,
  });
  assert.equal(restoredLogin.status, 204, JSON.stringify(restoredLogin.body));
  const restoredSession = await restoredUser.request('/api/session');
  assert.equal(restoredSession.body.displayName, 'Restored LDAP Person');
  assert.equal(restoredSession.body.personId, linkedPersonId);

  ldapModify(`dn: uid=duplicate-ldap,ou=people,dc=example,dc=test
changetype: add
objectClass: inetOrgPerson
uid: duplicate-ldap
cn: Duplicate LDAP Person
sn: Person
displayName: Duplicate LDAP Person
mail: duplicate-ldap@example.invalid
employeeNumber: stable-001
employeeType: active
userPassword: ${ldapUserPassword}`);
  const ambiguous = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(ambiguous.status, 200, JSON.stringify(ambiguous.body));
  assert.equal(ambiguous.body.unavailable, 1);
  let currentLinks = await manager.request('/api/platform/identity/directory-links');
  assert.equal(currentLinks.body[0].accessEnabled, true, 'An ambiguous stable ID must not suspend access');
  assert.equal(currentLinks.body[0].lifecycleStatus, 'unavailable');
  ldapModify(`dn: uid=duplicate-ldap,ou=people,dc=example,dc=test
changetype: delete`);

  const malformedDisplayName = 'X'.repeat(201);
  ldapModify(`dn: uid=live-ldap,ou=people,dc=example,dc=test
changetype: modify
replace: displayName
displayName: ${malformedDisplayName}`);
  const malformed = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(malformed.status, 200, JSON.stringify(malformed.body));
  assert.equal(malformed.body.unavailable, 1);
  currentLinks = await manager.request('/api/platform/identity/directory-links');
  assert.equal(currentLinks.body[0].accessEnabled, true, 'Malformed directory data must fail safe');
  ldapModify(`dn: uid=live-ldap,ou=people,dc=example,dc=test
changetype: modify
replace: displayName
displayName: Restored LDAP Person`);
  const validAgain = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(validAgain.body.active, 1, JSON.stringify(validAgain.body));

  const rotatedBindPassword = `R8!${randomBytes(18).toString('base64url')}#r`;
  rotateDirectoryAdminPassword(rotatedBindPassword);
  const invalidBind = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(invalidBind.status, 200, JSON.stringify(invalidBind.body));
  assert.equal(invalidBind.body.unavailable, 1);
  currentLinks = await manager.request('/api/platform/identity/directory-links');
  assert.equal(currentLinks.body[0].accessEnabled, true, 'An invalid lookup bind must not suspend access');
  rotateDirectoryAdminPassword(ldapAdminPassword);
  const healthyAfterBindRestore = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(healthyAfterBindRestore.body.active, 1, JSON.stringify(healthyAfterBindRestore.body));

  ldapModify(`dn: uid=live-ldap,ou=people,dc=example,dc=test
changetype: modrdn
newrdn: uid=live-ldap
deleteoldrdn: 1
newsuperior: ou=quarantine,dc=example,dc=test`);
  for (let confirmation = 1; confirmation <= 2; confirmation += 1) {
    const pending = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
    assert.equal(pending.status, 200, JSON.stringify(pending.body));
    assert.equal(pending.body.missingPending, 1, `Missing confirmation ${confirmation} must remain pending`);
    currentLinks = await manager.request('/api/platform/identity/directory-links');
    assert.equal(currentLinks.body[0].accessEnabled, true);
    assert.equal(currentLinks.body[0].missingCount, confirmation);
  }
  const missingConfirmed = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(missingConfirmed.body.suspended, 1, JSON.stringify(missingConfirmed.body));
  const missingRevokedSession = await restoredUser.request('/api/session');
  assert.equal(missingRevokedSession.body.authenticated, false, 'The session must be revoked after confirmed deletion');
  ldapModify(`dn: uid=live-ldap,ou=quarantine,dc=example,dc=test
changetype: modrdn
newrdn: uid=live-ldap
deleteoldrdn: 1
newsuperior: ou=people,dc=example,dc=test`);
  const resumedAfterMissing = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(resumedAfterMissing.body.resumed, 1, JSON.stringify(resumedAfterMissing.body));
  const samePersonAfterMissing = browserClient();
  assert.equal((await samePersonAfterMissing.post('/api/session/directory', {
    provider: 'ldap', username: 'live-ldap', password: ldapUserPassword,
  })).status, 204);
  assert.equal((await samePersonAfterMissing.request('/api/session')).body.personId, linkedPersonId);

  const removed = await manager.delete(`/api/platform/identity/directory-links/${linked.body.id}`);
  assert.equal(removed.status, 204, JSON.stringify(removed.body));
  assert.equal((await browserClient().post('/api/session/directory', {
    provider: 'ldap', username: 'live-ldap', password: ldapUserPassword,
  })).status, 401);
  const relinked = await manager.post('/api/platform/identity/directory-links', {
    provider: 'ldap', localUsername: anchorUsername, directoryUsername: 'live-ldap',
  });
  assert.equal(relinked.status, 201, JSON.stringify(relinked.body));
  assert.equal(relinked.body.id, linked.body.id, 'Relinking must reactivate the same external identity record');
  const relinkedUser = browserClient();
  assert.equal((await relinkedUser.post('/api/session/directory', {
    provider: 'ldap', username: 'live-ldap', password: ldapUserPassword,
  })).status, 204);
  assert.equal((await relinkedUser.request('/api/session')).body.personId, linkedPersonId);
  assert.equal(databaseScalar(`SELECT COUNT(*) FROM site_memberships WHERE person_id = '${linkedPersonId}' AND is_active`), initialMembershipCount);

  const lifecycleAudit = databaseScalar(`SELECT COUNT(*) FROM audit_events WHERE actor_system = 'directory-lifecycle' AND entity_id = '${linked.body.id}' AND event_type IN ('identity.directory.account-suspended', 'identity.directory.account-resumed')`);
  assert.ok(Number(lifecycleAudit) >= 4, `Expected lifecycle system audit events, got ${lifecycleAudit}`);
  const linkAudit = databaseScalar(`SELECT COUNT(*) FROM audit_events WHERE entity_id = '${linked.body.id}' AND event_type IN ('identity.ldap.linked', 'identity.ldap.unlinked')`);
  assert.ok(Number(linkAudit) >= 3, `Expected link/unlink audit events, got ${linkAudit}`);

  compose(['stop', 'ldap'], { stdio: 'inherit' });
  const unavailable = await manager.post('/api/platform/identity/directories/lifecycle/sync', {});
  assert.equal(unavailable.status, 200, JSON.stringify(unavailable.body));
  assert.equal(unavailable.body.unavailable, 1);
  const linksDuringOutage = await manager.request('/api/platform/identity/directory-links');
  assert.equal(linksDuringOutage.status, 200);
  assert.equal(linksDuringOutage.body[0].accessEnabled, true, 'Directory outage must fail safe without suspension');
  assert.equal(linksDuringOutage.body[0].lifecycleStatus, 'unavailable');

  const apiLogs = compose(['logs', '--no-color', 'api']);
  assert.equal(apiLogs.includes(ldapAdminPassword), false, 'LDAP bind secret must not appear in API logs');
  assert.equal(apiLogs.includes(rotatedBindPassword), false, 'Rotated LDAP service-account secret must not appear in API logs');
  assert.equal(apiLogs.includes(ldapUserPassword), false, 'LDAP user secret must not appear in API logs');

  process.stdout.write(`${JSON.stringify({
    liveOpenLdapTls: 'passed',
    providerConfigurationAndSecretProtection: 'passed',
    oneTimeEnvironmentImport: 'passed',
    directoryLinkAndAuthentication: 'passed',
    scheduledAndManualLifecycleSync: 'passed',
    ldapFilterInjectionRejection: 'passed',
    authoritativeSuspensionAndSessionRevocation: 'passed',
    restorationAndProfileSync: 'passed',
    ambiguousStableIdFailSafe: 'passed',
    malformedDirectoryDataFailSafe: 'passed',
    invalidLookupBindFailSafe: 'passed',
    missingAccountConfirmationAndSessionRevocation: 'passed',
    unlinkRelinkAndAccessPreservation: 'passed',
    lifecycleAndActorAudit: 'passed',
    secretSafeLogging: 'passed',
    outageFailSafe: 'passed',
  }, null, 2)}\n`);
} finally {
  if (started) {
    try { compose(['down', '-v'], { stdio: 'inherit' }); }
    catch (error) { process.stderr.write(`Cleanup failed: ${error.message}\n`); }
  }
  rmSync(labDirectory, { recursive: true, force: true });
}
