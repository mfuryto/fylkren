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
const externalSubject = '11111111-1111-4111-8111-111111111111';
const authority = 'https://keycloak.test:18443/realms/fylkren-lab';
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
  writeFileSync(join(labDirectory, 'gateway.conf'), `events {}\nhttp {\n  server {\n    listen 18444 ssl;\n    server_name localhost metadata.test;\n    ssl_certificate /run/fylkren-identity-lab/gateway.crt;\n    ssl_certificate_key /run/fylkren-identity-lab/gateway.key;\n    location = /oidc-mismatch/.well-known/openid-configuration {\n      default_type application/json;\n      return 200 '{"issuer":"https://issuer-mismatch.example.invalid","authorization_endpoint":"https://issuer-mismatch.example.invalid/auth","token_endpoint":"https://issuer-mismatch.example.invalid/token","jwks_uri":"https://issuer-mismatch.example.invalid/keys"}';\n    }\n    location / {\n      proxy_pass http://web:8080;\n      proxy_set_header Host $http_host;\n      proxy_set_header X-Forwarded-Host $http_host;\n      proxy_set_header X-Forwarded-Proto https;\n      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    }\n  }\n  server {\n    listen 18090;\n    server_name localhost;\n    location / {\n      proxy_pass http://web:8080;\n      proxy_set_header Host localhost:18444;\n      proxy_set_header X-Forwarded-Host localhost:18444;\n      proxy_set_header X-Forwarded-Proto https;\n      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    }\n  }\n}\n`);
  chmodSync(caCertificate, 0o644);
  chmodSync(certificate, 0o644);
  chmodSync(key, 0o600);
  chmodSync(gatewayCertificate, 0o644);
  chmodSync(gatewayKey, 0o600);
}

function createRealm() {
  writeFileSync(join(labDirectory, 'realm.json'), JSON.stringify({
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
    close: () => socket.close(),
  };
}

let started = false;
try {
  createCertificates();
  createRealm();
  process.stdout.write('Building and starting the isolated OIDC/SAML identity lab...\n');
  started = true;
  compose(['up', '-d', '--build', '--wait'], { stdio: 'inherit' });
  await waitForKeycloak();
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
  forgedOidcBrowser.close();

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
  browser.close();

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
  tamperedSamlBrowser.close();

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
  samlBrowser.close();

  process.stdout.write(`${JSON.stringify({
    liveOidcHttpsMetadata: 'passed',
    oidcSecretProtection: 'passed',
    oidcAuthorizationCodeSignIn: 'passed',
    oidcIssuerMismatchRejection: 'passed',
    oidcForgedStateAndReplayRejection: 'passed',
    stableIssuerAndSubjectLink: 'passed',
    serverSideSessionWithoutBrowserTokens: 'passed',
    liveSamlSignedAssertion: 'passed',
    samlTamperedAssertionAndReplayRejection: 'passed',
    persistentSamlNameIdLink: 'passed',
    samlServerSideSession: 'passed',
  }, null, 2)}\n`);
} catch (error) {
  if (started) {
    try { compose(['logs', '--no-color', '--tail', '200', 'api', 'keycloak'], { stdio: 'inherit' }); }
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
