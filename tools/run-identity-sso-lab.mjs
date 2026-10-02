import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const project = 'fylkren-identity-sso-lab';
const managerBase = 'http://localhost:18090';
const browserBase = 'https://localhost:18444';
const cdpEndpoint = 'http://127.0.0.1:9222';
const fixture = JSON.parse(readFileSync(new URL('./e2e/license-fixture.json', import.meta.url), 'utf8'));
const labDirectory = mkdtempSync(join(tmpdir(), 'fylkren-identity-sso-lab-'));
chmodSync(labDirectory, 0o755);
const keycloakAdminPassword = `A9!${randomBytes(18).toString('base64url')}#a`;
const keycloakUserPassword = `U7!${randomBytes(18).toString('base64url')}#u`;
const oidcClientSecret = `O6!${randomBytes(24).toString('base64url')}#o`;
const negativeClientSecret = `N8!${randomBytes(24).toString('base64url')}#n`;
const externalSubject = '11111111-1111-4111-8111-111111111111';
const managerExternalSubject = '22222222-2222-4222-8222-222222222222';
const secondIssuerSubject = '33333333-3333-4333-8333-333333333333';
const authority = 'https://keycloak.test:18443/realms/fylkren-lab';
const secondAuthority = 'https://keycloak.test:18443/realms/fylkren-other';
const negativeAuthority = 'https://oidc-invalid.test:18445';
const negativeSubject = '44444444-4444-4444-8444-444444444444';
const env = {
  ...process.env,
  FYLKREN_DB_PASSWORD: 'synthetic-identity-sso-lab-only',
  FYLKREN_HTTP_PORT: '127.0.0.1:18089',
  FYLKREN_PUBLIC_URL: browserBase,
  FYLKREN_TRUST_FORWARDED_HEADERS: 'true',
  FYLKREN_REQUIRE_HTTPS: 'true',
  FYLKREN_MFA_ENABLED: 'false',
  FYLKREN_LICENSE_PUBLIC_KEY_SPKI: fixture.publicKeySpki,
  FYLKREN_IDENTITY_LAB_DIR: labDirectory,
  FYLKREN_IDENTITY_LAB_KEYCLOAK_ADMIN_PASSWORD: keycloakAdminPassword,
  FYLKREN_IDENTITY_LAB_NEGATIVE_SECRET: negativeClientSecret,
};
const composeFiles = ['-f', 'compose.yaml', '-f', 'tools/e2e/identity-sso-lab.compose.yaml'];

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
function openssl(args) { return command('openssl', args); }
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function createCertificates() {
  const caKey = join(labDirectory, 'ca.key');
  const caCertificate = join(labDirectory, 'ca.crt');
  const key = join(labDirectory, 'keycloak.key');
  const request = join(labDirectory, 'keycloak.csr');
  const certificate = join(labDirectory, 'keycloak.crt');
  const extensions = join(labDirectory, 'keycloak.ext');
  const gatewayKey = join(labDirectory, 'gateway.key');
  const gatewayRequest = join(labDirectory, 'gateway.csr');
  const gatewayCertificate = join(labDirectory, 'gateway.crt');
  const gatewayExtensions = join(labDirectory, 'gateway.ext');
  const negativeKey = join(labDirectory, 'oidc-negative.key');
  const negativeRequest = join(labDirectory, 'oidc-negative.csr');
  const negativeCertificate = join(labDirectory, 'oidc-negative.crt');
  const negativeExtensions = join(labDirectory, 'oidc-negative.ext');
  openssl(['genpkey', '-algorithm', 'EC', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-out', caKey]);
  openssl(['req', '-x509', '-new', '-key', caKey, '-sha256', '-days', '2', '-subj', '/CN=Fylkren SSO lab CA', '-out', caCertificate]);
  openssl(['genpkey', '-algorithm', 'EC', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-out', key]);
  openssl(['req', '-new', '-key', key, '-subj', '/CN=keycloak.test', '-out', request]);
  writeFileSync(extensions, 'subjectAltName=DNS:keycloak.test\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyAgreement\n');
  openssl(['x509', '-req', '-in', request, '-CA', caCertificate, '-CAkey', caKey, '-CAcreateserial', '-days', '2', '-sha256', '-extfile', extensions, '-out', certificate]);
  openssl(['genpkey', '-algorithm', 'EC', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-out', gatewayKey]);
  openssl(['req', '-new', '-key', gatewayKey, '-subj', '/CN=localhost', '-out', gatewayRequest]);
  writeFileSync(gatewayExtensions, 'subjectAltName=DNS:localhost,DNS:metadata.test,IP:127.0.0.1\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyAgreement\n');
  openssl(['x509', '-req', '-in', gatewayRequest, '-CA', caCertificate, '-CAkey', caKey, '-CAserial', join(labDirectory, 'ca.srl'), '-days', '2', '-sha256', '-extfile', gatewayExtensions, '-out', gatewayCertificate]);
  openssl(['genpkey', '-algorithm', 'EC', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-out', negativeKey]);
  openssl(['req', '-new', '-key', negativeKey, '-subj', '/CN=oidc-invalid.test', '-out', negativeRequest]);
  writeFileSync(negativeExtensions, 'subjectAltName=DNS:oidc-invalid.test\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyAgreement\n');
  openssl(['x509', '-req', '-in', negativeRequest, '-CA', caCertificate, '-CAkey', caKey, '-CAserial', join(labDirectory, 'ca.srl'), '-days', '2', '-sha256', '-extfile', negativeExtensions, '-out', negativeCertificate]);
  writeFileSync(join(labDirectory, 'gateway.conf'), `events {}
http {
  server {
    listen 18444 ssl;
    server_name localhost metadata.test;
    ssl_certificate /run/fylkren-identity-lab/gateway.crt;
    ssl_certificate_key /run/fylkren-identity-lab/gateway.key;
    location = /oidc-mismatch/.well-known/openid-configuration {
      default_type application/json;
      return 200 '{"issuer":"https://issuer-mismatch.example.invalid","authorization_endpoint":"https://issuer-mismatch.example.invalid/auth","token_endpoint":"https://issuer-mismatch.example.invalid/token","jwks_uri":"https://issuer-mismatch.example.invalid/keys"}';
    }
    location / {
      proxy_pass http://web:8080;
      proxy_set_header Host $http_host;
      proxy_set_header X-Forwarded-Host $http_host;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
  }
  server {
    listen 18090;
    server_name localhost;
    location / {
      proxy_pass http://web:8080;
      proxy_set_header Host localhost:18444;
      proxy_set_header X-Forwarded-Host localhost:18444;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
  }
  server {
    listen 18445 ssl;
    server_name oidc-invalid.test;
    ssl_certificate /run/fylkren-identity-lab/oidc-negative.crt;
    ssl_certificate_key /run/fylkren-identity-lab/oidc-negative.key;
    location / {
      proxy_pass https://oidc-negative-provider:18445;
      proxy_ssl_verify off;
      proxy_set_header Host $http_host;
    }
  }
}
`);
  chmodSync(caCertificate, 0o644);
  chmodSync(certificate, 0o644);
  chmodSync(key, 0o600);
  chmodSync(gatewayCertificate, 0o644);
  chmodSync(gatewayKey, 0o600);
  chmodSync(negativeCertificate, 0o644);
  chmodSync(negativeKey, 0o600);
}

function createRealm() {
  const realm = {
    realm: 'fylkren-lab',
    enabled: true,
    sslRequired: 'all',
    registrationAllowed: false,
    loginWithEmailAllowed: false,
    users: [{
      id: externalSubject,
      username: 'live-sso',
      enabled: true,
      emailVerified: true,
      email: 'live-sso@example.invalid',
      firstName: 'Live',
      lastName: 'SSO Person',
      attributes: { [`saml.persistent.name.id.for.${browserBase}/api/auth/saml2`]: [externalSubject] },
      credentials: [{ type: 'password', value: keycloakUserPassword, temporary: false }],
    }],
    clients: [{
      clientId: 'fylkren-oidc',
      name: 'Fylkren OIDC laboratory',
      enabled: true,
      protocol: 'openid-connect',
      publicClient: false,
      secret: oidcClientSecret,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: false,
      redirectUris: [`${browserBase}/signin-oidc`],
      webOrigins: [browserBase],
      attributes: { 'post.logout.redirect.uris': `${browserBase}/*` },
      defaultClientScopes: ['profile', 'email', 'roles', 'web-origins'],
    }, {
      clientId: `${browserBase}/api/auth/saml2`,
      name: 'Fylkren SAML laboratory',
      enabled: true,
      protocol: 'saml',
      redirectUris: [`${browserBase}/api/auth/saml2/*`],
      baseUrl: browserBase,
      attributes: {
        'saml.authnstatement': 'true',
        'saml.assertion.signature': 'true',
        'saml.server.signature': 'true',
        'saml.force.post.binding': 'true',
        'saml_name_id_format': 'persistent',
        'saml.client.signature': 'false',
        'saml.encrypt': 'false',
      },
    }],
  };
  writeFileSync(join(labDirectory, 'realm.json'), JSON.stringify(realm, null, 2));
  writeFileSync(join(labDirectory, 'realm-other.json'), JSON.stringify({
    realm: 'fylkren-other',
    enabled: true,
    sslRequired: 'all',
    registrationAllowed: false,
    loginWithEmailAllowed: false,
    users: [{
      id: secondIssuerSubject,
      username: 'live-sso',
      enabled: true,
      emailVerified: true,
      email: 'live-sso-other@example.invalid',
      firstName: 'Live',
      lastName: 'Other Issuer Person',
      credentials: [{ type: 'password', value: keycloakUserPassword, temporary: false }],
    }],
    clients: [{
      clientId: 'fylkren-oidc',
      name: 'Fylkren second-issuer laboratory',
      enabled: true,
      protocol: 'openid-connect',
      publicClient: false,
      secret: oidcClientSecret,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: false,
      redirectUris: [`${browserBase}/signin-oidc`],
      webOrigins: [browserBase],
      defaultClientScopes: ['profile', 'email', 'roles', 'web-origins'],
    }],
  }, null, 2));
}

async function waitForKeycloak() {
  for (let attempt = 0; attempt < 90; attempt++) {
    const result = spawnSync('docker', ['compose', ...composeFiles, '-p', project, 'exec', '-T', 'api',
      'curl', '--fail', '--silent', '--show-error', '--cacert', '/run/fylkren-identity-lab/ca.crt',
      `${authority}/.well-known/openid-configuration`], { env, encoding: 'utf8' });
    if (result.status === 0) return;
    await pause(1000);
  }
  throw new Error('Keycloak did not become ready.');
}

async function waitForNegativeProvider() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = spawnSync('docker', ['compose', ...composeFiles, '-p', project, 'exec', '-T', 'api',
      'curl', '--fail', '--silent', '--show-error', '--cacert', '/run/fylkren-identity-lab/ca.crt',
      `${negativeAuthority}/health`], { env, encoding: 'utf8' });
    if (result.status === 0) return;
    await pause(500);
  }
  throw new Error('The negative OIDC provider did not become ready.');
}

function browserClient() {
  const cookies = new Map();
  let csrfToken;
  async function request(path, options = {}) {
    const headers = { ...(options.headers ?? {}) };
    if (cookies.size) headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    if (csrfToken && options.method && options.method !== 'GET') headers['X-Fylkren-CSRF'] = csrfToken;
    const response = await fetch(`${managerBase}${path}`, { ...options, headers, redirect: 'manual' });
    for (const value of response.headers.getSetCookie()) {
      const [pair] = value.split(';');
      const separator = pair.indexOf('=');
      if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: response.status, body, location: response.headers.get('location') };
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

async function createCdpSession(url) {
  let target;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`${cdpEndpoint}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
      if (response.ok) { target = await response.json(); break; }
    } catch {}
    await pause(250);
  }
  if (!target) throw new Error('The identity-lab browser did not become ready.');
  const socket = new WebSocket(target.webSocketDebuggerUrl.replace('127.0.0.1:9222', new URL(cdpEndpoint).host));
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  let sequence = 0;
  const pending = new Map();
  const listeners = new Map();
  const eventErrors = [];
  const networkRequests = [];
  const networkResponses = [];
  socket.addEventListener('message', event => {
    const value = JSON.parse(event.data);
    if (!value.id) {
      if (value.method === 'Network.requestWillBeSent') networkRequests.push(value.params.request);
      if (value.method === 'Network.responseReceived') networkResponses.push(value.params.response);
      for (const listener of listeners.get(value.method) ?? [])
        Promise.resolve(listener(value.params)).catch(error => eventErrors.push(error));
      return;
    }
    const waiter = pending.get(value.id);
    if (!waiter) return;
    pending.delete(value.id);
    if (value.error) waiter.reject(new Error(JSON.stringify(value.error)));
    else waiter.resolve(value.result);
  });
  function call(method, params = {}) {
    const id = ++sequence;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }
  async function evaluate(expression) {
    if (eventErrors.length) throw eventErrors.shift();
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async function waitFor(expression, label) {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (eventErrors.length) throw eventErrors.shift();
      if (await evaluate(expression)) return;
      await pause(250);
    }
    throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(await evaluate(`({ url: location.href, body: document.body?.innerText ?? '', html: document.documentElement?.outerHTML?.slice(0, 2000) ?? '' })`))}`);
  }
  async function waitForResponse(predicate, label, startIndex = 0) {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (eventErrors.length) throw eventErrors.shift();
      const response = networkResponses.slice(startIndex).find(predicate);
      if (response) return response;
      await pause(250);
    }
    throw new Error(`Timed out waiting for ${label}.`);
  }
  function on(method, listener) {
    const values = listeners.get(method) ?? [];
    values.push(listener);
    listeners.set(method, values);
  }
  async function navigate(targetUrl) {
    const result = await call('Page.navigate', { url: targetUrl });
    assert.equal(result.errorText, undefined, `Browser navigation failed: ${JSON.stringify(result)}`);
  }
  async function clearCookies(origin) {
    // Stop the application before clearing cookies: pending authenticated page
    // requests can otherwise renew the old cookie after the cleanup completes.
    await call('Page.stopLoading');
    await navigate(`${origin}/api/configuration/public`);
    await waitFor('location.pathname === "/api/configuration/public" && document.readyState === "complete"',
      'inert public document before cookie cleanup');
    await call('Network.clearBrowserCookies');
    await call('Storage.clearDataForOrigin', { origin, storageTypes: 'cookies' });
    const { cookies } = await call('Network.getAllCookies');
    for (const cookie of cookies.filter(value => value.domain === new URL(origin).hostname))
      await call('Network.deleteCookies', { name: cookie.name, domain: cookie.domain, path: cookie.path });
    const remaining = (await call('Network.getAllCookies')).cookies;
    assert.equal(remaining.some(cookie => cookie.name === '__Host-Fylkren' || cookie.name === 'Fylkren.Session'), false,
      'The browser retained a Fylkren authentication cookie after cleanup');
  }
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Network.enable');
  await navigate(url);
  return {
    call, evaluate, waitFor, waitForResponse, navigate, clearCookies, on,
    networkRequests, networkResponses,
    close: async () => {
      try { await fetch(`${cdpEndpoint}/json/close/${target.id}`); } finally { socket.close(); }
    },
  };
}

let started = false;
try {
  createCertificates();
  // Keycloak runs as UID 1000; the workstation user may have a different UID.
  // Keep the disposable key private rather than making it world-readable.
  command('docker', ['run', '--rm', '-v', `${labDirectory}:/lab`, 'node:24-alpine',
    'chown', '1000:0', '/lab/keycloak.key']);
  createRealm();
  process.stdout.write('Building and starting the isolated OIDC/SAML identity lab...\n');
  started = true;
  compose(['up', '-d', '--build', '--wait'], { stdio: 'inherit' });
  await waitForKeycloak();
  await waitForNegativeProvider();
  compose(['exec', '-T', 'postgres', 'psql', '-U', 'fylkren', '-d', 'fylkren', '-v', 'ON_ERROR_STOP=1', '-c',
    `UPDATE instance_identity SET instance_id = '${fixture.instanceId}' WHERE key = 1`], { stdio: 'inherit' });

  const manager = browserClient();
  const managerUsername = `sso-manager-${randomBytes(5).toString('hex')}`;
  const managerPassword = `M6!${randomBytes(22).toString('base64url')}#m`;
  const bootstrap = await manager.post('/api/bootstrap/platform-manager', {
    username: managerUsername, displayName: 'Synthetic SSO Manager',
    email: `${managerUsername}@example.invalid`, password: managerPassword,
  });
  assert.equal(bootstrap.status, 201, JSON.stringify(bootstrap.body));
  await manager.csrf();
  const license = await manager.post('/api/platform/license', fixture.valid);
  assert.equal(license.status, 200, JSON.stringify(license.body));
  const site = await manager.post('/api/sites/', { name: 'Identity SSO Lab', overviewDesign: 'classic' });
  assert.equal(site.status, 201, JSON.stringify(site.body));
  const anchorUsername = `oidc-anchor-${randomBytes(4).toString('hex')}`;
  const anchor = await manager.post(`/api/sites/${site.body.id}/access/local-users`, {
    displayName: 'Synthetic OIDC Anchor', email: `${anchorUsername}@example.invalid`,
    username: anchorUsername, organizationUnitId: null,
  });
  assert.equal(anchor.status, 201, JSON.stringify(anchor.body));

  const oidcConfiguration = {
    server: null, port: 636, security: 'ldaps', baseDn: null, userSearchBase: null,
    bindDn: null, secret: oidcClientSecret, domain: null, usernameAttribute: 'uid',
    displayNameAttribute: 'displayName', emailAttribute: 'mail', stableIdAttribute: 'entryUUID',
    lifecycleActiveFilter: '(objectClass=*)', authority, clientId: 'fylkren-oidc',
    callbackPath: '/signin-oidc', metadataUrl: null, entityId: null,
    identityProviderEntityId: null, modulePath: '/api/auth/saml2', ssoAutoRedirectProvider: null,
  };
  const mismatchedIssuerConfiguration = {
    ...oidcConfiguration,
    authority: 'https://metadata.test:18444/oidc-mismatch',
  };
  const mismatchedIssuerSaved = await manager.put('/api/platform/identity/providers/oidc', {
    enabled: false, clearSecret: false, configuration: mismatchedIssuerConfiguration,
  });
  assert.equal(mismatchedIssuerSaved.status, 204, JSON.stringify(mismatchedIssuerSaved.body));
  const mismatchedIssuerTest = await manager.post('/api/platform/identity/providers/oidc/test', {});
  assert.equal(mismatchedIssuerTest.status, 502, 'OIDC metadata with an issuer different from the configured authority must be rejected');

  const saved = await manager.put('/api/platform/identity/providers/oidc', { enabled: false, clearSecret: false, configuration: oidcConfiguration });
  assert.equal(saved.status, 204, JSON.stringify(saved.body));
  const tested = await manager.post('/api/platform/identity/providers/oidc/test', {});
  assert.equal(tested.status, 204, JSON.stringify(tested.body));
  const stored = await manager.request('/api/platform/identity/providers/oidc');
  assert.equal(stored.body.lastTestSucceeded, true);
  assert.equal(stored.body.hasSecret, true);
  assert.equal(stored.body.configuration.secret, null);
  const activated = await manager.put('/api/platform/identity/providers/oidc', { enabled: true, clearSecret: false, configuration: stored.body.configuration });
  assert.equal(activated.status, 204, JSON.stringify(activated.body));
  const linked = await manager.post('/api/platform/identity/oidc-links', { username: anchorUsername, subjectId: externalSubject });
  assert.equal(linked.status, 201, JSON.stringify(linked.body));
  const challenge = await manager.request('/api/auth/oidc/login');
  assert.equal(challenge.status, 302, `OIDC challenge: ${JSON.stringify(challenge)}`);
  assert.ok(challenge.location?.startsWith(`${authority}/protocol/openid-connect/auth?`), challenge.location);

  const forgedOidcBrowser = await createCdpSession('about:blank');
  await forgedOidcBrowser.clearCookies(browserBase);
  await forgedOidcBrowser.navigate(`${browserBase}/api/auth/oidc/login`);
  await forgedOidcBrowser.waitFor('document.querySelector("#username") !== null', 'Keycloak username form for forged callback test');
  const forgedResponseStart = forgedOidcBrowser.networkResponses.length;
  await forgedOidcBrowser.navigate(`${browserBase}/signin-oidc?code=synthetic-invalid-code&state=synthetic-forged-state`);
  const forgedResponse = await forgedOidcBrowser.waitForResponse(
    response => response.url.includes('/signin-oidc?') && response.status >= 400,
    'forged OIDC callback rejection', forgedResponseStart);
  assert.equal(forgedResponse.status, 400);
  const forgedSession = await forgedOidcBrowser.evaluate(`fetch('/api/session').then(value => value.json())`);
  assert.equal(forgedSession.authenticated, false, 'A forged OIDC callback must not establish a session');
  await forgedOidcBrowser.close();

  const browser = await createCdpSession('about:blank');
  await browser.clearCookies(browserBase);
  await browser.navigate(`${browserBase}/api/auth/oidc/login`);
  await browser.waitFor('document.querySelector("#username") !== null', 'Keycloak username form');
  await browser.evaluate(`document.querySelector('#username').value = 'live-sso'; document.querySelector('#password').value = ${JSON.stringify(keycloakUserPassword)}; document.querySelector('#kc-login').click();`);
  await browser.waitFor(`location.origin === ${JSON.stringify(browserBase)} && location.pathname === '/'`, 'OIDC callback and application redirect');
  const session = await browser.evaluate(`fetch('/api/session').then(value => value.json())`);
  assert.equal(session.authenticated, true, JSON.stringify(session));
  assert.equal(session.username, anchorUsername);
  assert.equal(session.isDirectoryManaged, false);
  assert.equal(await browser.evaluate(`document.cookie.includes('Fylkren.Auth')`), false, 'Authentication cookie must be HttpOnly');
  assert.equal(await browser.evaluate(`Object.keys(localStorage).some(key => /token/i.test(key)) || Object.keys(sessionStorage).some(key => /token/i.test(key))`), false,
    'OIDC tokens must not be stored in browser storage');
  const oidcCallback = browser.networkRequests.find(request =>
    request.url.startsWith(`${browserBase}/signin-oidc`) &&
    (request.url.includes('code=') || request.postData?.includes('code=')));
  assert.ok(oidcCallback,
    `The successful OIDC callback request was not observed: ${JSON.stringify(browser.networkRequests.map(request => ({ method: request.method, url: request.url, hasPostData: Boolean(request.postData) })))}`);
  await browser.clearCookies(browserBase);
  const clearedOidcSession = await browser.evaluate(`fetch('/api/session').then(value => value.json())`);
  assert.equal(clearedOidcSession.authenticated, false, 'The OIDC browser session cookie was not cleared before replay');
  const oidcReplay = await browser.evaluate(`fetch(${JSON.stringify(oidcCallback.url)}, {
    method: ${JSON.stringify(oidcCallback.method)},
    headers: ${JSON.stringify(oidcCallback.method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})},
    body: ${oidcCallback.method === 'POST' ? JSON.stringify(oidcCallback.postData) : 'undefined'},
    redirect: 'manual'
  }).then(value => ({ status: value.status, type: value.type }))`);
  assert.equal(oidcReplay.status, 400, `Replayed OIDC callback returned ${JSON.stringify(oidcReplay)}`);
  const replaySession = await browser.evaluate(`fetch('/api/session').then(value => value.json())`);
  assert.equal(replaySession.authenticated, false, 'A replayed OIDC callback must not establish a session');
  await browser.close();

  const negativeConfiguration = {
    ...oidcConfiguration,
    authority: negativeAuthority,
    clientId: 'fylkren-negative-oidc',
    secret: negativeClientSecret,
  };
  assert.equal((await manager.put('/api/platform/identity/providers/oidc', {
    enabled: false, clearSecret: false, configuration: negativeConfiguration,
  })).status, 204);
  assert.equal((await manager.post('/api/platform/identity/providers/oidc/test', {})).status, 204);
  const negativeStored = await manager.request('/api/platform/identity/providers/oidc');
  assert.equal((await manager.put('/api/platform/identity/providers/oidc', {
    enabled: true, clearSecret: false, configuration: negativeStored.body.configuration,
  })).status, 204);
  const negativeLink = await manager.post('/api/platform/identity/oidc-links', {
    username: anchorUsername, subjectId: negativeSubject,
  });
  assert.equal(negativeLink.status, 201, JSON.stringify(negativeLink.body));
  for (const [mode, label] of [['nonce', 'nonce mismatch'], ['audience', 'audience mismatch']]) {
    compose(['exec', '-T', 'api', 'curl', '--fail', '--silent', '--show-error',
      '--cacert', '/run/fylkren-identity-lab/ca.crt', '-X', 'POST', '-d', `value=${mode}`,
      `${negativeAuthority}/mode`]);
    const negativeBrowser = await createCdpSession('about:blank');
    await negativeBrowser.clearCookies(browserBase);
    const responseStart = negativeBrowser.networkResponses.length;
    await negativeBrowser.navigate(`${browserBase}/api/auth/oidc/login`);
    const rejected = await negativeBrowser.waitForResponse(
      response => response.url.includes('/signin-oidc') && response.status >= 400,
      `OIDC ${label} rejection`, responseStart);
    assert.equal(rejected.status, 400);
    const rejectedSession = await negativeBrowser.evaluate(`fetch('/api/session').then(value => value.json())`);
    assert.equal(rejectedSession.authenticated, false, `An OIDC ${label} must not establish a session`);
    await negativeBrowser.close();
  }
  assert.equal((await manager.delete(`/api/platform/identity/oidc-links/${negativeLink.body.id}`)).status, 204);
  assert.equal((await manager.put('/api/platform/identity/providers/oidc', {
    enabled: false, clearSecret: false, configuration: oidcConfiguration,
  })).status, 204);
  assert.equal((await manager.post('/api/platform/identity/providers/oidc/test', {})).status, 204);
  const restoredOriginal = await manager.request('/api/platform/identity/providers/oidc');
  assert.equal((await manager.put('/api/platform/identity/providers/oidc', {
    enabled: true, clearSecret: false, configuration: restoredOriginal.body.configuration,
  })).status, 204);

  const oidcLinks = await manager.request('/api/platform/identity/oidc-links');
  assert.equal(oidcLinks.status, 200);
  assert.equal(oidcLinks.body.length, 1);
  assert.equal(oidcLinks.body[0].providerInstanceId, authority,
    'OIDC links must retain their exact canonical issuer');

  const secondIssuerConfiguration = { ...oidcConfiguration, authority: secondAuthority };
  compose(['exec', '-T', 'postgres', 'psql', '-U', 'fylkren', '-d', 'fylkren', '-v', 'ON_ERROR_STOP=1', '-c',
    `UPDATE external_identity_links SET subject_id = '${secondIssuerSubject}' WHERE id = '${linked.body.id}'`], { stdio: 'inherit' });
  const secondIssuerSaved = await manager.put('/api/platform/identity/providers/oidc', {
    enabled: false, clearSecret: false, configuration: secondIssuerConfiguration,
  });
  assert.equal(secondIssuerSaved.status, 204, JSON.stringify(secondIssuerSaved.body));
  const secondIssuerTested = await manager.post('/api/platform/identity/providers/oidc/test', {});
  assert.equal(secondIssuerTested.status, 204, JSON.stringify(secondIssuerTested.body));
  const secondIssuerStored = await manager.request('/api/platform/identity/providers/oidc');
  const secondIssuerActivated = await manager.put('/api/platform/identity/providers/oidc', {
    enabled: true, clearSecret: false, configuration: secondIssuerStored.body.configuration,
  });
  assert.equal(secondIssuerActivated.status, 204, JSON.stringify(secondIssuerActivated.body));

  const collisionBrowser = await createCdpSession('about:blank');
  await collisionBrowser.clearCookies(browserBase);
  await collisionBrowser.navigate(`${browserBase}/api/auth/oidc/login`);
  await collisionBrowser.waitFor('document.querySelector("#username") !== null', 'second-issuer Keycloak username form');
  const collisionStart = collisionBrowser.networkResponses.length;
  await collisionBrowser.evaluate(`document.querySelector('#username').value = 'live-sso'; document.querySelector('#password').value = ${JSON.stringify(keycloakUserPassword)}; document.querySelector('#kc-login').click();`);
  const collisionResponse = await collisionBrowser.waitForResponse(
    response => response.url.includes('/signin-oidc') && response.status >= 400,
    'unlinked second-issuer rejection', collisionStart);
  assert.equal(collisionResponse.status, 400);
  const collisionSession = await collisionBrowser.evaluate(`fetch('/api/session').then(value => value.json())`);
  assert.equal(collisionSession.authenticated, false,
    'The same subject from a different issuer must not match the existing link');
  await collisionBrowser.close();

  const secondIssuerLinked = await manager.post('/api/platform/identity/oidc-links', {
    username: anchorUsername, subjectId: secondIssuerSubject,
  });
  assert.equal(secondIssuerLinked.status, 201, JSON.stringify(secondIssuerLinked.body));
  const linksAcrossIssuers = await manager.request('/api/platform/identity/oidc-links');
  assert.deepEqual(new Set(linksAcrossIssuers.body.map(value => value.providerInstanceId)),
    new Set([authority, secondAuthority]));
  const secondIssuerUnlinked = await manager.delete(`/api/platform/identity/oidc-links/${secondIssuerLinked.body.id}`);
  assert.equal(secondIssuerUnlinked.status, 204, JSON.stringify(secondIssuerUnlinked.body));
  const secondIssuerRelinked = await manager.post('/api/platform/identity/oidc-links', {
    username: anchorUsername, subjectId: secondIssuerSubject,
  });
  assert.equal(secondIssuerRelinked.status, 201, JSON.stringify(secondIssuerRelinked.body));

  compose(['exec', '-T', 'postgres', 'psql', '-U', 'fylkren', '-d', 'fylkren', '-v', 'ON_ERROR_STOP=1', '-c',
    `UPDATE external_identity_links SET subject_id = '${externalSubject}' WHERE id = '${linked.body.id}'`], { stdio: 'inherit' });

  const originalIssuerSaved = await manager.put('/api/platform/identity/providers/oidc', {
    enabled: false, clearSecret: false, configuration: oidcConfiguration,
  });
  assert.equal(originalIssuerSaved.status, 204, JSON.stringify(originalIssuerSaved.body));
  assert.equal((await manager.post('/api/platform/identity/providers/oidc/test', {})).status, 204);
  const originalIssuerStored = await manager.request('/api/platform/identity/providers/oidc');
  assert.equal((await manager.put('/api/platform/identity/providers/oidc', {
    enabled: true, clearSecret: false, configuration: originalIssuerStored.body.configuration,
  })).status, 204);

  const originalUnlinked = await manager.delete(`/api/platform/identity/oidc-links/${linked.body.id}`);
  assert.equal(originalUnlinked.status, 204, JSON.stringify(originalUnlinked.body));
  const originalRelinked = await manager.post('/api/platform/identity/oidc-links', {
    username: anchorUsername, subjectId: externalSubject,
  });
  assert.equal(originalRelinked.status, 201, JSON.stringify(originalRelinked.body));

  const managerLink = await manager.post('/api/platform/identity/oidc-links', {
    username: managerUsername, subjectId: managerExternalSubject,
  });
  assert.equal(managerLink.status, 201, JSON.stringify(managerLink.body));
  const localSettings = await manager.request('/api/platform/identity/local');
  const directSsoPresentation = await manager.put('/api/platform/identity/local', {
    enabled: true,
    clearSecret: false,
    configuration: { ...localSettings.body.configuration, ssoAutoRedirectProvider: 'oidc' },
  });
  assert.equal(directSsoPresentation.status, 204, JSON.stringify(directSsoPresentation.body));
  const directSsoBrowser = await createCdpSession('about:blank');
  await directSsoBrowser.clearCookies(browserBase);
  await directSsoBrowser.navigate(`${browserBase}/`);
  await directSsoBrowser.waitFor(`location.hostname === 'keycloak.test'`, 'automatic OIDC redirect');
  await directSsoBrowser.close();
  const emergencyLocalBrowser = await createCdpSession('about:blank');
  await emergencyLocalBrowser.clearCookies(browserBase);
  await emergencyLocalBrowser.navigate(`${browserBase}/?local=1`);
  await emergencyLocalBrowser.waitFor(`location.hostname === 'localhost' && document.querySelector('#username') !== null`,
    'emergency local login presentation');
  assert.equal(await emergencyLocalBrowser.evaluate(`document.body.innerText.includes('Local account') || document.body.innerText.includes('Username or email address')`), true);
  await emergencyLocalBrowser.close();
  const oidcDisabledWithDirectSso = await manager.put('/api/platform/identity/providers/oidc', {
    enabled: false, clearSecret: false, configuration: oidcConfiguration,
  });
  assert.equal(oidcDisabledWithDirectSso.status, 204, JSON.stringify(oidcDisabledWithDirectSso.body));
  const directSsoCancelled = await manager.request('/api/configuration/public');
  assert.equal(directSsoCancelled.body.authentication.ssoAutoRedirectProvider, null,
    'Disabling the selected provider must cancel direct SSO');
  assert.equal((await manager.put('/api/platform/identity/providers/oidc', {
    enabled: true, clearSecret: false, configuration: oidcConfiguration,
  })).status, 204);
  assert.equal((await manager.put('/api/platform/identity/local', {
    enabled: true,
    clearSecret: false,
    configuration: { ...localSettings.body.configuration, ssoAutoRedirectProvider: 'oidc' },
  })).status, 204);
  const directSsoEnabled = await manager.put('/api/platform/identity/local', {
    enabled: false,
    clearSecret: false,
    configuration: { ...localSettings.body.configuration, ssoAutoRedirectProvider: 'oidc' },
  });
  assert.equal(directSsoEnabled.status, 204, JSON.stringify(directSsoEnabled.body));
  const publicDirectSso = await manager.request('/api/configuration/public');
  assert.equal(publicDirectSso.body.authentication.localEnabled, false);
  assert.equal(publicDirectSso.body.authentication.ssoAutoRedirectProvider, 'oidc');
  const blockedLastManagerUnlink = await manager.delete(`/api/platform/identity/oidc-links/${managerLink.body.id}`);
  assert.equal(blockedLastManagerUnlink.status, 409,
    'The final external Platform Manager path must not be removable while local login is disabled');
  const localRestored = await manager.put('/api/platform/identity/local', {
    enabled: true,
    clearSecret: false,
    configuration: { ...localSettings.body.configuration, ssoAutoRedirectProvider: null },
  });
  assert.equal(localRestored.status, 204, JSON.stringify(localRestored.body));
  assert.equal((await manager.delete(`/api/platform/identity/oidc-links/${managerLink.body.id}`)).status, 204);

  const samlAnchorUsername = `saml-anchor-${randomBytes(4).toString('hex')}`;
  const samlAnchor = await manager.post(`/api/sites/${site.body.id}/access/local-users`, {
    displayName: 'Synthetic SAML Anchor', email: `${samlAnchorUsername}@example.invalid`,
    username: samlAnchorUsername, organizationUnitId: null,
  });
  assert.equal(samlAnchor.status, 201, JSON.stringify(samlAnchor.body));
  const samlConfiguration = {
    ...oidcConfiguration,
    secret: null,
    authority: null,
    clientId: null,
    metadataUrl: `${authority}/protocol/saml/descriptor`,
    entityId: `${browserBase}/api/auth/saml2`,
    identityProviderEntityId: authority,
    modulePath: '/api/auth/saml2',
  };
  process.stdout.write('Checking ASVS 1.5.1 XML metadata boundaries...\n');
  for (const variant of ['valid', 'external', 'internal', 'oversized']) {
    const savedXml = await manager.put('/api/platform/identity/providers/saml', { enabled: false, clearSecret: false,
      configuration: { ...samlConfiguration, metadataUrl: `${negativeAuthority}/metadata-xml?variant=${variant}`, identityProviderEntityId: negativeAuthority } });
    assert.equal(savedXml.status, 204, `XML ${variant} configuration failed`);
    const testedXml = await manager.post('/api/platform/identity/providers/saml/test', {});
    assert.equal(testedXml.status, variant === 'valid' ? 204 : 502, `XML ${variant} validation returned ${testedXml.status}`);
    if (variant !== 'valid') assert.doesNotMatch(JSON.stringify(testedXml.body), /DOCTYPE|SYNTHETIC_XML_CANARY|XmlException|stack trace/i);
  }
  const xmlProbes = compose(['exec', '-T', 'api', 'curl', '--fail', '--silent', '--show-error',
    '--cacert', '/run/fylkren-identity-lab/ca.crt', `${negativeAuthority}/xml-probes`]);
  assert.equal(JSON.parse(xmlProbes).xmlCanaryRequests, 0, 'XML parsing fetched an external entity');
  const samlSaved = await manager.put('/api/platform/identity/providers/saml', { enabled: false, clearSecret: false, configuration: samlConfiguration });
  assert.equal(samlSaved.status, 204, JSON.stringify(samlSaved.body));
  const samlTested = await manager.post('/api/platform/identity/providers/saml/test', {});
  assert.equal(samlTested.status, 204, JSON.stringify(samlTested.body));
  const samlStored = await manager.request('/api/platform/identity/providers/saml');
  assert.equal(samlStored.body.lastTestSucceeded, true);
  const samlActivated = await manager.put('/api/platform/identity/providers/saml', { enabled: true, clearSecret: false, configuration: samlStored.body.configuration });
  assert.equal(samlActivated.status, 204, JSON.stringify(samlActivated.body));
  const samlLinked = await manager.post('/api/platform/identity/saml-links', { username: samlAnchorUsername, nameId: externalSubject });
  assert.equal(samlLinked.status, 201, JSON.stringify(samlLinked.body));
  const samlLinks = await manager.request('/api/platform/identity/saml-links');
  assert.equal(samlLinks.status, 200);
  assert.equal(samlLinks.body[0].providerInstanceId, authority,
    'SAML links must retain the exact IdP entity ID');
  const samlChallenge = await manager.request('/api/auth/saml/login');
  assert.ok([302, 303].includes(samlChallenge.status), `SAML challenge: ${JSON.stringify(samlChallenge)}`);

  const tamperedSamlBrowser = await createCdpSession('about:blank');
  await tamperedSamlBrowser.clearCookies(browserBase);
  await tamperedSamlBrowser.navigate(`${browserBase}/api/auth/saml/login`);
  await tamperedSamlBrowser.waitFor('document.querySelector("#username") !== null', 'Keycloak SAML username form for tampering test');
  let assertionTampered = false;
  tamperedSamlBrowser.on('Fetch.requestPaused', async parameters => {
    const form = new URLSearchParams(parameters.request.postData ?? '');
    const encodedResponse = form.get('SAMLResponse');
    assert.ok(encodedResponse, 'Intercepted SAML callback did not contain SAMLResponse');
    const xml = Buffer.from(encodedResponse, 'base64').toString('utf8');
    assert.ok(xml.includes(externalSubject), 'Signed SAML assertion did not contain the persistent NameID');
    const alteredSubject = `${externalSubject.slice(0, -1)}2`;
    form.set('SAMLResponse', Buffer.from(xml.replace(externalSubject, alteredSubject)).toString('base64'));
    assertionTampered = true;
    await tamperedSamlBrowser.call('Fetch.continueRequest', {
      requestId: parameters.requestId,
      postData: Buffer.from(form.toString()).toString('base64'),
    });
  });
  await tamperedSamlBrowser.call('Fetch.enable', {
    patterns: [{ urlPattern: '*://localhost:18444/api/auth/saml2/Acs*', requestStage: 'Request' }],
  });
  const tamperedResponseStart = tamperedSamlBrowser.networkResponses.length;
  await tamperedSamlBrowser.evaluate(`document.querySelector('#username').value = 'live-sso'; document.querySelector('#password').value = ${JSON.stringify(keycloakUserPassword)}; document.querySelector('#kc-login').click();`);
  const tamperedResponse = await tamperedSamlBrowser.waitForResponse(
    response => response.url.includes('/api/auth/saml2/Acs') && response.status >= 400,
    'tampered SAML assertion rejection', tamperedResponseStart);
  assert.ok(assertionTampered, 'The SAML assertion was not intercepted and altered');
  assert.equal(tamperedResponse.status, 400);
  const tamperedSession = await tamperedSamlBrowser.evaluate(`fetch('/api/session').then(value => value.json())`);
  assert.equal(tamperedSession.authenticated, false, 'A signature-invalid SAML assertion must not establish a session');
  await tamperedSamlBrowser.close();

  process.stdout.write('Checking rejection of a deliberately unsigned SAML response...\n');
  const unsignedSamlBrowser = await createCdpSession('about:blank');
  await unsignedSamlBrowser.clearCookies(browserBase);
  await unsignedSamlBrowser.navigate(`${browserBase}/api/auth/saml/login`);
  await unsignedSamlBrowser.waitFor('document.querySelector("#username") !== null', 'Keycloak SAML username form for unsigned assertion test');
  let signaturesRemoved = 0;
  unsignedSamlBrowser.on('Fetch.requestPaused', async parameters => {
    const form = new URLSearchParams(parameters.request.postData ?? '');
    const encodedResponse = form.get('SAMLResponse');
    assert.ok(encodedResponse, 'Intercepted SAML callback did not contain SAMLResponse');
    const xml = Buffer.from(encodedResponse, 'base64').toString('utf8');
    const unsignedXml = xml.replace(/<(?:\w+:)?Signature\b[\s\S]*?<\/(?:\w+:)?Signature>/g, () => {
      signaturesRemoved += 1;
      return '';
    });
    form.set('SAMLResponse', Buffer.from(unsignedXml).toString('base64'));
    await unsignedSamlBrowser.call('Fetch.continueRequest', {
      requestId: parameters.requestId,
      postData: Buffer.from(form.toString()).toString('base64'),
    });
  });
  await unsignedSamlBrowser.call('Fetch.enable', {
    patterns: [{ urlPattern: '*://localhost:18444/api/auth/saml2/Acs*', requestStage: 'Request' }],
  });
  const unsignedResponseStart = unsignedSamlBrowser.networkResponses.length;
  await unsignedSamlBrowser.evaluate(`document.querySelector('#username').value = 'live-sso'; document.querySelector('#password').value = ${JSON.stringify(keycloakUserPassword)}; document.querySelector('#kc-login').click();`);
  const unsignedResponse = await unsignedSamlBrowser.waitForResponse(
    response => response.url.includes('/api/auth/saml2/Acs'),
    'unsigned SAML assertion callback', unsignedResponseStart);
  assert.ok(signaturesRemoved > 0, 'The SAML fixture did not contain a signature to remove');
  assert.equal(unsignedResponse.status, 400);
  const unsignedSession = await unsignedSamlBrowser.evaluate(`fetch('/api/session').then(value => value.json())`);
  assert.equal(unsignedSession.authenticated, false, 'An unsigned SAML assertion must not establish a session');
  await unsignedSamlBrowser.close();

  process.stdout.write('Checking accepted signed SAML response and replay rejection...\n');
  const samlBrowser = await createCdpSession('about:blank');
  await samlBrowser.clearCookies(browserBase);
  await samlBrowser.navigate(`${browserBase}/api/auth/saml/login`);
  await samlBrowser.waitFor('document.querySelector("#username") !== null', 'Keycloak SAML username form');
  await samlBrowser.evaluate(`document.querySelector('#username').value = 'live-sso'; document.querySelector('#password').value = ${JSON.stringify(keycloakUserPassword)}; document.querySelector('#kc-login').click();`);
  await samlBrowser.waitFor(`location.origin === ${JSON.stringify(browserBase)} && location.pathname === '/'`, 'SAML callback and application redirect');
  const samlSession = await samlBrowser.evaluate(`fetch('/api/session').then(value => value.json())`);
  assert.equal(samlSession.authenticated, true, JSON.stringify(samlSession));
  assert.equal(samlSession.username, samlAnchorUsername);
  assert.equal(await samlBrowser.evaluate(`document.cookie.includes('Fylkren.Auth')`), false, 'SAML authentication cookie must be HttpOnly');
  const samlCallback = samlBrowser.networkRequests.find(request =>
    request.url.includes('/api/auth/saml2/Acs') && request.method === 'POST' && request.postData);
  assert.ok(samlCallback, 'The successful SAML callback request was not observed');
  await samlBrowser.clearCookies(browserBase);
  const clearedSamlSession = await samlBrowser.evaluate(`fetch('/api/session').then(value => value.json())`);
  assert.equal(clearedSamlSession.authenticated, false, 'The SAML browser session cookie was not cleared before replay');
  const samlReplay = await samlBrowser.evaluate(`fetch(${JSON.stringify(samlCallback.url)}, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: ${JSON.stringify(samlCallback.postData)}, redirect: 'manual'
  }).then(value => ({ status: value.status, type: value.type }))`);
  assert.equal(samlReplay.status, 400, `Replayed SAML response returned ${JSON.stringify(samlReplay)}`);
  const samlReplaySession = await samlBrowser.evaluate(`fetch('/api/session').then(value => value.json())`);
  assert.equal(samlReplaySession.authenticated, false, 'A replayed SAML response must not establish a session');
  await samlBrowser.close();

  const samlUnlinked = await manager.delete(`/api/platform/identity/saml-links/${samlLinked.body.id}`);
  assert.equal(samlUnlinked.status, 204, JSON.stringify(samlUnlinked.body));
  const samlRelinked = await manager.post('/api/platform/identity/saml-links', {
    username: samlAnchorUsername, nameId: externalSubject,
  });
  assert.equal(samlRelinked.status, 201, JSON.stringify(samlRelinked.body));

  process.stdout.write(`${JSON.stringify({
    liveOidcHttpsMetadata: 'passed',
    oidcSecretProtection: 'passed',
    oidcAuthorizationCodeSignIn: 'passed',
    oidcIssuerMismatchRejection: 'passed',
    oidcForgedStateAndReplayRejection: 'passed',
    oidcNonceMismatchRejection: 'passed',
    oidcAudienceMismatchRejection: 'passed',
    exactIssuerAndSubjectLink: 'passed',
    oidcUnlinkAndRelink: 'passed',
    directSsoAndLocalLockoutGuards: 'passed',
    serverSideSessionWithoutBrowserTokens: 'passed',
    liveSamlSignedAssertion: 'passed',
    samlTamperedUnsignedAndReplayRejection: 'passed',
    exactSamlEntityAndPersistentNameIdLink: 'passed',
    samlUnlinkAndRelink: 'passed',
    samlServerSideSession: 'passed',
    xmlMetadataDtdAndExternalEntityRejection: 'passed',
    xmlMetadataSizeBoundary: 'passed',
  }, null, 2)}\n`);
} catch (error) {
  if (started) {
    try { compose(['logs', '--no-color', '--tail', '200', 'api', 'keycloak', 'oidc-negative-provider'], { stdio: 'inherit' }); }
    catch (logError) { process.stderr.write(`Could not collect identity-lab logs: ${logError.message}\n`); }
  }
  throw error;
} finally {
  if (started) {
    try { compose(['down', '-v'], { stdio: 'inherit' }); }
    catch (error) { process.stderr.write(`Cleanup failed: ${error.message}\n`); }
  }
  rmSync(labDirectory, { recursive: true, force: true });
}
