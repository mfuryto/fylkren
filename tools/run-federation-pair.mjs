import assert from 'node:assert/strict';
import { createHash, createPublicKey, generateKeyPairSync, randomBytes, randomUUID, sign, verify } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { connect as tlsConnect, getCACertificates, setDefaultCACertificates } from 'node:tls';

const composeFile = 'tools/e2e/federation-pair.compose.yaml';
const currentImage = 'fylkren-federation-pair-test-api:local';
const oldCommit = '152d0f2';
const oldImage = `fylkren-federation-pair-test-api:mixed-${oldCommit}`;
const outboundOnly = process.argv.includes('--outbound-only');
const operationalOnly = process.argv.includes('--operational-only');
const loadOnly = process.argv.includes('--load-only');
const restoreOnly = process.argv.includes('--restore-only');
const retentionOnly = process.argv.includes('--retention-only');
const productionBoundaryOnly = process.argv.includes('--production-boundary-only');
const messageBoundaryOnly = process.argv.includes('--message-boundary-only');
if ([loadOnly, restoreOnly, retentionOnly, productionBoundaryOnly, operationalOnly, outboundOnly, messageBoundaryOnly].filter(Boolean).length > 1)
  throw new Error('Federation pair modes are mutually exclusive');
const project = `fylkren-pair-${randomBytes(4).toString('hex')}`;
const temporary = mkdtempSync(join(tmpdir(), 'fylkren-federation-pair-'));
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const env = {
  ...process.env,
  COMPOSE_PROGRESS: 'plain',
  FYLKREN_PAIR_TMP: temporary,
  FYLKREN_PAIR_ISSUER_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  FYLKREN_PAIR_API_B_IMAGE: currentImage,
};
const productionBoundary = productionBoundaryOnly || messageBoundaryOnly || (!loadOnly && !restoreOnly && !retentionOnly && !operationalOnly && !outboundOnly);
if (productionBoundary) env.FYLKREN_PAIR_ASPNETCORE_ENVIRONMENT = 'Production';

function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { stdio: 'inherit', env, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${executable} exited with ${result.status}`);
}
function commandOutput(executable, args, options = {}) {
  const result = spawnSync(executable, args, { env, encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${executable} exited with ${result.status}: ${result.stderr}`);
  return result.stdout.trim();
}
function compose(args) { command('docker', ['compose', '-p', project, '-f', composeFile, ...args]); }
function buildOldImage() {
  const archive = join(temporary, `${oldCommit}.tar`);
  const source = join(temporary, `source-${oldCommit}`);
  mkdirSync(source);
  const repository = existsSync('.git-local') ? ['--git-dir=.git-local'] : [];
  command('git', [...repository, 'archive', '--format=tar',
    `--output=${archive}`, oldCommit]);
  command('tar', ['-xf', archive, '-C', source]);
  command('docker', ['build', '-t', oldImage, '-f',
    join(source, 'apps/api/Dockerfile'), source]);
}

function switchReceiverImage(image) {
  compose(['stop', 'tls', 'web-b', 'api-b-replica', 'api-b']);
  env.FYLKREN_PAIR_API_B_IMAGE = image;
  compose(['up', '-d', '--no-build', '--force-recreate', '--wait', 'api-b']);
  compose(['up', '-d', '--no-build', '--force-recreate', '--wait', 'api-b-replica']);
  compose(['up', '-d', '--no-build', '--force-recreate', '--no-deps', '--wait', 'web-b']);
  compose(['up', '-d', '--no-build', '--force-recreate', '--no-deps', '--wait', 'tls']);
}
function sql(databaseService, statement) {
  compose(['exec', '-T', databaseService, 'psql', '-v', 'ON_ERROR_STOP=1',
    '-U', 'fylkren', '-d', 'fylkren', '-c', statement]);
}
function sqlValue(databaseService, statement) {
  const result = spawnSync('docker', ['compose', '-p', project, '-f', composeFile,
    'exec', '-T', databaseService, 'psql', '-v', 'ON_ERROR_STOP=1',
    '-U', 'fylkren', '-d', 'fylkren', '-tAc', statement],
  { env, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

function startSqlLock(databaseService, statement) {
  const marker = `FYLKREN_LOCK_READY_${randomBytes(6).toString('hex')}`;
  const child = spawn('docker', ['compose', '-p', project, '-f', composeFile,
    'exec', '-T', databaseService, 'psql', '-v', 'ON_ERROR_STOP=1',
    '-U', 'fylkren', '-d', 'fylkren', '-c',
    `BEGIN; ${statement}; SELECT pg_sleep(15) /* ${marker} */; COMMIT;`],
  { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  let lockSettled = false;
  let resolveLock;
  let rejectLock;
  const locked = new Promise((resolve, reject) => {
    resolveLock = resolve;
    rejectLock = reject;
  });
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  void (async () => {
    for (let attempt = 0; attempt < 80 && !lockSettled; attempt++) {
      const active = sqlValue(databaseService, `SELECT COUNT(*) FROM pg_stat_activity
        WHERE pid <> pg_backend_pid() AND state = 'active' AND wait_event = 'PgSleep'
          AND query LIKE '%${marker}%'`);
      if (active === '1') {
        lockSettled = true;
        resolveLock();
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!lockSettled) {
      lockSettled = true;
      rejectLock(new Error(`Database lock was not observed while held: ${stderr || stdout}`));
    }
  })();
  const done = new Promise((resolve, reject) => child.on('close', code => {
    if (!lockSettled) {
      lockSettled = true;
      rejectLock(new Error(`Database lock exited before acquisition: ${stderr || stdout}`));
    }
    if (code === 0) resolve();
    else reject(new Error(`Database lock exited with ${code}: ${stderr || stdout}`));
  }));
  child.on('error', error => {
    if (!lockSettled) {
      lockSettled = true;
      rejectLock(error);
    }
  });
  return { locked, done };
}

async function awaitLockWaiters(databaseService, minimum, label) {
  let waiters = 0;
  for (let attempt = 0; attempt < 80; attempt++) {
    waiters = Number(sqlValue(databaseService, `SELECT COUNT(*) FROM pg_stat_activity
      WHERE pid <> pg_backend_pid() AND datname = 'fylkren' AND wait_event_type = 'Lock'`));
    if (waiters >= minimum) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail(`${label}: expected ${minimum} database lock waiters, observed ${waiters}`);
}

function license(instanceId) {
  const payload = Buffer.from(JSON.stringify({
    schemaVersion: 1, licenseId: randomUUID(), instanceId, customer: 'Synthetic pair test',
    notBefore: '2020-01-01T00:00:00Z', expiresAt: '2100-01-01T00:00:00Z',
    entitlements: outboundOnly ? ['instance-federation', 'webhooks'] : ['instance-federation'],
  }));
  return {
    payload: payload.toString('base64'),
    signature: sign('sha256', payload, { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64'),
  };
}

function client(base) {
  const cookies = new Map();
  let csrf;
  async function request(path, method = 'GET', data) {
    // The mixed-version sequence recreates the TLS proxy while retaining the
    // same address. Do not let undici reuse a socket owned by the old proxy.
    const headers = { Connection: 'close' };
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    if (csrf && method !== 'GET') headers['X-Fylkren-CSRF'] = csrf;
    if (cookies.size) headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    const response = await fetch(`${base}${path}`, {
      method, headers, body: data === undefined ? undefined : JSON.stringify(data), redirect: 'manual',
    });
    for (const value of response.headers.getSetCookie()) {
      const [pair] = value.split(';');
      const split = pair.indexOf('=');
      if (split > 0) cookies.set(pair.slice(0, split), pair.slice(split + 1));
    }
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: response.status, body };
  }
  return {
    request,
    post: (path, data) => request(path, 'POST', data),
    put: (path, data) => request(path, 'PUT', data),
    async csrf() {
      const result = await request('/api/security/antiforgery');
      assert.equal(result.status, 200, JSON.stringify(result.body));
      csrf = result.body.token;
    },
  };
}

async function setup(base, label) {
  const api = client(base);
  const username = `pair-${label}`;
  const password = `V7!${randomBytes(22).toString('base64url')}#z`;
  const bootstrap = await api.post('/api/bootstrap/platform-manager', {
    username, displayName: `Synthetic Manager ${label}`,
    email: `pair-${label}@example.invalid`, password,
  });
  assert.equal(bootstrap.status, 201, JSON.stringify(bootstrap.body));
  await api.csrf();
  const status = await api.request('/api/platform/license');
  assert.equal(status.status, 200, JSON.stringify(status.body));
  const instanceId = status.body.status.instanceId;
  const imported = await api.post('/api/platform/license', license(instanceId));
  assert.equal(imported.status, 200, JSON.stringify(imported.body));
  assert.equal(imported.body.status.edition, 'enterprise');
  const identity = await api.post('/api/platform/federation/identity', {});
  assert.equal(identity.status, 200, JSON.stringify(identity.body));
  const siteName = `Synthetic Root ${label}`;
  const site = await api.post('/api/sites/', { name: siteName, overviewDesign: 'classic' });
  assert.equal(site.status, 201, JSON.stringify(site.body));
  return {
    api, instanceId, publicKeySpki: identity.body.publicKeySpki, siteId: site.body.id, siteName,
    credentials: { username, password },
  };
}

async function expectStatus(promise, status, label) {
  const result = await promise;
  assert.equal(result.status, status, `${label}: ${JSON.stringify(result.body)}`);
  return result.body;
}

async function expectEventuallyStatus(action, status, label, retryStatuses = [502]) {
  let result;
  for (let attempt = 0; attempt < 70; attempt++) {
    result = await action();
    if (result.status === status) return result.body;
    if (!retryStatuses.includes(result.status)) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(result?.status, status, `${label}: ${JSON.stringify(result?.body)}`);
  return result.body;
}

function percentile(values, percentage) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * percentage) - 1];
}

async function assertProxyLoadControls(receiver) {
  const hostileHeaders = await fetch('https://localhost:18444/api/configuration/public', {
    redirect: 'manual',
    headers: {
      'X-Forwarded-Proto': 'http',
      'X-Forwarded-For': '203.0.113.77, 198.51.100.88',
      'X-Forwarded-Host': 'attacker.example.invalid',
      'X-Fylkren-Gateway-Client-IP': '192.0.2.99',
    },
  });
  assert.equal(hostileHeaders.status, 200,
    'Caller-controlled intermediary headers overrode the trusted TLS/Host boundary');
  assert.equal(hostileHeaders.headers.get('location'), null,
    'Caller-controlled intermediary headers caused an application redirect');

  // Start with empty in-memory limiter partitions while retaining the initialized database/key ring.
  compose(['restart', 'api-b', 'api-b-replica']);
  compose(['up', '-d', '--no-build', '--wait', 'api-b', 'api-b-replica', 'web-b', 'tls']);

  const oversizedCases = [
    ['/api/federation/v1/cancel', 16_384],
    ['/api/federation/v1/answer', 150_000],
    ['/api/federation/v1/work', 300_000],
    ['/api/federation/v1/identity/discover', 3 * 1024 * 1024],
  ];
  for (const [path, limit] of oversizedCases) {
    const result = await receiver.api.post(path, { padding: 'x'.repeat(limit) });
    assert.equal(result.status, 413,
      `${path} did not reject a body above ${limit} bytes: ${JSON.stringify(result.body)}`);
  }

  // Body-limit probes can consume the same client permits. Let the real fixed
  // window replenish before measuring its boundary through the proxy.
  await new Promise(resolve => setTimeout(resolve, 61_000));

  const requesterInstanceId = randomUUID();
  const samples = await Promise.all(Array.from({ length: 20 }, async () => {
    const started = performance.now();
    const result = await receiver.api.post('/api/federation/v1/identity/discover', {
      requesterInstanceId, nonce: randomUUID(),
    });
    return {
      status: result.status,
      elapsedMs: performance.now() - started,
      responseBytes: Buffer.byteLength(JSON.stringify(result.body)),
    };
  }));
  assert.deepEqual([...new Set(samples.map(sample => sample.status))], [200],
    `Allowed concurrent discovery load failed: ${JSON.stringify(samples)}`);

  const limited = await receiver.api.post('/api/federation/v1/identity/discover', {
    requesterInstanceId, nonce: randomUUID(),
  });
  assert.equal(limited.status, 429, 'The 21st shared federation-probe request was not rate limited');
  const spoofed = await fetch('https://localhost:18444/api/federation/v1/identity/discover', {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.77' },
    body: JSON.stringify({ requesterInstanceId, nonce: randomUUID() }),
  });
  assert.equal(spoofed.status, 429,
    'A caller-controlled X-Forwarded-For value escaped the exhausted client partition');

  const capability = await receiver.api.post('/api/federation/v1/capabilities', {});
  assert.notEqual(capability.status, 429,
    'The capability limiter unexpectedly shared the federation-probe partition');

  function discoveryFrom(service) {
    const body = JSON.stringify({ requesterInstanceId: randomUUID(), nonce: randomUUID() });
    return Number(commandOutput('docker', ['compose', '-p', project, '-f', composeFile,
      'exec', '-T', service, 'curl', '--silent', '--output', '/dev/null', '--write-out', '%{http_code}',
      '--header', 'Content-Type: application/json', '--data', body,
      'https://tls:444/api/federation/v1/identity/discover']));
  }
  assert.equal(discoveryFrom('api-a'), 200,
    'A distinct client behind the proxy did not receive its own rate partition');
  assert.equal(discoveryFrom('api-b-replica'), 200,
    'A second distinct client behind the proxy did not receive its own rate partition');

  const elapsed = samples.map(sample => sample.elapsedMs);
  const metrics = {
    requestsAtLimit: 20,
    concurrentRequests: samples.length,
    successfulConcurrentRequests: samples.filter(sample => sample.status === 200).length,
    p50Ms: Math.round(percentile(elapsed, 0.50)),
    p95Ms: Math.round(percentile(elapsed, 0.95)),
    p99Ms: Math.round(percentile(elapsed, 0.99)),
    maxResponseBytes: Math.max(...samples.map(sample => sample.responseBytes)),
  };
  process.stdout.write(`${JSON.stringify({ federationProxyLoad: 'passed',
    hostileIntermediaryHeadersStatus: hostileHeaders.status,
    hostileIntermediaryHeadersRedirected: false,
    bodyLimits: oversizedCases.map(([path, limit]) => ({ path, limit, status: 413 })),
    rateLimitStatus: limited.status, spoofedForwardedForStatus: spoofed.status,
    capabilityPartitionStatus: capability.status, distinctClientStatuses: [200, 200],
    metrics })}\n`);
}

async function runLoadPair() {
  const receiver = await setup('https://localhost:18444', 'load');
  await assertProxyLoadControls(receiver);
}

function rawTlsRequest(payload) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const socket = tlsConnect({ host: 'localhost', port: 18444, servername: 'localhost' }, () =>
      socket.end(payload));
    socket.setEncoding('latin1');
    socket.on('data', chunk => chunks.push(chunk));
    socket.setTimeout(4_000, () => socket.destroy());
    socket.on('error', error => {
      if (chunks.length === 0) reject(error);
    });
    socket.on('close', () => resolve(chunks.join('')));
  });
}

function rawInternalRequest(host, payload) {
  const result = spawnSync('docker', ['compose', '-p', project, '-f', composeFile,
    'exec', '-T', 'tls', 'nc', '-w', '4', host, '8080'],
  { env, input: payload, encoding: 'latin1', timeout: 6_000 });
  if (result.error) throw result.error;
  return result.stdout ?? '';
}

function assertSingleRejectedMessage(response, target, probe) {
  const statuses = [...response.matchAll(/^HTTP\/1\.[01]\s+(\d{3})/gm)].map(match => Number(match[1]));
  assert.ok(statuses.length === 0 || (statuses.length === 1 && statuses[0] === 400),
    `${target}/${probe}: unexpected raw response: ${response.slice(0, 500)}`);
  assert.doesNotMatch(response, /\r?\nHealthy\r?\n/i,
    `${target}/${probe}: a trailing health request crossed the message boundary`);
  return statuses.length === 0 ? 'closed' : '400';
}

async function runMessageBoundaryPair() {
  const host = 'localhost:18444';
  const trailing = `GET /health HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`;
  const probes = new Map([
    ['conflicting-content-length', `POST /api/session HTTP/1.1\r\nHost: ${host}\r\nContent-Type: application/json\r\nContent-Length: 0\r\nContent-Length: 4\r\nConnection: close\r\n\r\ntest`],
    ['transfer-encoding-and-content-length', `POST /api/session HTTP/1.1\r\nHost: ${host}\r\nContent-Type: application/json\r\nContent-Length: 64\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n0\r\n\r\n${trailing}`],
    ['invalid-chunk-size', `POST /api/session HTTP/1.1\r\nHost: ${host}\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\nZ\r\nprobe\r\n0\r\n\r\n${trailing}`],
    ['whitespace-before-header-colon', `POST /api/session HTTP/1.1\r\nHost: ${host}\r\nContent-Length : 0\r\nConnection: close\r\n\r\n${trailing}`],
  ]);
  const targets = new Map([
    ['outer-tls-proxy', payload => rawTlsRequest(payload)],
    ['built-web-gateway', payload => rawInternalRequest('web-b', payload)],
    ['kestrel-api', payload => rawInternalRequest('api-b', payload)],
  ]);
  const outcomes = { 400: 0, closed: 0 };
  for (const [target, request] of targets) {
    for (const [probe, payload] of probes) {
      const outcome = assertSingleRejectedMessage(await request(payload), target, probe);
      outcomes[outcome]++;
    }
  }
  process.stdout.write(`${JSON.stringify({ httpMessageBoundary: 'passed', protocol: 'HTTP/1.x',
    components: targets.size, malformedProbeFamilies: probes.size,
    malformedRequests: targets.size * probes.size, explicit400: outcomes[400], silentClose: outcomes.closed,
    trailingRequestsProcessed: 0, http2AndHttp3Exposed: false })}\n`);
}

function receiverServicesDown(remove = false) {
  compose(['stop', 'tls', 'web-b', 'api-b-replica', 'api-b']);
  if (remove) compose(['rm', '-f', 'tls', 'web-b', 'api-b-replica', 'api-b']);
}

function receiverServicesUp() {
  compose(['up', '-d', '--no-build', '--wait', 'api-b']);
  compose(['up', '-d', '--no-build', '--wait', 'api-b-replica']);
  compose(['up', '-d', '--no-build', '--force-recreate', '--no-deps', '--wait', 'web-b']);
  compose(['up', '-d', '--no-build', '--force-recreate', '--no-deps', '--wait', 'tls']);
}

function captureDatabaseBackup(path) {
  const result = spawnSync('docker', ['compose', '-p', project, '-f', composeFile,
    'exec', '-T', 'postgres-b', 'pg_dump', '-U', 'fylkren', '-d', 'fylkren', '-Fc'],
  { env, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pg_dump failed: ${result.stderr}`);
  assert.ok(result.stdout.length > 0, 'PostgreSQL backup was empty');
  writeFileSync(path, result.stdout, { mode: 0o600 });
}

function restoreDatabaseBackup(path) {
  compose(['exec', '-T', 'postgres-b', 'dropdb', '--force', '-U', 'fylkren', 'fylkren']);
  compose(['exec', '-T', 'postgres-b', 'createdb', '-U', 'fylkren', 'fylkren']);
  const result = spawnSync('docker', ['compose', '-p', project, '-f', composeFile,
    'exec', '-T', 'postgres-b', 'pg_restore', '-v', '--exit-on-error', '--no-owner',
    '-U', 'fylkren', '-d', 'fylkren'],
  { env, input: readFileSync(path), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pg_restore failed: ${result.stderr}`);
}

function captureKeyRingBackup(path) {
  command('docker', ['run', '--rm', '--user', '0:0', '--entrypoint', 'tar',
    '--volume', `${project}_keys-b:/source:ro`, '--volume', `${temporary}:/backup`,
    currentImage, '-czf', `/backup/${path.split('/').at(-1)}`, '-C', '/source', '.']);
  assert.ok(readFileSync(path).length > 0, 'Data Protection key-ring backup was empty');
}

function replaceKeyRing(archivePath = null) {
  command('docker', ['volume', 'rm', `${project}_keys-b`]);
  command('docker', ['volume', 'create',
    '--label', `com.docker.compose.project=${project}`,
    '--label', 'com.docker.compose.volume=keys-b', `${project}_keys-b`]);
  if (archivePath) {
    command('docker', ['run', '--rm', '--user', '0:0', '--entrypoint', 'tar',
      '--volume', `${project}_keys-b:/target`, '--volume', `${temporary}:/backup:ro`,
      currentImage, '-xzf', `/backup/${archivePath.split('/').at(-1)}`, '-C', '/target']);
  }
}

async function signInAfterRestore(base, credentials) {
  const api = client(base);
  await expectStatus(api.post('/api/session', credentials), 204, 'sign in after restore');
  await api.csrf();
  return api;
}

async function runRestorePair() {
  const a = await setup('https://localhost:18443', 'restore-a');
  const b = await setup('https://localhost:18444', 'restore-b');
  const aPeer = `/api/platform/federation/peers/${b.instanceId}`;
  const bPeer = `/api/platform/federation/peers/${a.instanceId}`;
  const discoveredB = await expectStatus(a.api.post('/api/platform/federation/peers/discover', {
    baseUrl: 'https://tls:444',
  }), 200, 'discover receiver before backup');
  const discoveredA = await expectStatus(b.api.post('/api/platform/federation/peers/discover', {
    baseUrl: 'https://tls:443',
  }), 200, 'discover sender before backup');
  await expectStatus(a.api.post('/api/platform/federation/peers', {
    instanceId: b.instanceId, name: 'Restore B', baseUrl: discoveredB.baseUrl,
    fingerprint: discoveredB.fingerprint,
  }), 201, 'approve receiver before backup');
  await expectStatus(b.api.post('/api/platform/federation/peers', {
    instanceId: a.instanceId, name: 'Restore A', baseUrl: discoveredA.baseUrl,
    fingerprint: discoveredA.fingerprint,
  }), 201, 'approve sender before backup');
  await expectStatus(a.api.post(`${aPeer}/probe`, {}), 200, 'probe receiver before backup');
  await expectStatus(b.api.post(`${bPeer}/probe`, {}), 200, 'probe sender before backup');
  await expectStatus(a.api.post(`${aPeer}/catalog/sync`, {}), 200, 'sync receiver before backup');
  await expectStatus(b.api.post(`${bPeer}/catalog/sync`, {}), 200, 'sync sender before backup');
  await expectStatus(a.api.put('/api/platform/federation/routing', { enabled: true }),
    200, 'enable sender routing before backup');
  await expectStatus(b.api.put('/api/platform/federation/routing', { enabled: true }),
    200, 'enable receiver routing before backup');

  const dumpPath = join(temporary, 'postgres-b.dump');
  const keyPath = join(temporary, 'keys-b.tar.gz');
  receiverServicesDown();
  captureDatabaseBackup(dumpPath);
  captureKeyRingBackup(keyPath);
  receiverServicesUp();

  const postBackupSite = await expectStatus(b.api.post('/api/sites/', {
    name: 'Must disappear after restore', overviewDesign: 'classic',
  }), 201, 'create post-backup marker');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM sites WHERE id = '${postBackupSite.id}'`), '1');

  receiverServicesDown(true);
  restoreDatabaseBackup(dumpPath);
  replaceKeyRing();
  // Provider settings are protected too: the current API refuses startup when
  // the matching key ring is missing, before any local login or signing can occur.
  compose(['up', '-d', '--no-build', 'api-b']);
  const wrongKeyContainer = commandOutput('docker', ['compose', '-p', project, '-f', composeFile, 'ps', '-aq', 'api-b']);
  let wrongKeyState;
  for (let attempt = 0; attempt < 60; attempt++) {
    wrongKeyState = JSON.parse(commandOutput('docker', ['inspect', '--format', '{{json .State}}', wrongKeyContainer]));
    if (wrongKeyState.Status === 'exited') break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.equal(wrongKeyState.Status, 'exited', 'Database-only restore did not fail closed');
  assert.notEqual(wrongKeyState.ExitCode, 0);
  const wrongKeyLog = commandOutput('docker', ['logs', wrongKeyContainer], { stdio: ['ignore', 'pipe', 'pipe'] });
  // Docker writes the unhandled exception to stderr; inspect the complete log privately.
  const failureLog = spawnSync('docker', ['logs', wrongKeyContainer], { env, encoding: 'utf8' });
  assert.match(wrongKeyLog + failureLog.stderr, /CryptographicException/);
  assert.match(wrongKeyLog + failureLog.stderr, /IdentityProviderConfigurationService/);

  receiverServicesDown(true);
  restoreDatabaseBackup(dumpPath);
  replaceKeyRing(keyPath);
  receiverServicesUp();
  const restoredApi = await signInAfterRestore('https://localhost:18444', b.credentials);
  const restoredIdentity = await expectStatus(restoredApi.request(
    '/api/platform/federation/identity'), 200, 'inspect matched restore');
  assert.equal(restoredIdentity.instanceId, b.instanceId);
  assert.equal(restoredIdentity.publicKeySpki, b.publicKeySpki);
  assert.equal(restoredIdentity.fingerprint, discoveredB.fingerprint);
  assert.equal(restoredIdentity.keyUsable, true);
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM sites WHERE id = '${postBackupSite.id}'`), '0',
    'Post-backup mutation survived database restore');
  await expectStatus(a.api.post(`${aPeer}/probe`, {}), 200,
    'existing peer accepts restored signing identity without reapproval');
  await expectStatus(restoredApi.post(`${bPeer}/probe`, {}), 200,
    'restored receiver signs a reciprocal probe');
  const delivered = await assertQueuedOutboundDelivery(a, { ...b, api: restoredApi });
  assert.ok(delivered.counterpartId, 'Matched restore did not accept new federated work');

  process.stdout.write(`${JSON.stringify({ federationMatchedRestore: 'passed',
    databaseOnlyStartupRejected: true, databaseOnlyKeyUsable: false, matchedKeyUsable: true, instanceIdPreserved: true,
    publicKeyPreserved: true, peerReapprovalRequired: false, postBackupMutationRemoved: true,
    bilateralProbeAfterRestore: true, deliveryAfterRestore: true })}\n`);
}

function explain(database, statement) {
  const parsed = JSON.parse(sqlValue(database,
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${statement}`));
  const root = parsed[0].Plan;
  const indexes = [];
  function visit(node) {
    if (node['Index Name']) indexes.push(node['Index Name']);
    for (const child of node.Plans ?? []) visit(child);
  }
  visit(root);
  return { executionMs: parsed[0]['Execution Time'], indexes: [...new Set(indexes)] };
}

async function runRetentionPair() {
  const a = await setup('https://localhost:18443', 'retention-a');
  const b = await setup('https://localhost:18444', 'retention-b');
  const aPeer = `/api/platform/federation/peers/${b.instanceId}`;
  const bPeer = `/api/platform/federation/peers/${a.instanceId}`;
  const discoveredB = await expectStatus(a.api.post('/api/platform/federation/peers/discover', {
    baseUrl: 'https://tls:444',
  }), 200, 'discover retention receiver');
  const discoveredA = await expectStatus(b.api.post('/api/platform/federation/peers/discover', {
    baseUrl: 'https://tls:443',
  }), 200, 'discover retention sender');
  await expectStatus(a.api.post('/api/platform/federation/peers', {
    instanceId: b.instanceId, name: 'Retention B', baseUrl: discoveredB.baseUrl,
    fingerprint: discoveredB.fingerprint,
  }), 201, 'approve retention receiver');
  await expectStatus(b.api.post('/api/platform/federation/peers', {
    instanceId: a.instanceId, name: 'Retention A', baseUrl: discoveredA.baseUrl,
    fingerprint: discoveredA.fingerprint,
  }), 201, 'approve retention sender');
  await expectStatus(a.api.post(`${aPeer}/probe`, {}), 200, 'probe retention receiver');
  await expectStatus(b.api.post(`${bPeer}/probe`, {}), 200, 'probe retention sender');
  await expectStatus(a.api.post(`${aPeer}/catalog/sync`, {}), 200, 'sync retention receiver');
  await expectStatus(b.api.post(`${bPeer}/catalog/sync`, {}), 200, 'sync retention sender');
  await expectStatus(a.api.put('/api/platform/federation/routing', { enabled: true }),
    200, 'enable retention sender routing');
  await expectStatus(b.api.put('/api/platform/federation/routing', { enabled: true }),
    200, 'enable retention receiver routing');

  const terminal = await assertQueuedOutboundDelivery(a, b);
  const active = await assertQueuedOutboundDelivery(a, b);
  sql('postgres-a', `BEGIN; SELECT set_config('fylkren.activity_writer','1',true); UPDATE work_items SET status = 'completed' WHERE id = '${terminal.originWorkItemId}'; COMMIT;`);
  sql('postgres-b', `BEGIN; SELECT set_config('fylkren.activity_writer','1',true); UPDATE work_items SET status = 'completed' WHERE id = '${terminal.counterpartId}'; COMMIT;`);
  const activeDeliveredId = randomUUID();
  const oldFailedId = randomUUID();
  const oldPendingId = randomUUID();
  const activeReceiptId = randomUUID();
  const localActor = sqlValue('postgres-b', `SELECT person_id FROM login_identities
    WHERE normalized_username = 'PAIR-RETENTION-B'`);

  sql('postgres-a', `INSERT INTO federation_outbound_messages
    (message_id, peer_instance_id, source_site_id, destination_site_id, origin_instance_id,
     origin_site_id, origin_resource_id, message_type, schema_version, payload_json, status,
     attempt_count, created_at, next_attempt_at, delivered_at)
    SELECT gen_random_uuid(), '${b.instanceId}', '${a.siteId}', '${b.siteId}', '${a.instanceId}',
      '${a.siteId}', '${terminal.originWorkItemId}', 'assignment.progress', 1, '{}', 'delivered', 1,
      NOW() - INTERVAL '3000 days', NOW() - INTERVAL '3000 days', NOW() - INTERVAL '3000 days'
    FROM generate_series(1, 5000);
    INSERT INTO federation_outbound_messages
    (message_id, peer_instance_id, source_site_id, destination_site_id, origin_instance_id,
     origin_site_id, origin_resource_id, message_type, schema_version, payload_json, status,
     attempt_count, created_at, next_attempt_at, delivered_at)
    SELECT gen_random_uuid(), '${b.instanceId}', '${a.siteId}', '${b.siteId}', '${a.instanceId}',
      '${a.siteId}', '${terminal.originWorkItemId}', 'assignment.progress', 1, '{}', 'delivered', 1,
      NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'
    FROM generate_series(1, 50000);
    INSERT INTO federation_outbound_messages
    (message_id, peer_instance_id, source_site_id, destination_site_id, origin_instance_id,
     origin_site_id, origin_resource_id, message_type, schema_version, payload_json, status,
     attempt_count, created_at, next_attempt_at, delivered_at, last_error_code)
    VALUES
    ('${activeDeliveredId}', '${b.instanceId}', '${a.siteId}', '${b.siteId}', '${a.instanceId}',
     '${a.siteId}', '${active.originWorkItemId}', 'assignment.progress', 1, '{}', 'delivered', 1,
     NOW() - INTERVAL '3000 days', NOW() - INTERVAL '3000 days', NOW() - INTERVAL '3000 days', NULL),
    ('${oldFailedId}', '${b.instanceId}', '${a.siteId}', '${b.siteId}', '${a.instanceId}',
     '${a.siteId}', '${terminal.originWorkItemId}', 'assignment.progress', 1, '{}', 'failed', 5,
     NOW() - INTERVAL '3000 days', NOW() - INTERVAL '3000 days', NULL, 'synthetic_failure'),
    ('${oldPendingId}', '${b.instanceId}', '${a.siteId}', '${b.siteId}', '${a.instanceId}',
     '${a.siteId}', '${terminal.originWorkItemId}', 'assignment.progress', 1, '{}', 'pending', 0,
     NOW() - INTERVAL '3000 days', NOW() + INTERVAL '3000 days', NULL, NULL)`);

  sql('postgres-b', `INSERT INTO federation_inbound_receipts
    (peer_instance_id, message_id, message_type, source_site_id, destination_site_id,
     origin_instance_id, origin_site_id, origin_resource_id, payload_sha256,
     local_work_item_id, received_at)
    SELECT '${a.instanceId}', gen_random_uuid(), 'assignment.progress', '${a.siteId}', '${b.siteId}',
      '${a.instanceId}', '${a.siteId}', '${terminal.originWorkItemId}', repeat('A', 64),
      '${terminal.counterpartId}', NOW() - INTERVAL '3000 days'
    FROM generate_series(1, 5000);
    INSERT INTO federation_inbound_receipts
    (peer_instance_id, message_id, message_type, source_site_id, destination_site_id,
     origin_instance_id, origin_site_id, origin_resource_id, payload_sha256,
     local_work_item_id, received_at)
    SELECT '${a.instanceId}', gen_random_uuid(), 'assignment.progress', '${a.siteId}', '${b.siteId}',
      '${a.instanceId}', '${a.siteId}', '${terminal.originWorkItemId}', repeat('B', 64),
      '${terminal.counterpartId}', NOW() - INTERVAL '30 days'
    FROM generate_series(1, 50000);
    INSERT INTO federation_inbound_receipts
    (peer_instance_id, message_id, message_type, source_site_id, destination_site_id,
     origin_instance_id, origin_site_id, origin_resource_id, payload_sha256,
     local_work_item_id, received_at)
    VALUES ('${a.instanceId}', '${activeReceiptId}', 'assignment.progress', '${a.siteId}', '${b.siteId}',
      '${a.instanceId}', '${a.siteId}', '${active.originWorkItemId}', repeat('C', 64),
      '${active.counterpartId}', NOW() - INTERVAL '3000 days');
    INSERT INTO audit_events
    (id, site_id, actor_person_id, actor_instance_id, actor_site_id, actor_site_name,
     event_type, entity_type, entity_id, occurred_at, actor_was_platform_manager)
    SELECT gen_random_uuid(), NULL, NULL, '${a.instanceId}', NULL, NULL,
      'federation-retention-fixture', 'federation-peer', '${a.instanceId}',
      NOW() - INTERVAL '3000 days', false FROM generate_series(1, 5000);
    INSERT INTO audit_events
    (id, site_id, actor_person_id, actor_instance_id, actor_site_id, actor_site_name,
     event_type, entity_type, entity_id, occurred_at, actor_was_platform_manager)
    SELECT gen_random_uuid(), NULL, NULL, '${a.instanceId}', NULL, NULL,
      'federation-retention-fixture', 'federation-peer', '${a.instanceId}',
      NOW() - INTERVAL '30 days', false FROM generate_series(1, 50000);
    INSERT INTO audit_events
    (id, site_id, actor_person_id, event_type, entity_type, entity_id, occurred_at,
     actor_was_platform_manager)
    VALUES (gen_random_uuid(), NULL, '${localActor}', 'non-federation-retention-control',
      'platform', '${b.instanceId}', NOW() - INTERVAL '3000 days', true)`);

  sql('postgres-a', 'VACUUM (ANALYZE) federation_outbound_messages');
  sql('postgres-b', 'VACUUM (ANALYZE) federation_inbound_receipts');
  sql('postgres-b', 'VACUUM (ANALYZE) audit_events');
  const plans = {
    deliveryCounts: explain('postgres-a', `SELECT status, COUNT(*) FROM federation_outbound_messages
      WHERE peer_instance_id = '${b.instanceId}' GROUP BY status`),
    newestDeliveries: explain('postgres-a', `SELECT message_id FROM federation_outbound_messages
      WHERE peer_instance_id = '${b.instanceId}' ORDER BY created_at DESC LIMIT 100`),
    receiptLookup: explain('postgres-b', `SELECT local_work_item_id FROM federation_inbound_receipts
      WHERE peer_instance_id = '${a.instanceId}' AND message_id = '${activeReceiptId}'`),
    newestAudit: explain('postgres-b', `SELECT id FROM audit_events
      WHERE actor_instance_id IS NOT NULL ORDER BY occurred_at DESC, id LIMIT 50`),
  };
  assert.ok(plans.deliveryCounts.indexes.includes(
    'IX_federation_outbound_messages_peer_instance_id_status'));
  assert.ok(plans.newestDeliveries.indexes.includes(
    'IX_federation_outbound_messages_peer_instance_id_created_at'));
  assert.ok(plans.receiptLookup.indexes.includes('PK_federation_inbound_receipts'));
  assert.ok(plans.newestAudit.indexes.includes('IX_audit_events_occurred_at_id'));

  compose(['restart', 'api-a']);
  compose(['up', '-d', '--no-build', '--wait', 'api-a']);
  compose(['stop', 'api-b-replica']);
  compose(['restart', 'api-b']);
  compose(['up', '-d', '--no-build', '--wait', 'api-b']);
  for (let attempt = 0; attempt < 60; attempt++) {
    const remaining = Number(sqlValue('postgres-a', `SELECT COUNT(*) FROM federation_outbound_messages
      WHERE delivered_at < NOW() - INTERVAL '2555 days' AND status = 'delivered'
        AND origin_resource_id = '${terminal.originWorkItemId}'`)) +
      Number(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_inbound_receipts
      WHERE received_at < NOW() - INTERVAL '2555 days'
        AND local_work_item_id = '${terminal.counterpartId}'`));
    if (remaining === 0) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM federation_outbound_messages
    WHERE delivered_at < NOW() - INTERVAL '2555 days' AND status = 'delivered'
      AND origin_resource_id = '${terminal.originWorkItemId}'`), '0');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_inbound_receipts
    WHERE received_at < NOW() - INTERVAL '2555 days'
      AND local_work_item_id = '${terminal.counterpartId}'`), '0');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM audit_events
    WHERE event_type = 'federation-retention-fixture'
      AND occurred_at < NOW() - INTERVAL '2555 days'`), '5000');
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM federation_outbound_messages
    WHERE message_id IN ('${activeDeliveredId}', '${oldFailedId}', '${oldPendingId}')`), '3');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_inbound_receipts
    WHERE message_id = '${activeReceiptId}'`), '1');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM audit_events
    WHERE event_type = 'non-federation-retention-control'`), '1');
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM federation_outbound_messages
    WHERE delivered_at > NOW() - INTERVAL '2555 days' AND status = 'delivered'`), '50002');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_inbound_receipts
    WHERE received_at > NOW() - INTERVAL '2555 days'`), '50002');

  process.stdout.write(`${JSON.stringify({ federationRetention: 'passed', retentionDays: 2555,
    expiredRowsRemoved: { outbound: 5000, receipts: 5000, audit: 0 },
    recentRowsRetained: { outbound: 50002, receipts: 50002, audit: 50000 },
    activeAndUnresolvedRowsRetained: true, securityAuditRetained: true, nonFederationAuditRetained: true, plans })}\n`);
}

async function runProductionBoundaryPair() {
  const a = await setup('https://localhost:18443', 'production-boundary-a');
  const b = await setup('https://localhost:18444', 'production-boundary-b');
  const premature = await expectStatus(a.api.put('/api/platform/federation/routing', { enabled: true }),
    409, 'reject routing before peer setup');
  assert.equal(premature.error, 'federation_routing_not_ready');
  assert.ok(premature.blockers.includes('proved_peer_required'));
  const aPeer = `/api/platform/federation/peers/${b.instanceId}`;
  const bPeer = `/api/platform/federation/peers/${a.instanceId}`;
  const discoveredB = await expectStatus(a.api.post('/api/platform/federation/peers/discover', {
    baseUrl: 'https://tls:444',
  }), 200, 'discover production-boundary receiver');
  const discoveredA = await expectStatus(b.api.post('/api/platform/federation/peers/discover', {
    baseUrl: 'https://tls:443',
  }), 200, 'discover production-boundary sender');
  await expectStatus(a.api.post('/api/platform/federation/peers', {
    instanceId: b.instanceId, name: 'Production boundary B', baseUrl: discoveredB.baseUrl,
    fingerprint: discoveredB.fingerprint,
  }), 201, 'approve production-boundary receiver');
  await expectStatus(b.api.post('/api/platform/federation/peers', {
    instanceId: a.instanceId, name: 'Production boundary A', baseUrl: discoveredA.baseUrl,
    fingerprint: discoveredA.fingerprint,
  }), 201, 'approve production-boundary sender');
  await expectStatus(a.api.post(`${aPeer}/probe`, {}), 200, 'probe production-boundary receiver');
  await expectStatus(b.api.post(`${bPeer}/probe`, {}), 200, 'probe production-boundary sender');
  await expectStatus(a.api.post(`${aPeer}/catalog/sync`, {}),
    200, 'sync production-boundary receiver');
  await expectStatus(b.api.post(`${bPeer}/catalog/sync`, {}),
    200, 'sync production-boundary sender');

  const disabledRouting = await expectStatus(a.api.request('/api/platform/federation/routing'),
    200, 'read default production routing state');
  assert.equal(disabledRouting.enabled, false);
  assert.equal(disabledRouting.readyToEnable, true);

  const peerWorkRoutes = [
    '/api/federation/v1/work',
    '/api/federation/v1/progress',
    '/api/federation/v1/answer',
    '/api/federation/v1/cancel',
  ];
  for (const path of peerWorkRoutes)
    await expectStatus(b.api.post(path, {}), 404, `production route boundary ${path}`);

  const syntheticRoutes = [
    '/api/platform/federation/test/outbound',
    `/api/platform/federation/test/progress/${randomUUID()}`,
    `/api/platform/federation/test/answer/${randomUUID()}`,
    `/api/platform/federation/test/cancel/${randomUUID()}`,
    `/api/federation/test/sites/${b.siteId}/items/${randomUUID()}/accept-answer`,
  ];
  for (const path of syntheticRoutes)
    await expectStatus(b.api.post(path, {}), 404, `synthetic route boundary ${path}`);

  const leaderA = await makeSiteLeader(a, 'https://localhost:18443');
  await assertNoRemoteRecipient(leaderA, a.siteId, b.siteId);
  assert.equal(sqlValue('postgres-a', 'SELECT COUNT(*) FROM federation_outbound_messages'), '0',
    'Production-boundary administration unexpectedly queued work');
  assert.equal(sqlValue('postgres-b', 'SELECT COUNT(*) FROM federation_inbound_receipts'), '0',
    'Production-boundary administration unexpectedly received work');

  const enabledA = await expectStatus(a.api.put('/api/platform/federation/routing', { enabled: true }),
    200, 'enable production routing A through platform API');
  const enabledB = await expectStatus(b.api.put('/api/platform/federation/routing', { enabled: true }),
    200, 'enable production routing B through platform API');
  assert.equal(enabledA.enabled, true);
  assert.equal(enabledB.enabled, true);
  const delivered = await assertQueuedOutboundDelivery(a, b, leaderA);
  assert.ok(delivered.originWorkItemId);
  const leaderB = await makeSiteLeader(b, 'https://localhost:18444');
  await assertOperationalReturnPath(a, b, delivered, leaderA, leaderB);
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM audit_events
    WHERE event_type = 'federation-routing.enabled'`), '1');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM audit_events
    WHERE event_type = 'federation-routing.enabled'`), '1');
  for (const path of syntheticRoutes)
    await expectStatus(b.api.post(path, {}), 404, `synthetic route still absent ${path}`);
  const disabledA = await expectStatus(a.api.put('/api/platform/federation/routing', { enabled: false }),
    200, 'disable production routing A through platform API');
  assert.equal(disabledA.enabled, false);
  await assertNoRemoteRecipient(leaderA, a.siteId, b.siteId);
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM audit_events
    WHERE event_type = 'federation-routing.disabled'`), '1');

  process.stdout.write(`${JSON.stringify({ federationProductionBoundary: 'passed',
    environment: 'Production', administrativeFoundationAvailable: true,
    routingDisabledByDefault: true, activatedThroughPlatformApi: true,
    productionWorkDelivered: true, ordinaryReportReturned: true, privateLearningExcludedFromFederation: true, deactivationVerified: true,
    peerWorkRoutesGatedWhileDisabled: peerWorkRoutes.length,
    syntheticRoutesAbsent: syntheticRoutes.length,
    remoteRecipientSelectionAbsentBeforeActivation: true,
    noFederationWorkCreatedBeforeActivation: true })}\n`);
}

async function makeSiteLeader(owner, base) {
  const username = `pair-leader-${randomBytes(5).toString('hex')}`;
  const password = `V8!${randomBytes(22).toString('base64url')}#x`;
  const created = await expectStatus(owner.api.post(`/api/sites/${owner.siteId}/access/local-users`, {
    displayName: 'Synthetic Site Leader', email: `${username}@example.invalid`, username,
    organizationUnitId: null,
  }), 201, 'create site leader');
  const account = client(base);
  await expectStatus(account.post('/api/password-reset/complete', {
    resetCode: created.resetCode, newPassword: password,
  }), 204, 'set site leader password');
  await expectStatus(account.post('/api/session', { username, password }), 204, 'sign in site leader');
  await account.csrf();
  await expectStatus(owner.api.post(`/api/sites/${owner.siteId}/site-managers`, {
    personId: created.member.id,
  }), 201, 'assign site manager');
  const leadership = await expectStatus(account.post(`/api/sites/${owner.siteId}/organization-units`, {
    name: 'Leadership', parentId: null, isTemporary: false,
    worksAtParentLevel: false, isSiteLeadership: true,
  }), 201, 'create leadership');
  const access = await expectStatus(account.request(`/api/sites/${owner.siteId}/access/`), 200, 'read roles');
  const leaderRole = access.roles.find(role => role.organizationUnitId === leadership.id && role.isLeader);
  assert.ok(leaderRole, 'Leadership role missing');
  await expectStatus(account.post(`/api/sites/${owner.siteId}/access/role-assignments`, {
    roleId: leaderRole.id, personId: created.member.id,
    validFrom: new Date(Date.now() - 60_000).toISOString(), validTo: null, canLeadParentLevel: false,
  }), 201, 'assign leader role');
  account.credentials = { username, password };
  return account;
}

async function pauseForBrowserInspection(a, b, leaderA, leaderB, reportWork) {
  if (!process.argv.includes('--inspect')) return;
  process.stdout.write(`${JSON.stringify({
    federationBrowserInspection: 'ready',
    composeProject: project,
    sender: {
      baseUrl: 'https://localhost:18443', platformManager: a.credentials,
      siteLeader: leaderA.credentials, siteId: a.siteId,
      reportId: reportWork.originWorkItemId,
    },
    receiver: {
      baseUrl: 'https://localhost:18444', platformManager: b.credentials,
      siteLeader: leaderB.credentials, siteId: b.siteId,
      reportId: reportWork.counterpartId,
    },
    resume: 'Press Enter after browser inspection',
  })}\n`);
  await new Promise(resolve => {
    // Keep non-interactive invocations alive even when stdin has already
    // reached EOF. Interactive runs resume with Enter.
    const keepAlive = setInterval(() => {}, 1000);
    const finish = () => { clearInterval(keepAlive); resolve(); };
    process.stdin.resume();
    process.stdin.once('data', finish);
  });
  process.stdin.pause();
}

async function assertNoRemoteRecipient(account, sourceSiteId, remoteSiteId) {
  const candidates = await expectStatus(account.request(
    `/api/work/sites/${sourceSiteId}/request-recipients?search=Synthetic`), 200, 'recipient search');
  assert.ok(!candidates.some(candidate => candidate.id === remoteSiteId),
    'Federated site appeared as an operational recipient before delivery is supported');
}

async function assertFederatedAuditActor(account, localSiteId, remoteInstanceId, remoteSiteId) {
  const eventId = randomUUID();
  sql('postgres-a', `INSERT INTO audit_events
    (id, site_id, actor_person_id, actor_instance_id, actor_site_id, actor_site_name,
     event_type, entity_type, entity_id, occurred_at, actor_was_platform_manager)
    VALUES ('${eventId}', '${localSiteId}', NULL, '${remoteInstanceId}', '${remoteSiteId}',
      'Synthetic remote site', 'federation.actor-test', 'work-item', '${localSiteId}', NOW(), false)`);
  const revision = await expectStatus(account.request(`/api/site-audit/sites/${localSiteId}`),
    200, 'read federated audit actor');
  const event = revision.events.find(value => value.id === eventId);
  assert.equal(event?.actor, 'Federated site: Synthetic remote site');
  sql('postgres-a', `DO $$ BEGIN
    INSERT INTO audit_events
      (id, site_id, actor_person_id, actor_instance_id, actor_site_id, actor_site_name,
       event_type, entity_type, entity_id, occurred_at, actor_was_platform_manager)
    VALUES ('${randomUUID()}', '${localSiteId}', '${randomUUID()}', '${remoteInstanceId}',
      '${remoteSiteId}', 'Invalid dual actor', 'federation.actor-test', 'work-item',
      '${localSiteId}', NOW(), false);
    RAISE EXCEPTION 'mixed local and remote audit actor was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END; $$`);
  sql('postgres-a', `DELETE FROM audit_events WHERE id = '${eventId}'`);
}

async function assertProbeReplayRejected(receiver) {
  const senderInstanceId = randomUUID();
  const { publicKey: senderPublicKey, privateKey: senderPrivateKey } =
    generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const encodedSenderKey = senderPublicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  sql('postgres-b', `INSERT INTO federation_peers
    (instance_id, name, base_url, created_at, is_active, pinned_public_key_spki)
    VALUES ('${senderInstanceId}', 'Synthetic replay peer',
      'https://replay.example.invalid', NOW(), true, '${encodedSenderKey}')`);
  function signedProbe() {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = randomUUID();
    const canonical = [
      'fylkren-federation-probe-request-v1',
      senderInstanceId.replaceAll('-', ''), receiver.instanceId.replaceAll('-', ''),
      String(timestamp), nonce.replaceAll('-', ''),
    ].join('\n');
    const signature = sign('sha256', Buffer.from(canonical, 'ascii'), {
      key: senderPrivateKey, dsaEncoding: 'ieee-p1363',
    }).toString('base64');
    return { senderInstanceId, recipientInstanceId: receiver.instanceId, timestamp, nonce, signature };
  }
  const request = signedProbe();
  await expectStatus(receiver.api.post('/api/federation/v1/probe', request), 200, 'first signed probe');
  const duplicate = await expectStatus(receiver.api.post('/api/federation/v1/probe', request),
    409, 'replayed signed probe');
  assert.equal(duplicate.error, 'replayed_probe');
  const concurrent = signedProbe();
  const replica = client('https://localhost:18445');
  const results = await Promise.all([
    receiver.api.post('/api/federation/v1/probe', concurrent),
    replica.post('/api/federation/v1/probe', concurrent),
  ]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409],
    `Concurrent replica replay result: ${JSON.stringify(results)}`);
  assert.equal(results.find(result => result.status === 409).body.error, 'replayed_probe');
  sql('postgres-b', `UPDATE federation_peers SET last_proof_at = NOW()
    WHERE instance_id = '${senderInstanceId}'`);
  const capabilityTimestamp = Math.floor(Date.now() / 1000);
  const capabilityNonce = randomUUID();
  const capabilityTypes = ['assignment.answered', 'assignment.cancelled',
    'assignment.created', 'assignment.progress'];
  const capabilityCanonical = [
    'fylkren-federation-capability-request-v1',
    senderInstanceId.replaceAll('-', ''), receiver.instanceId.replaceAll('-', ''),
    '2', '2', '1', capabilityTypes.join(','), String(capabilityTimestamp),
    capabilityNonce.replaceAll('-', ''),
  ].join('\n');
  const capabilitySignature = sign('sha256', Buffer.from(capabilityCanonical, 'ascii'), {
    key: senderPrivateKey, dsaEncoding: 'ieee-p1363',
  }).toString('base64');
  const incompatible = await expectStatus(receiver.api.post('/api/federation/v1/capabilities', {
    senderInstanceId, recipientInstanceId: receiver.instanceId,
    minimumProtocolVersion: 2, maximumProtocolVersion: 2,
    workSchemaVersions: [1], workMessageTypes: capabilityTypes,
    timestamp: capabilityTimestamp, nonce: capabilityNonce, signature: capabilitySignature,
  }), 409, 'reject incompatible signed capability offer');
  assert.equal(incompatible.error, 'federation_protocol_incompatible');
  return { senderInstanceId, senderPrivateKey };
}

async function assertSignedWorkReceive(receiver, syntheticPeer) {
  const sourceSiteId = randomUUID();
  const peerPath = `/api/platform/federation/peers/${syntheticPeer.senderInstanceId}`;
  sql('postgres-b', `UPDATE federation_peers SET last_proof_at = NOW()
    WHERE instance_id = '${syntheticPeer.senderInstanceId}'`);
  sql('postgres-b', `INSERT INTO federation_remote_sites
    (instance_id, site_id, name, catalog_revision, updated_at, is_active)
    VALUES ('${syntheticPeer.senderInstanceId}', '${sourceSiteId}', 'Synthetic federated sender', 1, NOW(), true)`);
  await expectStatus(receiver.api.put(`${peerPath}/sites/${receiver.siteId}`, { isActive: true }),
    200, 'publish receiving site to synthetic peer');
  const grantPath = `${peerPath}/grants/inbound/${receiver.siteId}/${sourceSiteId}`;
  await expectStatus(receiver.api.put(grantPath, { isActive: true }), 200, 'grant synthetic inbound work');
  const payloadJson = JSON.stringify({ kind: 'request', title: 'Synthetic federated assignment',
    instruction: 'Synthetic test instruction', priority: 'normal', dueAt: null,
    requestBasis: null, sourceTypeName: null, senderName: null });
  const messageId = randomUUID();
  const originResourceId = randomUUID();
  function work(overrides = {}) {
    const item = {
      schemaVersion: 1, messageId, messageType: 'assignment.created',
      senderInstanceId: syntheticPeer.senderInstanceId, recipientInstanceId: receiver.instanceId,
      sourceSiteId, destinationSiteId: receiver.siteId,
      originInstanceId: syntheticPeer.senderInstanceId, originSiteId: sourceSiteId,
      originResourceId, counterpartWorkItemId: null, correlationId: null, causationId: null,
      timestamp: Math.floor(Date.now() / 1000), nonce: randomUUID(), payloadJson, signature: null,
      ...overrides,
    };
    const n = value => value ? value.replaceAll('-', '') : '';
    const hash = createHash('sha256').update(item.payloadJson).digest('hex').toUpperCase();
    const canonical = [
      'fylkren-federation-work-envelope-v1', String(item.schemaVersion),
      n(item.messageId), item.messageType, n(item.senderInstanceId), n(item.recipientInstanceId),
      n(item.sourceSiteId), n(item.destinationSiteId), n(item.originInstanceId),
      n(item.originSiteId), n(item.originResourceId), n(item.counterpartWorkItemId),
      n(item.correlationId), n(item.causationId), String(item.timestamp), n(item.nonce), hash,
    ].join('\n');
    item.signature = sign('sha256', Buffer.from(canonical, 'ascii'), {
      key: syntheticPeer.senderPrivateKey, dsaEncoding: 'ieee-p1363',
    }).toString('base64');
    return item;
  }
  const firstRequest = work();
  const accepted = await expectStatus(receiver.api.post('/api/federation/v1/work', firstRequest),
    200, 'receive signed assignment');
  assert.equal(accepted.duplicate, false);
  assert.equal(accepted.messageId, messageId);
  assert.equal(accepted.destinationSiteId, receiver.siteId);
  const localWorkItemId = accepted.localWorkItemId;
  assert.ok(localWorkItemId);
  const responseBytes = [
    'fylkren-federation-work-receipt-v1', '1', receiver.instanceId.replaceAll('-', ''),
    syntheticPeer.senderInstanceId.replaceAll('-', ''), messageId.replaceAll('-', ''),
    accepted.nonce.replaceAll('-', ''), sourceSiteId.replaceAll('-', ''),
    receiver.siteId.replaceAll('-', ''), localWorkItemId.replaceAll('-', ''),
    accepted.payloadSha256, String(accepted.grantRevision), '0', String(accepted.timestamp),
  ].join('\n');
  assert.ok(verify('sha256', Buffer.from(responseBytes, 'ascii'), {
    key: createPublicKey({ key: Buffer.from(receiver.publicKeySpki, 'base64'), format: 'der', type: 'spki' }),
    dsaEncoding: 'ieee-p1363',
  }, Buffer.from(accepted.signature, 'base64')), 'Signed work receipt did not verify');
  sql('postgres-b', `DO $$ BEGIN
    IF (SELECT COUNT(*) FROM work_items WHERE id = '${localWorkItemId}' AND site_id = '${receiver.siteId}'
        AND created_by_person_id IS NULL AND sender_site_name = 'Synthetic federated sender') <> 1
    OR (SELECT COUNT(*) FROM federation_inbound_receipts WHERE peer_instance_id = '${syntheticPeer.senderInstanceId}'
        AND message_id = '${messageId}' AND local_work_item_id = '${localWorkItemId}') <> 1
    OR (SELECT COUNT(*) FROM federation_work_links WHERE local_work_item_id = '${localWorkItemId}'
        AND direction = 'incoming') <> 1
    OR (SELECT COUNT(*) FROM audit_events WHERE entity_id = '${localWorkItemId}'
        AND actor_instance_id = '${syntheticPeer.senderInstanceId}' AND actor_person_id IS NULL) <> 1
    THEN RAISE EXCEPTION 'received work transaction incomplete'; END IF;
  END; $$`);
  const duplicate = await expectStatus(receiver.api.post('/api/federation/v1/work', work()),
    200, 'idempotent assignment retry');
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.localWorkItemId, localWorkItemId);
  await expectStatus(receiver.api.post('/api/federation/v1/work', firstRequest),
    409, 'replayed nonce rejected');
  await expectStatus(receiver.api.post('/api/federation/v1/work', work({
    payloadJson: payloadJson.replace('Synthetic test instruction', 'Changed instruction'),
  })), 409, 'same message ID with changed content rejected');
  await expectStatus(receiver.api.post('/api/federation/v1/work', work({
    correlationId: randomUUID(),
  })), 409, 'same message ID with changed correlation rejected');
  const tampered = work({ messageId: randomUUID(), originResourceId: randomUUID() });
  tampered.payloadJson = tampered.payloadJson.replace('Synthetic test instruction', 'Tampered instruction');
  await expectStatus(receiver.api.post('/api/federation/v1/work', tampered),
    401, 'tampered signed work rejected');
  await expectStatus(receiver.api.post('/api/federation/v1/work', work({
    messageId: randomUUID(), originResourceId: randomUUID(), recipientInstanceId: randomUUID(),
  })), 400, 'wrong receiver identity rejected');
  const wrongSourceSite = randomUUID();
  await expectStatus(receiver.api.post('/api/federation/v1/work', work({
    messageId: randomUUID(), originResourceId: randomUUID(), sourceSiteId: wrongSourceSite,
    originSiteId: wrongSourceSite,
  })), 403, 'ungranted source site rejected');
  await expectStatus(receiver.api.post('/api/federation/v1/work', work({
    messageId: randomUUID(), originResourceId: randomUUID(), destinationSiteId: randomUUID(),
  })), 403, 'ungranted destination site rejected');
  const concurrentOriginId = randomUUID();
  const concurrentMessageId = randomUUID();
  const concurrent = await Promise.all([
    receiver.api.post('/api/federation/v1/work', work({
      messageId: concurrentMessageId, originResourceId: concurrentOriginId,
    })),
    client('https://localhost:18445').post('/api/federation/v1/work', work({
      messageId: concurrentMessageId, originResourceId: concurrentOriginId,
    })),
  ]);
  assert.equal(concurrent.filter(result => result.status === 200).length >= 1, true,
    `Concurrent work was not accepted: ${JSON.stringify(concurrent)}`);
  assert.ok(concurrent.every(result => result.status === 200 || result.status === 409),
    `Concurrent work returned an unexpected error: ${JSON.stringify(concurrent)}`);
  sql('postgres-b', `DO $$ BEGIN
    IF (SELECT COUNT(*) FROM federation_work_links WHERE origin_resource_id = '${concurrentOriginId}'
        AND peer_instance_id = '${syntheticPeer.senderInstanceId}') <> 1
    THEN RAISE EXCEPTION 'concurrent work created duplicate local items'; END IF;
  END; $$`);
  await expectStatus(receiver.api.put(grantPath, { isActive: false }), 200, 'revoke synthetic grant');
  await expectStatus(receiver.api.post('/api/federation/v1/work', work()),
    403, 'revoked grant rejects even an idempotent retry');
}

async function assertQueuedOutboundDelivery(sender, receiver, operationalLeader = null) {
  const before = sqlValue('postgres-a', 'SELECT COUNT(*) FROM federation_outbound_messages');
  const operationalTitle = '(SECRET) Operational queued federated work %253Cscript%253E';
  const operationalInstruction = String.raw`(SECRET) Deliver literal &lt;script&gt; %253Cscript%253E \u003cscript\u003e {{7*7}} through the ordinary request creation boundary`;
  let queued;
  if (operationalLeader) {
    const candidates = await expectStatus(operationalLeader.request(
      `/api/work/sites/${sender.siteId}/request-recipients?search=Synthetic`),
    200, 'search routable federated recipient');
    assert.ok(candidates.some(candidate => candidate.id === receiver.siteId &&
      candidate.instanceId === receiver.instanceId),
    'Authorized remote site was not returned by the isolated operational recipient search');
    const requestTypeId = sqlValue('postgres-a', `SELECT id FROM work_item_types
      WHERE site_id = '${sender.siteId}' AND is_system_managed = TRUE`);
    const created = await expectStatus(operationalLeader.post(
      `/api/work/sites/${sender.siteId}/items`, {
        title: operationalTitle,
        description: operationalInstruction,
        recommendation: null, referenceUrl: null, dueAt: null,
        workItemTypeId: requestTypeId, sourceTypeId: null, senderId: null,
        targetSiteId: receiver.siteId, targetInstanceId: receiver.instanceId,
        targetUnitId: null, assignedUnitId: null,
      }), 201, 'queue operational outbound assignment');
    queued = {
      workItemId: created.id,
      messageId: sqlValue('postgres-a', `SELECT message_id FROM federation_outbound_messages
        WHERE origin_resource_id = '${created.id}'`),
    };
  } else {
    await expectStatus(sender.api.post('/api/platform/federation/test/outbound', {
      sourceSiteId: sender.siteId, destinationSiteId: randomUUID(),
      peerInstanceId: receiver.instanceId,
      title: 'Unauthorized synthetic work', instruction: 'Must not be queued',
    }), 409, 'unknown destination cannot queue work');
    assert.equal(sqlValue('postgres-a', 'SELECT COUNT(*) FROM federation_outbound_messages'), before);
    queued = await expectStatus(sender.api.post('/api/platform/federation/test/outbound', {
      sourceSiteId: sender.siteId, destinationSiteId: receiver.siteId,
      peerInstanceId: receiver.instanceId,
      title: 'Synthetic queued federated work', instruction: 'Deliver after the local commit',
    }), 202, 'queue synthetic outbound assignment');
  }
  sql('postgres-a', `DO $$ BEGIN
    IF (SELECT COUNT(*) FROM work_items WHERE id = '${queued.workItemId}') <> 1
    OR (SELECT COUNT(*) FROM federation_outbound_messages WHERE message_id = '${queued.messageId}'
      AND origin_resource_id = '${queued.workItemId}') <> 1
    OR (SELECT COUNT(*) FROM federation_work_links WHERE local_work_item_id = '${queued.workItemId}'
      AND direction = 'outgoing') <> 1
    THEN RAISE EXCEPTION 'local work and outbound record were not committed together'; END IF;
  END; $$`);
  let status;
  for (let attempt = 0; attempt < 30; attempt++) {
    status = sqlValue('postgres-a', `SELECT status FROM federation_outbound_messages
      WHERE message_id = '${queued.messageId}'`);
    if (status === 'delivered' || status === 'failed') break;
    if (status === 'retrying') sql('postgres-a', `UPDATE federation_outbound_messages
      SET next_attempt_at = NOW() - INTERVAL '1 second'
      WHERE message_id = '${queued.messageId}' AND status = 'retrying'`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const deliveryState = sqlValue('postgres-a', `SELECT status || ':' ||
    COALESCE(last_error_code, '') FROM federation_outbound_messages
    WHERE message_id = '${queued.messageId}'`);
  assert.equal(status, 'delivered',
    `Outbound worker did not obtain a signed receipt: ${deliveryState}`);
  const counterpartId = sqlValue('postgres-a', `SELECT remote_work_item_id
    FROM federation_work_links WHERE local_work_item_id = '${queued.workItemId}'
      AND direction = 'outgoing'`);
  assert.ok(counterpartId, 'Sender did not persist the remote counterpart');
  if (operationalLeader) {
    const payload = JSON.parse(sqlValue('postgres-a', `SELECT payload_json
      FROM federation_outbound_messages WHERE message_id = '${queued.messageId}'`));
    assert.equal(payload.title, operationalTitle,
      'Outbound assignment payload lost the task classification marking');
    assert.equal(payload.instruction, operationalInstruction,
      'Outbound assignment payload lost the instruction classification marking');
    assert.equal(sqlValue('postgres-b', `SELECT title FROM work_items
      WHERE id = '${counterpartId}'`), operationalTitle,
    'Receiver task lost the title classification marking');
    assert.equal(sqlValue('postgres-b', `SELECT description FROM work_items
      WHERE id = '${counterpartId}'`), operationalInstruction,
    'Receiver task lost the instruction classification marking');
  }
  sql('postgres-b', `DO $$ BEGIN
    IF (SELECT COUNT(*) FROM work_items WHERE id = '${counterpartId}'
      AND site_id = '${receiver.siteId}') <> 1
    OR (SELECT COUNT(*) FROM federation_inbound_receipts WHERE message_id = '${queued.messageId}'
      AND local_work_item_id = '${counterpartId}') <> 1
    THEN RAISE EXCEPTION 'receiver did not persist exactly one counterpart'; END IF;
  END; $$`);
  // Force a transport retry after the sender's receipt has been stored. A
  // fresh signed nonce must receive the original counterpart, not a second task.
  sql('postgres-a', `UPDATE federation_outbound_messages SET status = 'retrying',
    next_attempt_at = NOW() - INTERVAL '1 second'
    WHERE message_id = '${queued.messageId}'`);
  let attempts;
  for (let attempt = 0; attempt < 30; attempt++) {
    attempts = Number(sqlValue('postgres-a', `SELECT attempt_count
      FROM federation_outbound_messages WHERE message_id = '${queued.messageId}'`));
    status = sqlValue('postgres-a', `SELECT status FROM federation_outbound_messages
      WHERE message_id = '${queued.messageId}'`);
    if (attempts >= 2 && status === 'delivered') break;
    if (status === 'retrying') sql('postgres-a', `UPDATE federation_outbound_messages
      SET next_attempt_at = NOW() - INTERVAL '1 second'
      WHERE message_id = '${queued.messageId}' AND status = 'retrying'`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(status, 'delivered', 'Retry did not finish successfully');
  assert.equal(sqlValue('postgres-a', `SELECT remote_work_item_id FROM federation_work_links
    WHERE local_work_item_id = '${queued.workItemId}' AND direction = 'outgoing'`), counterpartId);
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_inbound_receipts
    WHERE message_id = '${queued.messageId}'`), '1');
  if (operationalLeader) {
    const overview = await expectStatus(operationalLeader.request(
      `/api/work/sites/${sender.siteId}/items/overview`), 200,
    'read operational federated request status');
    const item = overview.find(value => value.id === queued.workItemId);
    assert.equal(item?.isOutgoingRequest, true);
    assert.equal(item?.requestRecipientSiteName, receiver.siteName);
    assert.equal(item?.requestRecipientIsExternal, true);
    assert.equal(item?.requestProgressStatus, 'received');
  }
  return { originWorkItemId: queued.workItemId, counterpartId,
    originalMessageId: queued.messageId };
}

async function assertVersionedDelivery(sender, receiver, senderDatabase,
  receiverDatabase, label) {
  const queued = await expectStatus(sender.api.post(
    '/api/platform/federation/test/outbound', {
      sourceSiteId: sender.siteId, destinationSiteId: receiver.siteId,
      peerInstanceId: receiver.instanceId,
      title: `Mixed-version ${label}`, instruction: `Deliver ${label}`,
    }), 202, `queue ${label}`);
  let status;
  for (let attempt = 0; attempt < 40; attempt++) {
    status = sqlValue(senderDatabase, `SELECT status FROM federation_outbound_messages
      WHERE message_id = '${queued.messageId}'`);
    if (status === 'delivered' || status === 'failed') break;
    if (status === 'retrying') sql(senderDatabase, `UPDATE federation_outbound_messages
      SET next_attempt_at = NOW() - INTERVAL '1 second'
      WHERE message_id = '${queued.messageId}' AND status = 'retrying'`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const state = sqlValue(senderDatabase, `SELECT status || ':' ||
    COALESCE(last_error_code, '') FROM federation_outbound_messages
    WHERE message_id = '${queued.messageId}'`);
  assert.equal(status, 'delivered', `${label} capability/delivery failed: ${state}`);
  const counterpartId = sqlValue(senderDatabase, `SELECT remote_work_item_id
    FROM federation_work_links WHERE local_work_item_id = '${queued.workItemId}'`);
  assert.ok(counterpartId, `${label} did not persist a remote counterpart`);
  assert.equal(sqlValue(receiverDatabase, `SELECT COUNT(*) FROM federation_work_links
    WHERE local_work_item_id = '${counterpartId}' AND direction = 'incoming'
      AND peer_instance_id = '${sender.instanceId}'`), '1',
  `${label} did not persist exactly one receiver link`);
}

async function assertMixedVersionUpgradeDowngrade(a, b, aPeer, bPeer) {
  const aInbound = `${aPeer}/grants/inbound/${a.siteId}/${b.siteId}`;
  const bOutbound = `${bPeer}/grants/outbound/${b.siteId}/${a.siteId}`;
  await expectStatus(a.api.put(aInbound, { isActive: true }), 200,
    'activate current A inbound grant for mixed-version delivery');
  await expectStatus(b.api.put(bOutbound, { isActive: true }), 200,
    'activate current B outbound grant for mixed-version delivery');

  switchReceiverImage(oldImage);
  await assertVersionedDelivery(a, b, 'postgres-a', 'postgres-b',
    `current-to-${oldCommit}`);
  await assertVersionedDelivery(b, a, 'postgres-b', 'postgres-a',
    `${oldCommit}-to-current`);

  switchReceiverImage(currentImage);
  await assertVersionedDelivery(b, a, 'postgres-b', 'postgres-a',
    'upgraded-current-to-current');
  await assertVersionedDelivery(a, b, 'postgres-a', 'postgres-b',
    'current-to-upgraded-current');
}

async function assertEntitlementLossStopsOperationalRouting(sender, receiver, operationalLeader) {
  await expectStatus(sender.api.request('/api/platform/license', 'DELETE'), 204,
    'remove federation entitlement');
  const candidates = await expectStatus(operationalLeader.request(
    `/api/work/sites/${sender.siteId}/request-recipients?search=Synthetic`),
  200, 'search recipients after entitlement loss');
  assert.ok(!candidates.some(candidate => candidate.id === receiver.siteId &&
    candidate.instanceId === receiver.instanceId),
  'Remote recipient remained selectable after entitlement loss');
  const requestTypeId = sqlValue('postgres-a', `SELECT id FROM work_item_types
    WHERE site_id = '${sender.siteId}' AND is_system_managed = TRUE`);
  const before = sqlValue('postgres-a', 'SELECT COUNT(*) FROM federation_outbound_messages');
  await expectStatus(operationalLeader.post(`/api/work/sites/${sender.siteId}/items`, {
    title: 'Rejected request without federation entitlement',
    description: 'Must not create work or an outbound message',
    recommendation: null, referenceUrl: null, dueAt: null,
    workItemTypeId: requestTypeId, sourceTypeId: null, senderId: null,
    targetSiteId: receiver.siteId, targetInstanceId: receiver.instanceId,
    targetUnitId: null, assignedUnitId: null,
  }), 403, 'federated request after entitlement loss');
  assert.equal(sqlValue('postgres-a', 'SELECT COUNT(*) FROM federation_outbound_messages'), before,
    'Entitlement rejection left an outbound message');
  const restored = await expectStatus(sender.api.post('/api/platform/license',
    license(sender.instanceId)), 200, 'restore federation entitlement');
  assert.equal(restored.status.edition, 'enterprise');
}

async function awaitOutboundMessage(database, messageId, label) {
  let status;
  for (let attempt = 0; attempt < 30; attempt++) {
    status = sqlValue(database, `SELECT status FROM federation_outbound_messages
      WHERE message_id = '${messageId}'`);
    if (status === 'delivered' || status === 'failed') break;
    if (status === 'retrying') sql(database, `UPDATE federation_outbound_messages
      SET next_attempt_at = NOW() - INTERVAL '1 second'
      WHERE message_id = '${messageId}' AND status = 'retrying'`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const state = sqlValue(database, `SELECT status || ':' || COALESCE(last_error_code, '')
    FROM federation_outbound_messages WHERE message_id = '${messageId}'`);
  assert.equal(status, 'delivered', `${label}: ${state}`);
}

async function assertOperationalDeliveryControls(sender, receiver, link) {
  const path = `/api/platform/federation/peers/${receiver.instanceId}/deliveries`;
  const before = await expectStatus(sender.api.request(path), 200,
    'read federated delivery queue');
  const original = before.items.find(item => item.messageId === link.originalMessageId);
  assert.equal(original?.status, 'delivered');
  assert.equal(Object.hasOwn(original, 'payloadJson'), false,
    'Operator delivery view exposed message payload');
  assert.equal(Object.hasOwn(original, 'originResourceId'), false,
    'Operator delivery view exposed work-item identity');
  assert.equal(Object.hasOwn(original, 'sourceSiteId'), false,
    'Operator delivery view exposed source-site identity');

  sql('postgres-a', `UPDATE federation_outbound_messages SET status = 'failed',
    attempt_count = 6, delivered_at = NULL, last_error_code = 'synthetic_permanent_failure'
    WHERE message_id = '${link.originalMessageId}'`);
  const failed = await expectStatus(sender.api.request(path), 200,
    'read permanently failed federation delivery');
  assert.equal(failed.failed >= 1, true);
  assert.equal(failed.items.find(item => item.messageId === link.originalMessageId)?.lastErrorCode,
    'synthetic_permanent_failure');
  const concurrentRetries = await Promise.all([
    sender.api.post(`${path}/${link.originalMessageId}/retry`, {}),
    sender.api.post(`${path}/${link.originalMessageId}/retry`, {}),
  ]);
  assert.deepEqual(concurrentRetries.map(result => result.status).sort(), [200, 409],
    `Concurrent operator retry was not atomic: ${JSON.stringify(concurrentRetries)}`);
  const retried = concurrentRetries.find(result => result.status === 200).body;
  assert.equal(retried.status, 'pending');
  assert.equal(retried.attemptCount, 0);
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM audit_events
    WHERE event_type = 'federation-delivery.retried'
      AND entity_id = '${link.originalMessageId}'`), '1');
  await awaitOutboundMessage('postgres-a', link.originalMessageId,
    'deliver operator-retried federation message');
  await expectStatus(sender.api.post(`${path}/${link.originalMessageId}/retry`, {}), 409,
    'delivered federation message cannot be manually retried');
}

async function createOperationalSource(sender, leader, title) {
  const created = await expectStatus(leader.post(`/api/work/sites/${sender.siteId}/items`, {
    title, description: `${title} basis`, recommendation: null, referenceUrl: null,
    dueAt: null, workItemTypeId: null, sourceTypeId: null, senderId: null,
    targetSiteId: null, targetInstanceId: null, targetUnitId: null, assignedUnitId: null,
  }), 201, `create ${title}`);
  await expectStatus(leader.put(`/api/work/sites/${sender.siteId}/items/${created.id}/status`, {
    status: 'under_review', assignedUnitId: null, decisionNote: null, priority: 'normal',
  }), 204, `assess ${title}`);
  return created.id;
}

async function assertOperationalSideRequest(sender, receiver, leader) {
  const sourceId = await createOperationalSource(sender, leader,
    'Operational federated side request source');
  const created = await expectStatus(leader.post(
    `/api/work/sites/${sender.siteId}/items/${sourceId}/request`, {
      title: 'Operational federated side request',
      description: 'Deliver a side request through the ordinary command',
      targetSiteId: receiver.siteId, targetInstanceId: receiver.instanceId,
      targetUnitId: null,
    }), 201, 'create operational federated side request');
  const messageId = sqlValue('postgres-a', `SELECT message_id
    FROM federation_outbound_messages WHERE origin_resource_id = '${created.id}'`);
  await awaitOutboundMessage('postgres-a', messageId, 'deliver operational side request');
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM federation_work_links
    WHERE local_work_item_id = '${created.id}' AND direction = 'outgoing'
      AND remote_work_item_id IS NOT NULL`), '1');
  const overview = await expectStatus(leader.request(
    `/api/work/sites/${sender.siteId}/items/overview`), 200, 'read side-request projection');
  const tracking = overview.find(value => value.id === created.id);
  assert.equal(tracking?.parentWorkItemId, sourceId);
  assert.equal(tracking?.requestRecipientIsExternal, true);
  assert.equal(tracking?.requestProgressStatus, 'received');
}

async function assertOperationalPlannedRequest(sender, receiver, leader) {
  const sourceId = await createOperationalSource(sender, leader,
    'Operational federated planned request source');
  await expectStatus(leader.put(`/api/work/sites/${sender.siteId}/items/${sourceId}/status`, {
    status: 'planning', assignedUnitId: null, decisionNote: null, priority: null,
  }), 204, 'start operational federated planning');
  const queue = await expectStatus(leader.request(
    `/api/workflows/planning/sites/${sender.siteId}`), 200, 'read planning queue');
  const run = queue.items.find(value => value.item.id === sourceId);
  assert.ok(run, 'Federated planning run missing');
  const step = run.steps.find(value => value.allowsTaskAllocation);
  assert.ok(step, 'Federated planning allocation step missing');
  await expectStatus(leader.post(`/api/workflows/planning/${run.id}/claim`, {}),
    204, 'claim federated planning run');
  const planned = await expectStatus(leader.post(
    `/api/workflows/planning/${run.id}/requests`, {
      stepId: step.id, targetSiteId: receiver.siteId,
      targetInstanceId: receiver.instanceId,
      instruction: 'Deliver only when the approved plan is released.',
    }), 201, 'store qualified federated plan recipient');
  const draftQueue = await expectStatus(leader.request(
    `/api/workflows/planning/sites/${sender.siteId}`), 200, 'read qualified plan recipient');
  const draft = draftQueue.items.find(value => value.id === run.id)?.requests
    .find(value => value.id === planned.id);
  assert.equal(draft?.targetSiteId, receiver.siteId);
  assert.equal(draft?.targetInstanceId, receiver.instanceId);
  assert.equal(draft?.targetSiteName, 'Synthetic Root b');
  await expectStatus(leader.post(`/api/workflows/planning/${run.id}/submit`, {
    priority: 'normal', dueAt: null, allocations: [],
  }), 204, 'submit federated plan');
  await expectStatus(leader.post(`/api/workflows/planning/${run.id}/decision`, {
    action: 'approve', note: null,
  }), 204, 'approve federated plan');
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM federation_outbound_messages m
    JOIN work_items w ON w.id = m.origin_resource_id WHERE w.parent_work_item_id = '${sourceId}'`),
  '0', 'Plan approval dispatched a federated request before release');
  await expectStatus(leader.post(`/api/workflows/planning/${run.id}/decision`, {
    action: 'release', note: null,
  }), 204, 'release federated plan');
  const messageId = sqlValue('postgres-a', `SELECT m.message_id
    FROM federation_outbound_messages m JOIN work_items w ON w.id = m.origin_resource_id
    WHERE w.parent_work_item_id = '${sourceId}'`);
  await awaitOutboundMessage('postgres-a', messageId, 'deliver released plan request');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_inbound_receipts
    WHERE message_id = '${messageId}'`), '1');
}

async function assertAutomaticKeyRotation(sender, receiver) {
  const oldPublicKey = sender.publicKeySpki;
  await expectStatus(receiver.api.post('/api/federation/v1/key-rotation/stage', {
    senderInstanceId: sender.instanceId, recipientInstanceId: receiver.instanceId,
    rotationId: randomUUID(), timestamp: 1, nonce: randomUUID(),
    currentPublicKeySpki: 'invalid', newPublicKeySpki: 'invalid',
    currentSignature: 'invalid', newSignature: 'invalid',
  }), 409, 'report federation clock skew explicitly');
  const rotation = await expectStatus(sender.api.post(
    '/api/platform/federation/identity/rotation', {}), 202,
  'start automatic federation key rotation');
  assert.equal(rotation.instanceId, sender.instanceId);
  assert.equal(rotation.automatic, true);
  assert.equal(rotation.status, 'distributing');
  await expectStatus(sender.api.post('/api/platform/federation/identity/rotation', {}),
    409, 'reject overlapping local key rotation');
  let identity;
  for (let attempt = 0; attempt < 45; attempt++) {
    identity = await expectStatus(sender.api.request(
      '/api/platform/federation/identity'), 200, 'read automatic key rotation state');
    if (!identity.keyRotationPending && identity.publicKeySpki !== oldPublicKey) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(identity.keyRotationPending, false, 'Automatic key rotation did not finish');
  assert.notEqual(identity.publicKeySpki, oldPublicKey);
  const completed = (await expectStatus(receiver.api.request('/api/platform/federation/peers'),
    200, 'read completed peer rotation')).find(peer => peer.instanceId === sender.instanceId);
  assert.equal(completed.keyRotationPending, false);
  assert.ok(completed.lastProofAt);
  assert.equal(completed.pinnedPublicKeySpki, identity.publicKeySpki);
  assert.equal(sqlValue('postgres-b', `SELECT is_active FROM federation_site_grants
    WHERE peer_instance_id = '${sender.instanceId}' AND direction = 'inbound'`), 't',
  'Automatic key rotation changed the receiving grant');
  assert.equal(sqlValue('postgres-a', `SELECT is_active FROM federation_site_grants
    WHERE peer_instance_id = '${receiver.instanceId}' AND direction = 'outbound'`), 't',
  'Automatic key rotation changed the sending grant');
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM audit_events
    WHERE event_type IN ('federation-identity.key-rotation-created',
      'federation-identity.key-rotation-activated',
      'federation-identity.key-rotation-completed')`), '3');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM audit_events
    WHERE event_type IN ('federation-peer.key-rotation-staged',
      'federation-peer.key-rotation-completed')`), '2');
}

async function assertLostKeyRecovery(observer, recovered, observerPeerPath, outboundGrant) {
  await expectStatus(recovered.api.post('/api/platform/federation/identity/recover', {}),
    409, 'reject recovery while federation key remains usable');
  const oldIdentity = await expectStatus(recovered.api.request(
    '/api/platform/federation/identity'), 200, 'read identity before simulated key loss');
  assert.equal(oldIdentity.keyUsable, true);

  sql('postgres-b', `UPDATE federation_signing_identity
    SET protected_private_key = 'synthetic-unrecoverable-key', pending_rotation_id = NULL,
        pending_public_key_spki = NULL, pending_protected_private_key = NULL,
        pending_created_at = NULL, active_rotation_id = NULL, rotation_activated_at = NULL
    WHERE key = 1`);
  const unusable = await expectStatus(recovered.api.request(
    '/api/platform/federation/identity'), 200, 'detect lost federation key');
  assert.equal(unusable.keyUsable, false);
  await expectStatus(recovered.api.post('/api/platform/federation/identity/rotation', {}),
    409, 'reject planned rotation after key loss');

  const replacement = await expectStatus(recovered.api.post(
    '/api/platform/federation/identity/recover', {}), 200, 'generate recovery key');
  assert.notEqual(replacement.publicKeySpki, oldIdentity.publicKeySpki);
  assert.equal(replacement.peersRequireRecoveryApproval, true);
  const usable = await expectStatus(recovered.api.request(
    '/api/platform/federation/identity'), 200, 'read recovered federation identity');
  assert.equal(usable.keyUsable, true);
  await expectStatus(recovered.api.post('/api/platform/federation/identity/recover', {}),
    409, 'reject repeated recovery after replacement key becomes usable');

  await expectStatus(observer.api.put(
    `${observerPeerPath}/sites/${observer.siteId}`, { isActive: true }),
  200, 'publish local site before peer key recovery');
  await expectStatus(observer.api.put(outboundGrant, { isActive: true }),
    200, 'activate grant before peer key recovery');
  const candidate = await expectStatus(observer.api.post(
    `${observerPeerPath}/key-recovery/discover`, {}), 200,
  'discover peer recovery key directly');
  assert.equal(candidate.instanceId, recovered.instanceId);
  assert.equal(candidate.fingerprint, replacement.fingerprint);
  await expectStatus(observer.api.post(`${observerPeerPath}/key-recovery`, {
    fingerprint: '0'.repeat(64),
  }), 409, 'reject changed recovery fingerprint');
  const approval = await expectStatus(observer.api.post(
    `${observerPeerPath}/key-recovery`, { fingerprint: candidate.fingerprint }),
  200, 'approve peer recovery key');
  assert.equal(approval.grantsSuspended, true);
  assert.equal(approval.catalogSuspended, true);
  const peer = (await expectStatus(observer.api.request(
    '/api/platform/federation/peers'), 200, 'read recovered peer'))
    .find(value => value.instanceId === recovered.instanceId);
  assert.equal(peer.fingerprint, replacement.fingerprint);
  assert.equal(peer.trusted, true);
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM federation_site_grants
    WHERE peer_instance_id = '${recovered.instanceId}' AND is_active`), '0');
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM federation_remote_sites
    WHERE instance_id = '${recovered.instanceId}' AND is_active`), '0');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM audit_events
    WHERE event_type = 'federation-identity.key-recovered'`), '1');
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM audit_events
    WHERE event_type = 'federation-peer.key-recovery-approved'`), '1');
}

async function assertQueuedOfficialAnswer(sender, receiver, link, outboundGrantPath,
  senderLeader, receiverLeader, revokeNewWorkGrant = true) {
  if (revokeNewWorkGrant) await expectStatus(sender.api.put(outboundGrantPath, { isActive: false }),
    200, 'suspend permission for new work before returning an existing answer');
  const report = 'Synthetic official top-level answer only';
  const queued = await expectStatus(receiver.api.post(
    `/api/platform/federation/test/answer/${link.counterpartId}`,
    { officialReport: report }), 202, 'queue official answer');
  await assertOfficialAnswerDelivered(sender, receiver, link, queued, report,
    senderLeader, receiverLeader);
  if (revokeNewWorkGrant) await expectStatus(sender.api.put(outboundGrantPath, { isActive: true }),
    200, 'restore new-work permission after in-flight answer test');
}

async function assertOfficialAnswerDelivered(sender, receiver, link, queued, report,
  senderLeader, receiverLeader, ordinaryAcceptance = false, classification = null) {
  assert.equal(sqlValue('postgres-b', `SELECT correlation_id FROM federation_outbound_messages
    WHERE message_id = '${queued.messageId}'`), link.originalMessageId);
  const payload = JSON.parse(sqlValue('postgres-b', `SELECT payload_json
    FROM federation_outbound_messages WHERE message_id = '${queued.messageId}'`));
  assert.deepEqual(Object.keys(payload).sort(), ['approvedAt', 'classification', 'officialReport']);
  assert.equal(payload.officialReport, report);
  assert.equal(payload.classification, classification);
  let status;
  for (let attempt = 0; attempt < 30; attempt++) {
    status = sqlValue('postgres-b', `SELECT status FROM federation_outbound_messages
      WHERE message_id = '${queued.messageId}'`);
    if (status === 'delivered' || status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(status, 'delivered', `Official answer was not acknowledged: ${status}`);
  assert.equal(sqlValue('postgres-a', `SELECT official_answer FROM federation_work_links
    WHERE local_work_item_id = '${link.originWorkItemId}' AND direction = 'outgoing'`), report);
  assert.equal(sqlValue('postgres-a', `SELECT official_answer_message_id FROM federation_work_links
    WHERE local_work_item_id = '${link.originWorkItemId}' AND direction = 'outgoing'`), queued.messageId);
  assert.equal(sqlValue('postgres-a', `SELECT official_answer_classification FROM federation_work_links
    WHERE local_work_item_id = '${link.originWorkItemId}' AND direction = 'outgoing'`),
  classification ?? '');
  assert.equal(sqlValue('postgres-a', `SELECT official_answer_site_name FROM federation_work_links
    WHERE local_work_item_id = '${link.originWorkItemId}'`), receiver.siteName);
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM federation_inbound_receipts
    WHERE message_id = '${queued.messageId}' AND local_work_item_id = '${link.originWorkItemId}'`), '1');
  const receiverReports = await expectStatus(receiverLeader.request(
    `/api/work/sites/${receiver.siteId}/reports`), 200, 'receiver report archive');
  assert.ok(receiverReports.reports.some(row => row.id === link.counterpartId &&
    row.finalReport === report && row.siteName === receiver.siteName),
  'Official response was not archived at receiving site');
  const beforeAcceptance = await expectStatus(senderLeader.request(
    `/api/work/sites/${sender.siteId}/reports`), 200, 'sender report archive before acceptance');
  assert.ok(!beforeAcceptance.reports.some(row => row.id === link.originWorkItemId),
    'Sender report must await leader acceptance');
  if (ordinaryAcceptance) {
    await expectStatus(senderLeader.put(
      `/api/work/sites/${sender.siteId}/items/${link.originWorkItemId}/status`, {
        status: 'completed', assignedUnitId: null, decisionNote: null, priority: null,
      }), 204, 'site leader closes request with official response');
  } else {
    await expectStatus(senderLeader.post(
      `/api/federation/test/sites/${sender.siteId}/items/${link.originWorkItemId}/accept-answer`, {}),
    204, 'site leader accepts official response');
  }
  const senderReports = await expectStatus(senderLeader.request(
    `/api/work/sites/${sender.siteId}/reports`), 200, 'sender report archive after acceptance');
  assert.ok(senderReports.reports.some(row => row.id === link.originWorkItemId &&
    row.finalReport === report && row.siteName === receiver.siteName &&
    row.writtenBy === receiver.siteName),
  'Sender archive lost the receiving site as official report header');
  const senderReport = senderReports.reports.find(row => row.id === link.originWorkItemId);
  const receiverReport = receiverReports.reports.find(row => row.id === link.counterpartId);
  assert.equal(receiverReport.finalReportClassification, classification,
    'Receiver report archive lost the official classification');
  assert.equal(senderReport.finalReportClassification, classification,
    'Sender report archive lost the federated official classification');
  assert.equal(senderReport.reportCreatedAt, receiverReport.finalReportApprovedAt,
    'Sender must preserve the receiver approval timestamp');
  assert.ok(new Date(senderReport.workCompletedAt) >= new Date(senderReport.reportCreatedAt),
    'Sender completion must not predate the official report');
  if (ordinaryAcceptance) {
    await expectStatus(senderLeader.put(
      `/api/work/sites/${sender.siteId}/items/${link.originWorkItemId}/status`, {
        status: 'completed', assignedUnitId: null, decisionNote: null, priority: null,
      }), 409, 'second report acceptance rejected');
  } else {
    await expectStatus(senderLeader.post(
      `/api/federation/test/sites/${sender.siteId}/items/${link.originWorkItemId}/accept-answer`, {}),
    409, 'second report acceptance rejected');
  }
  await expectStatus(receiver.api.post(
    `/api/platform/federation/test/answer/${link.counterpartId}`,
    { officialReport: 'A second answer must not replace the first' }),
  productionBoundary ? 404 : 409, 'second official answer rejected or synthetic route absent');
  sql('postgres-b', `UPDATE federation_outbound_messages SET status = 'retrying',
    next_attempt_at = NOW() - INTERVAL '1 second' WHERE message_id = '${queued.messageId}'`);
  for (let attempt = 0; attempt < 30; attempt++) {
    const attempts = Number(sqlValue('postgres-b', `SELECT attempt_count
      FROM federation_outbound_messages WHERE message_id = '${queued.messageId}'`));
    status = sqlValue('postgres-b', `SELECT status FROM federation_outbound_messages
      WHERE message_id = '${queued.messageId}'`);
    if (attempts >= 2 && status === 'delivered') break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(status, 'delivered', 'Idempotent answer retry did not finish');
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM federation_inbound_receipts
    WHERE message_id = '${queued.messageId}'`), '1');
}

async function assertOperationalReturnPath(sender, receiver, link, senderLeader, receiverLeader) {
  await expectStatus(receiverLeader.put(
    `/api/work/sites/${receiver.siteId}/items/${link.counterpartId}/status`, {
      status: 'under_review', assignedUnitId: null, decisionNote: null, priority: 'normal',
    }), 204, 'ordinary receiver starts federated request review');
  const progressId = sqlValue('postgres-b', `SELECT message_id
    FROM federation_outbound_messages WHERE message_type = 'assignment.progress'
      AND origin_resource_id = '${link.originWorkItemId}' ORDER BY created_at DESC LIMIT 1`);
  await awaitOutboundMessage('postgres-b', progressId, 'deliver ordinary progress');
  assert.equal(sqlValue('postgres-a', `SELECT remote_progress_status FROM federation_work_links
    WHERE local_work_item_id = '${link.originWorkItemId}'`), 'under_review');

  // The return integration is independent of execution workflow details. Put this
  // disposable pair fixture at the ordinary report-review boundary, then use only
  // the public report, approval and completion commands under test.
  sql('postgres-b', `BEGIN; SELECT set_config('fylkren.activity_writer','1',true); UPDATE work_items SET status = 'in_review'
    WHERE id = '${link.counterpartId}'; COMMIT;`);
  await expectStatus(receiver.api.put('/api/platform/classifications/settings', {
    enabled: true,
  }), 204, 'enable classifications on receiver');
  const definitions = await expectStatus(receiver.api.request('/api/platform/classifications/'), 200, 'read receiver classification definitions');
  if (!definitions.items.some(value => value.abbreviation === 'SECRET' && value.isActive))
    await expectStatus(receiver.api.post('/api/platform/classifications/', { name: 'SECRET', abbreviation: 'SECRET', sortOrder: 50, isActive: true }), 201, 'create synthetic receiver classification');
  const report = 'Official answer completed through ordinary work commands';
  const privateLearning = { id: randomUUID(), kind: 'improvement', text: 'PRIVATE_FEDERATED_LEARNING_SENTINEL' };
  await expectStatus(receiverLeader.put(
    `/api/work/sites/${receiver.siteId}/items/${link.counterpartId}/final-report`, {
      content: report, classification: 'SECRET', lessons: [privateLearning],
    }), 204, 'write ordinary federated final report');
  await expectStatus(receiverLeader.post(
    `/api/work/sites/${receiver.siteId}/items/${link.counterpartId}/final-report/approve`, {}),
  204, 'approve ordinary federated final report');
  await expectStatus(receiverLeader.put(
    `/api/work/sites/${receiver.siteId}/items/${link.counterpartId}/status`, {
      status: 'completed', assignedUnitId: null, decisionNote: null, priority: null,
    }), 204, 'complete ordinary federated receiver task');
  const answerId = sqlValue('postgres-b', `SELECT message_id
    FROM federation_outbound_messages WHERE message_type = 'assignment.answered'
      AND origin_resource_id = '${link.originWorkItemId}' ORDER BY created_at DESC LIMIT 1`);
  await assertOfficialAnswerDelivered(sender, receiver, link, { messageId: answerId }, report,
    senderLeader, receiverLeader, true, 'SECRET');
  const localLessons = await expectStatus(receiverLeader.request(`/api/work/learning?workItemId=${link.counterpartId}&view=all`), 200, 'read receiver internal learning');
  assert.ok(localLessons.items.some(value => value.id === privateLearning.id && value.text === privateLearning.text));
  const remoteLessons = await expectStatus(senderLeader.request(`/api/work/learning?workItemId=${link.originWorkItemId}&view=all`), 200, 'read sender learning');
  assert.equal(remoteLessons.total, 0, 'Receiver internal learning was copied to sender');
  assert.equal(sqlValue('postgres-b', `SELECT count(*) FROM federation_outbound_messages WHERE payload_json LIKE '%${privateLearning.text}%'`), '0', 'Internal learning leaked into federation messages');
}

async function moveSiteBelowNewParent(owner, siteName, parentName) {
  const parent = await expectStatus(owner.api.post('/api/sites/', {
    name: parentName, overviewDesign: 'classic',
  }), 201, `create ${parentName}`);
  const placements = await expectStatus(owner.api.request('/api/site-placement-options'),
    200, `load placement options for ${parentName}`);
  const root = placements.find(value => value.siteId === parent.id && value.isSiteRoot);
  assert.ok(root, `Site root missing for ${parentName}`);
  await expectStatus(owner.api.put(`/api/sites/${owner.siteId}`, {
    name: siteName, parentOrganizationUnitId: root.id,
    isActive: true, overviewDesign: 'classic',
  }), 200, `move ${siteName} below ${parentName}`);
  return root.id;
}

async function restoreTopLevelSite(owner, siteName) {
  await expectStatus(owner.api.put(`/api/sites/${owner.siteId}`, {
    name: siteName, parentOrganizationUnitId: null,
    isActive: true, overviewDesign: 'classic',
  }), 200, `restore ${siteName} to top level`);
}

async function assertReplyAfterOriginSiteMove(sender, receiver, link, senderLeader,
  receiverLeader, receiverPeerPath, outboundGrantPath) {
  let finalParentUnitId;
  for (const name of ['Synthetic Parent One', 'Synthetic Parent Two']) {
    finalParentUnitId = await moveSiteBelowNewParent(sender, 'Synthetic Root a', name);
  }
  assert.equal(sqlValue('postgres-a', `SELECT parent_organization_unit_id FROM sites
    WHERE id = '${sender.siteId}'`), finalParentUnitId);
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM federation_site_publications
    WHERE local_site_id = '${sender.siteId}' AND is_active`), '0',
  'Moved origin site must not stay published as a top-level destination');
  await expectStatus(receiver.api.post(`${receiverPeerPath}/catalog/sync`, {}),
    200, 'sync moved origin site');
  const catalog = await expectStatus(receiver.api.request(`${receiverPeerPath}/catalog`),
    200, 'read moved origin snapshot');
  assert.equal(catalog.find(value => value.siteId === sender.siteId)?.isActive, false);
  await assertQueuedOfficialAnswer(sender, receiver, link, outboundGrantPath,
    senderLeader, receiverLeader, false);
  await restoreTopLevelSite(sender, 'Synthetic Root a');
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM federation_site_publications
    WHERE local_site_id = '${sender.siteId}' AND is_active`), '0',
  'Returning to top level must not silently republish the site');
}

async function assertReplyAfterDestinationSiteMove(sender, receiver, answerLink, cancellationLink,
  senderLeader, receiverLeader, senderPeerPath, receiverPeerPath,
  outboundGrantPath, inboundGrantPath) {
  await moveSiteBelowNewParent(receiver, 'Synthetic Root b', 'Synthetic Receiving Parent');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_site_publications
    WHERE local_site_id = '${receiver.siteId}' AND is_active`), '0',
  'Moved receiving site must not remain published');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_site_grants
    WHERE local_site_id = '${receiver.siteId}' AND direction = 'inbound' AND is_active`), '0',
  'Moved receiving site must not retain its new-work grant');
  await expectStatus(sender.api.post(`${senderPeerPath}/catalog/sync`, {}),
    200, 'sync moved receiving site');
  const catalog = await expectStatus(sender.api.request(`${senderPeerPath}/catalog`),
    200, 'read moved receiving site snapshot');
  assert.equal(catalog.find(value => value.siteId === receiver.siteId)?.isActive, false);
  const queuedBefore = sqlValue('postgres-a', 'SELECT COUNT(*) FROM federation_outbound_messages');
  await expectStatus(sender.api.post('/api/platform/federation/test/outbound', {
    sourceSiteId: sender.siteId, destinationSiteId: receiver.siteId,
    peerInstanceId: receiver.instanceId,
    title: 'Rejected work after destination move', instruction: 'Must not be queued',
  }), 409, 'new work must be blocked after receiving site becomes a child');
  assert.equal(sqlValue('postgres-a', 'SELECT COUNT(*) FROM federation_outbound_messages'),
    queuedBefore, 'Rejected new work must not leave an outbound message');
  await assertQueuedOfficialAnswer(sender, receiver, answerLink, outboundGrantPath,
    senderLeader, receiverLeader, false);
  await assertQueuedCancellation(sender, receiver, cancellationLink, outboundGrantPath, false);
  await restoreTopLevelSite(receiver, 'Synthetic Root b');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_site_publications
    WHERE local_site_id = '${receiver.siteId}' AND is_active`), '0',
  'Restoring receiving site must not silently republish it');
  await expectStatus(receiver.api.put(`${receiverPeerPath}/sites/${receiver.siteId}`,
    { isActive: true }), 200, 'explicitly republish receiving site');
  await expectStatus(sender.api.post(`${senderPeerPath}/catalog/sync`, {}),
    200, 'sync restored receiving site');
  await expectStatus(sender.api.put(outboundGrantPath, { isActive: true }),
    200, 'restore outbound grant explicitly');
  await expectStatus(receiver.api.put(inboundGrantPath, { isActive: true }),
    200, 'restore inbound grant explicitly');
  const restored = await expectStatus(sender.api.post(`${outboundGrantPath}/verify`, {}),
    200, 'verify restored reciprocal grant');
  assert.equal(restored.reciprocal, true);
  assert.equal(restored.routable, true);
}

async function assertReplyAfterBothSitesMove(sender, receiver, link, senderLeader,
  receiverLeader, senderPeerPath, receiverPeerPath, outboundGrantPath, inboundGrantPath) {
  await moveSiteBelowNewParent(sender, 'Synthetic Root a', 'Synthetic Dual-Move Parent A');
  await moveSiteBelowNewParent(receiver, 'Synthetic Root b', 'Synthetic Dual-Move Parent B');
  for (const [owner, database] of [[sender, 'postgres-a'], [receiver, 'postgres-b']]) {
    assert.equal(sqlValue(database, `SELECT COUNT(*) FROM federation_site_publications
      WHERE local_site_id = '${owner.siteId}' AND is_active`), '0',
    'Neither moved site may remain published');
  }
  await expectStatus(sender.api.post(`${senderPeerPath}/catalog/sync`, {}),
    200, 'sync moved destination of dual move');
  await expectStatus(receiver.api.post(`${receiverPeerPath}/catalog/sync`, {}),
    200, 'sync moved origin of dual move');
  const senderCatalog = await expectStatus(sender.api.request(`${senderPeerPath}/catalog`),
    200, 'read moved destination of dual move');
  const receiverCatalog = await expectStatus(receiver.api.request(`${receiverPeerPath}/catalog`),
    200, 'read moved origin of dual move');
  assert.equal(senderCatalog.find(value => value.siteId === receiver.siteId)?.isActive, false);
  assert.equal(receiverCatalog.find(value => value.siteId === sender.siteId)?.isActive, false);
  const queuedBefore = sqlValue('postgres-a', 'SELECT COUNT(*) FROM federation_outbound_messages');
  await expectStatus(sender.api.post('/api/platform/federation/test/outbound', {
    sourceSiteId: sender.siteId, destinationSiteId: receiver.siteId,
    peerInstanceId: receiver.instanceId,
    title: 'Rejected work after both site moves', instruction: 'Must not be queued',
  }), 409, 'new work must be blocked after both sites become children');
  assert.equal(sqlValue('postgres-a', 'SELECT COUNT(*) FROM federation_outbound_messages'),
    queuedBefore, 'Rejected new work must not leave an outbound message');
  await assertQueuedOfficialAnswer(sender, receiver, link, outboundGrantPath,
    senderLeader, receiverLeader, false);
  await restoreTopLevelSite(sender, 'Synthetic Root a');
  await restoreTopLevelSite(receiver, 'Synthetic Root b');
  for (const [owner, database] of [[sender, 'postgres-a'], [receiver, 'postgres-b']]) {
    assert.equal(sqlValue(database, `SELECT COUNT(*) FROM federation_site_publications
      WHERE local_site_id = '${owner.siteId}' AND is_active`), '0',
    'Returning either site to root must not silently republish it');
  }
  await expectStatus(sender.api.put(`${senderPeerPath}/sites/${sender.siteId}`,
    { isActive: true }), 200, 'republish origin after dual move');
  await expectStatus(receiver.api.put(`${receiverPeerPath}/sites/${receiver.siteId}`,
    { isActive: true }), 200, 'republish destination after dual move');
  await expectStatus(sender.api.post(`${senderPeerPath}/catalog/sync`, {}),
    200, 'sync restored destination after dual move');
  await expectStatus(receiver.api.post(`${receiverPeerPath}/catalog/sync`, {}),
    200, 'sync restored origin after dual move');
  await expectStatus(sender.api.put(outboundGrantPath, { isActive: true }),
    200, 'restore outbound grant after dual move');
  await expectStatus(receiver.api.put(inboundGrantPath, { isActive: true }),
    200, 'restore inbound grant after dual move');
  const restored = await expectStatus(sender.api.post(`${outboundGrantPath}/verify`, {}),
    200, 'verify grants after dual move');
  assert.equal(restored.reciprocal, true);
  assert.equal(restored.routable, true);
}

async function assertQueuedAnswerSurvivesOutageAndMove(sender, receiver, link,
  senderLeader, receiverLeader, senderPeerPath, receiverPeerPath,
  outboundGrantPath, inboundGrantPath) {
  compose(['stop', 'api-a']);
  const report = 'Synthetic answer queued during origin outage';
  const queued = await expectStatus(receiver.api.post(
    `/api/platform/federation/test/answer/${link.counterpartId}`,
    { officialReport: report }), 202, 'queue answer while origin is unavailable');
  let failure;
  for (let attempt = 0; attempt < 20; attempt++) {
    failure = sqlValue('postgres-b', `SELECT status || ':' || attempt_count || ':' ||
      COALESCE(last_error_code, '') FROM federation_outbound_messages
      WHERE message_id = '${queued.messageId}'`);
    if (/^retrying:[1-9][0-9]*:.+/.test(failure)) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.match(failure, /^retrying:[1-9][0-9]*:.+$/,
    'Answer must remain retryable after the origin becomes unavailable');
  sql('postgres-b', `UPDATE federation_outbound_messages
    SET next_attempt_at = NOW() + INTERVAL '1 hour'
    WHERE message_id = '${queued.messageId}' AND status = 'retrying'`);
  await moveSiteBelowNewParent(receiver, 'Synthetic Root b', 'Synthetic Outage Parent B');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_site_publications
    WHERE local_site_id = '${receiver.siteId}' AND is_active`), '0');
  compose(['start', 'api-a']);
  let healthy = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      healthy = (await sender.api.request('/health')).status === 200;
    } catch { /* API is still starting. */ }
    if (healthy) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(healthy, true, 'Origin API did not recover after outage');
  await expectEventuallyStatus(() => sender.api.post(`${senderPeerPath}/catalog/sync`, {}),
    200, 'sync moved receiver after origin outage');
  const catalog = await expectStatus(sender.api.request(`${senderPeerPath}/catalog`),
    200, 'read receiver snapshot after origin outage');
  assert.equal(catalog.find(value => value.siteId === receiver.siteId)?.isActive, false);
  assert.equal(sqlValue('postgres-b', `SELECT status FROM federation_outbound_messages
    WHERE message_id = '${queued.messageId}'`), 'retrying',
  'The queued answer must not have bypassed the controlled retry window');
  sql('postgres-b', `UPDATE federation_outbound_messages
    SET next_attempt_at = NOW() - INTERVAL '1 second'
    WHERE message_id = '${queued.messageId}' AND status = 'retrying'`);
  await assertOfficialAnswerDelivered(sender, receiver, link, queued, report,
    senderLeader, receiverLeader);
  await restoreTopLevelSite(receiver, 'Synthetic Root b');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_site_publications
    WHERE local_site_id = '${receiver.siteId}' AND is_active`), '0');
  await expectStatus(receiver.api.put(`${receiverPeerPath}/sites/${receiver.siteId}`,
    { isActive: true }), 200, 'republish receiver after outage test');
  await expectStatus(sender.api.post(`${senderPeerPath}/catalog/sync`, {}),
    200, 'sync restored receiver after outage test');
  await expectStatus(sender.api.put(outboundGrantPath, { isActive: true }),
    200, 'restore outbound grant after outage test');
  await expectStatus(receiver.api.put(inboundGrantPath, { isActive: true }),
    200, 'restore inbound grant after outage test');
  const restored = await expectStatus(sender.api.post(`${outboundGrantPath}/verify`, {}),
    200, 'verify grants after outage test');
  assert.equal(restored.reciprocal, true);
  assert.equal(restored.routable, true);
}

async function assertQueuedProgress(sender, receiver, link) {
  const sent = [];
  for (const [phase, sequence] of [['under_review', 1], ['assigned', 2]]) {
    const queued = await expectStatus(receiver.api.post(
      `/api/platform/federation/test/progress/${link.counterpartId}`, { phase }),
    202, `queue ${phase} progress`);
    assert.equal(queued.sequence, sequence);
    const payload = JSON.parse(sqlValue('postgres-b', `SELECT payload_json
      FROM federation_outbound_messages WHERE message_id = '${queued.messageId}'`));
    assert.deepEqual(payload, { phase, sequence });
    let status;
    for (let attempt = 0; attempt < 30; attempt++) {
      status = sqlValue('postgres-b', `SELECT status FROM federation_outbound_messages
        WHERE message_id = '${queued.messageId}'`);
      if (status === 'delivered' || status === 'failed') break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert.equal(status, 'delivered', `Progress ${phase} not delivered: ${status}`);
    assert.equal(sqlValue('postgres-a', `SELECT remote_progress_status
      FROM federation_work_links WHERE local_work_item_id = '${link.originWorkItemId}'`), phase);
    assert.equal(sqlValue('postgres-a', `SELECT remote_progress_sequence
      FROM federation_work_links WHERE local_work_item_id = '${link.originWorkItemId}'`), String(sequence));
    sent.push(queued.messageId);
  }
  sql('postgres-b', `UPDATE federation_outbound_messages SET status = 'retrying',
    next_attempt_at = NOW() - INTERVAL '1 second' WHERE message_id = '${sent[0]}'`);
  for (let attempt = 0; attempt < 30; attempt++) {
    const attempts = Number(sqlValue('postgres-b', `SELECT attempt_count
      FROM federation_outbound_messages WHERE message_id = '${sent[0]}'`));
    const status = sqlValue('postgres-b', `SELECT status FROM federation_outbound_messages
      WHERE message_id = '${sent[0]}'`);
    if (attempts >= 2 && status === 'delivered') break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(sqlValue('postgres-a', `SELECT remote_progress_status
    FROM federation_work_links WHERE local_work_item_id = '${link.originWorkItemId}'`), 'assigned',
  'Older progress retry reverted sender state');
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM federation_inbound_receipts
    WHERE message_id = '${sent[0]}'`), '1');
}

async function assertQueuedCancellation(sender, receiver, link, outboundGrantPath,
  revokeNewWorkGrant = true, senderLeader = null) {
  if (revokeNewWorkGrant) await expectStatus(sender.api.put(outboundGrantPath, { isActive: false }),
    200, 'suspend new-work grant before cancelling existing assignment');
  let queued;
  if (senderLeader) {
    await expectStatus(senderLeader.post(
      `/api/work/sites/${sender.siteId}/items/${link.originWorkItemId}/cancel`,
      { decisionNote: 'Synthetic request withdrawn' }), 202,
    'queue cancellation through ordinary command');
    queued = { messageId: sqlValue('postgres-a', `SELECT message_id
      FROM federation_outbound_messages WHERE message_type = 'assignment.cancelled'
        AND origin_resource_id = '${link.originWorkItemId}' ORDER BY created_at DESC LIMIT 1`) };
  } else {
    queued = await expectStatus(sender.api.post(
      `/api/platform/federation/test/cancel/${link.originWorkItemId}`,
      { reason: 'Synthetic request withdrawn' }), 202, 'queue cancellation');
  }
  const immediateWorkStatus = sqlValue('postgres-a', `SELECT status FROM work_items
    WHERE id = '${link.originWorkItemId}'`);
  const immediateMessageStatus = sqlValue('postgres-a', `SELECT status
    FROM federation_outbound_messages WHERE message_id = '${queued.messageId}'`);
  assert.ok(immediateWorkStatus !== 'cancelled' || immediateMessageStatus === 'delivered',
  `Sender closed before a signed acknowledgement: ${immediateWorkStatus}/${immediateMessageStatus}`);
  assert.equal(sqlValue('postgres-a', `SELECT correlation_id FROM federation_outbound_messages
    WHERE message_id = '${queued.messageId}'`), link.originalMessageId);
  let status;
  for (let attempt = 0; attempt < 30; attempt++) {
    status = sqlValue('postgres-a', `SELECT status FROM federation_outbound_messages
      WHERE message_id = '${queued.messageId}'`);
    if (status === 'delivered' || status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(status, 'delivered', `Cancellation was not acknowledged: ${status}`);
  assert.equal(sqlValue('postgres-b', `SELECT status FROM work_items
    WHERE id = '${link.counterpartId}'`), 'request_cancelled');
  assert.equal(sqlValue('postgres-a', `SELECT status FROM work_items
    WHERE id = '${link.originWorkItemId}'`), 'cancelled');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM work_items
    WHERE id = '${link.counterpartId}'`), '1', 'Recipient task must remain for leader acknowledgement');
  if (senderLeader) {
    await expectStatus(senderLeader.post(
      `/api/work/sites/${sender.siteId}/items/${link.originWorkItemId}/cancel`,
      { decisionNote: 'Second cancellation' }), 409, 'second cancellation rejected');
  } else {
    await expectStatus(sender.api.post(
      `/api/platform/federation/test/cancel/${link.originWorkItemId}`,
      { reason: 'Second cancellation' }), 409, 'second cancellation rejected');
  }
  sql('postgres-a', `UPDATE federation_outbound_messages SET status = 'retrying',
    next_attempt_at = NOW() - INTERVAL '1 second' WHERE message_id = '${queued.messageId}'`);
  // The worker uses a 60-second claim lease. A production-like gateway adds
  // another network hop, so allow one full lease plus scheduling headroom.
  for (let attempt = 0; attempt < 75; attempt++) {
    const attempts = Number(sqlValue('postgres-a', `SELECT attempt_count
      FROM federation_outbound_messages WHERE message_id = '${queued.messageId}'`));
    status = sqlValue('postgres-a', `SELECT status FROM federation_outbound_messages
      WHERE message_id = '${queued.messageId}'`);
    if (attempts >= 2 && status === 'delivered') break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const retryError = sqlValue('postgres-a', `SELECT COALESCE(last_error_code, '')
    FROM federation_outbound_messages WHERE message_id = '${queued.messageId}'`);
  assert.equal(status, 'delivered',
    `Idempotent cancellation retry did not finish (${retryError || 'no error code'})`);
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_inbound_receipts
    WHERE message_id = '${queued.messageId}'`), '1');
  if (revokeNewWorkGrant) await expectStatus(sender.api.put(outboundGrantPath, { isActive: true }),
    200, 'restore new-work permission after cancellation test');
}

async function assertAnswerCancellationRace(sender, receiver, link) {
  const rowLock = startSqlLock('postgres-b', `SELECT id FROM work_items
    WHERE id = '${link.counterpartId}' FOR UPDATE`);
  await rowLock.locked;
  const answerPromise = receiver.api.post(
    `/api/platform/federation/test/answer/${link.counterpartId}`,
    { officialReport: 'Synthetic answer racing with cancellation' });
  await awaitLockWaiters('postgres-b', 1,
    'official answer did not reach the locked receiver row');
  const cancellation = await expectStatus(sender.api.post(
    `/api/platform/federation/test/cancel/${link.originWorkItemId}`,
    { reason: 'Synthetic cancellation racing with answer' }), 202,
  'queue cancellation racing with answer');
  await awaitLockWaiters('postgres-b', 2,
    'answer and cancellation did not contend on the receiver row');
  await rowLock.done;
  const answer = await answerPromise;
  assert.ok(answer.status === 202 || answer.status === 409,
    `Answer/cancellation race returned ${answer.status}: ${JSON.stringify(answer.body)}`);

  if (answer.status === 202) {
    await awaitOutboundMessage('postgres-b', answer.body.messageId,
      'winning answer was not delivered');
    for (let attempt = 0; attempt < 30; attempt++) {
      if (Number(sqlValue('postgres-a', `SELECT attempt_count FROM federation_outbound_messages
          WHERE message_id = '${cancellation.messageId}'`)) >= 1) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.notEqual(sqlValue('postgres-a', `SELECT status FROM federation_outbound_messages
      WHERE message_id = '${cancellation.messageId}'`), 'delivered',
    'Cancellation was acknowledged after the answer won');
    assert.equal(sqlValue('postgres-b', `SELECT status FROM work_items
      WHERE id = '${link.counterpartId}'`), 'completed');
    assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_inbound_receipts
      WHERE message_id = '${cancellation.messageId}'`), '0');
    assert.equal(sqlValue('postgres-a', `SELECT official_answer_message_id IS NOT NULL
      FROM federation_work_links WHERE local_work_item_id = '${link.originWorkItemId}'`), 't');
  } else {
    await awaitOutboundMessage('postgres-a', cancellation.messageId,
      'winning cancellation was not delivered');
    assert.equal(sqlValue('postgres-b', `SELECT status FROM work_items
      WHERE id = '${link.counterpartId}'`), 'request_cancelled');
    assert.equal(sqlValue('postgres-a', `SELECT status FROM work_items
      WHERE id = '${link.originWorkItemId}'`), 'cancelled');
    assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_outbound_messages
      WHERE message_type = 'assignment.answered'
        AND origin_resource_id = '${link.originWorkItemId}'`), '0');
  }
  const answered = sqlValue('postgres-a', `SELECT official_answer_message_id IS NOT NULL
    FROM federation_work_links WHERE local_work_item_id = '${link.originWorkItemId}'`) === 't';
  const cancelled = sqlValue('postgres-a', `SELECT status = 'cancelled' FROM work_items
    WHERE id = '${link.originWorkItemId}'`) === 't';
  assert.notEqual(answered, cancelled,
    'Answer/cancellation race produced both or neither terminal outcomes');
}

async function awaitPolicyRejectedDelivery(messageId, originWorkItemId, expectedError, label) {
  let error = '';
  for (let attempt = 0; attempt < 40; attempt++) {
    error = sqlValue('postgres-a', `SELECT COALESCE(last_error_code, '')
      FROM federation_outbound_messages WHERE message_id = '${messageId}'`);
    if (error === expectedError) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(error, expectedError, `${label} was not rejected at delivery`);
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM federation_work_links
    WHERE origin_resource_id = '${originWorkItemId}'`), '0',
  `${label} created a receiver link despite the policy change`);
  sql('postgres-a', `UPDATE federation_outbound_messages SET attempt_count = 5,
    next_attempt_at = NOW() - INTERVAL '1 second' WHERE message_id = '${messageId}'`);
  for (let attempt = 0; attempt < 40; attempt++) {
    if (sqlValue('postgres-a', `SELECT status FROM federation_outbound_messages
        WHERE message_id = '${messageId}'`) === 'failed') return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.fail(`${label} did not reach a bounded permanent failure`);
}

async function queueWhileOutboundTableLocked(sender, receiver, title) {
  const tableLock = startSqlLock('postgres-a',
    'LOCK TABLE federation_outbound_messages IN ACCESS EXCLUSIVE MODE');
  await tableLock.locked;
  const queuedPromise = sender.api.post('/api/platform/federation/test/outbound', {
    sourceSiteId: sender.siteId, destinationSiteId: receiver.siteId,
    peerInstanceId: receiver.instanceId, title, instruction: 'Policy changes before commit',
  });
  await awaitLockWaiters('postgres-a', 1,
    `${title} did not reach the locked outbox`);
  return { tableLock, queuedPromise };
}

async function assertRevocationSendRace(sender, receiver, inboundGrantPath) {
  const pending = await queueWhileOutboundTableLocked(sender, receiver,
    'Synthetic revocation-versus-send race');
  await expectStatus(receiver.api.put(inboundGrantPath, { isActive: false }),
    200, 'revoke inbound grant while sender commit is blocked');
  await pending.tableLock.done;
  const queued = await expectStatus(pending.queuedPromise, 202,
    'commit assignment authorized before concurrent revocation');
  await awaitPolicyRejectedDelivery(queued.messageId, queued.workItemId,
    'remote_grant_denied', 'revocation-versus-send race');
  await expectStatus(receiver.api.put(inboundGrantPath, { isActive: true }),
    200, 'restore inbound grant after revocation race');
}

async function assertSiteMoveSendRace(sender, receiver, senderPeerPath, receiverPeerPath,
  outboundGrantPath, inboundGrantPath) {
  const pending = await queueWhileOutboundTableLocked(sender, receiver,
    'Synthetic site-move-versus-send race');
  await moveSiteBelowNewParent(receiver, 'Synthetic Root b', 'Synthetic Send-Race Parent');
  await pending.tableLock.done;
  const queued = await expectStatus(pending.queuedPromise, 202,
    'commit assignment authorized before concurrent site move');
  await awaitPolicyRejectedDelivery(queued.messageId, queued.workItemId,
    'remote_grant_denied', 'site-move-versus-send race');
  await restoreTopLevelSite(receiver, 'Synthetic Root b');
  await expectStatus(receiver.api.put(`${receiverPeerPath}/sites/${receiver.siteId}`,
    { isActive: true }), 200, 'republish receiver after send race');
  await expectStatus(sender.api.post(`${senderPeerPath}/catalog/sync`, {}),
    200, 'sync receiver after send race');
  await expectStatus(sender.api.put(outboundGrantPath, { isActive: true }),
    200, 'restore outbound grant after send race');
  await expectStatus(receiver.api.put(inboundGrantPath, { isActive: true }),
    200, 'restore inbound grant after send race');
  const restored = await expectStatus(sender.api.post(`${outboundGrantPath}/verify`, {}),
    200, 'verify grants after send race');
  assert.equal(restored.reciprocal, true);
}

async function assertCatalogDefenses(observer, publisher, peerPath) {
  const futureName = 'Synthetic Future Snapshot';
  sql('postgres-a', `UPDATE federation_remote_sites SET name = '${futureName}', catalog_revision = 1000000
    WHERE instance_id = '${publisher.instanceId}' AND site_id = '${publisher.siteId}'`);
  await expectStatus(observer.api.post(`${peerPath}/catalog/sync`, {}), 200, 'sync older signed catalog');
  const stale = await expectStatus(observer.api.request(`${peerPath}/catalog`), 200, 'read stale-guarded catalog');
  const preserved = stale.find(site => site.siteId === publisher.siteId);
  assert.equal(preserved.name, futureName, 'An older signed revision overwrote newer local state');
  assert.equal(preserved.catalogRevision, 1000000);

  // An omitted entry is a defensive case distinct from normal API revocation.
  sql('postgres-b', `DELETE FROM federation_site_publications
    WHERE peer_instance_id = '${observer.instanceId}' AND local_site_id = '${publisher.siteId}'`);
  await expectStatus(observer.api.post(`${peerPath}/catalog/sync`, {}), 200, 'sync omitted site');
  const omitted = await expectStatus(observer.api.request(`${peerPath}/catalog`), 200, 'read omitted site');
  assert.equal(omitted.find(site => site.siteId === publisher.siteId).isActive, false,
    'A previously known site omitted by the peer must be suspended');
}

async function assertPopulatedUpgrade(owner) {
  // This disposable database is deliberately returned to the immediately previous
  // schema while preserving its already populated people, site and license rows.
  compose(['stop', 'api-a']);
  const statements = [
    'BEGIN',
    // Rows that use the new federated recipient shape cannot exist in the
    // immediately previous schema represented by this downgrade fixture.
    'DELETE FROM workflow_plan_requests WHERE target_site_id IS NULL',
    'ALTER TABLE workflow_plan_requests DROP CONSTRAINT "CK_workflow_plan_requests_recipient"',
    'DROP INDEX "IX_workflow_plan_requests_run_id_step_id_target_instance_id_remote_site_id"',
    'DROP INDEX "IX_workflow_plan_requests_run_id_step_id_target_site_id"',
    'ALTER TABLE workflow_plan_requests DROP COLUMN target_instance_id',
    'ALTER TABLE workflow_plan_requests DROP COLUMN remote_site_id',
    'ALTER TABLE workflow_plan_requests DROP COLUMN target_site_name_snapshot',
    'ALTER TABLE workflow_plan_requests ALTER COLUMN target_site_id SET NOT NULL',
    'CREATE UNIQUE INDEX "IX_workflow_plan_requests_run_id_step_id_target_site_id" ON workflow_plan_requests (run_id, step_id, target_site_id)',
    'DROP TABLE federation_inbound_receipts',
    'DROP TABLE federation_outbound_messages',
    'DROP TABLE federation_probe_nonces',
    'DROP TABLE federation_site_publications',
    'DROP TABLE federation_site_grants',
    'DROP TABLE federation_work_links',
    'DROP TABLE federation_remote_sites',
    'DROP TABLE federation_signing_identity',
    'DROP TABLE federation_peers',
    `DELETE FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260924120000_AddFederationPeerCandidates'`,
    `DELETE FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260925110000_AddFederationInboundReceipts'`,
    `DELETE FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260925120000_AddFederationOfficialAnswer'`,
    `DELETE FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260925130000_AddFederationProgress'`,
    `DELETE FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260925140000_AddFederationOfficialAnswerSiteName'`,
    `DELETE FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260926190000_AddFederatedPlanRecipients'`,
    `DELETE FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260926220000_AddFederationOfficialAnswerClassification'`,
    `DELETE FROM "__EFMigrationsHistory" WHERE "MigrationId" IN ('20260926230000_AddFederationKeyRotation', '20260926240000_AutomateFederationKeyRotation')`,
    'COMMIT',
  ].join('; ') + ';';
  sql('postgres-a', statements);
  compose(['up', '-d', '--no-build', '--wait', 'api-a']);
  const sites = await expectStatus(owner.api.request('/api/sites/'), 200, 'sites after migration');
  assert.ok(sites.some(site => site.id === owner.siteId), 'The existing site was lost during migration');
  const status = await expectStatus(owner.api.request('/api/platform/license'), 200, 'license after migration');
  assert.equal(status.status.instanceId, owner.instanceId);
  assert.equal(status.status.edition, 'enterprise');
  const identity = await expectStatus(owner.api.request('/api/platform/federation/identity'),
    200, 'federation tables after migration');
  assert.equal(identity.keyConfigured, false, 'The reconstructed pre-federation schema must start with no key');
  sql('postgres-a', `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workflow_plan_requests' AND column_name = 'target_instance_id')
    OR NOT EXISTS (SELECT 1 FROM pg_constraint
        WHERE conname = 'CK_workflow_plan_requests_recipient')
    THEN RAISE EXCEPTION 'federated plan recipient migration is incomplete'; END IF;
  END; $$`);
}

async function runOutboundPair() {
  const a = await setup('https://localhost:18443', 'a');
  const leader = await makeSiteLeader(a, 'https://localhost:18443');
  for (const port of [446, 447, 448, 449]) {
    await expectStatus(a.api.post('/api/platform/federation/peers/discover', { baseUrl: `https://tls:${port}` }),
      502, `reject oversized/redirect/private federation discovery on ${port}`);
  }
  const hookRoot = `/api/platform/webhooks/sites/${a.siteId}`;
  const subscriptions = [];
  for (const path of ['https://tls/outbound/webhook-large', 'https://tls/outbound/redirect', 'https://tls:448/outbound/canary']) {
    subscriptions.push(await expectStatus(a.api.post(hookRoot, {
      name: 'Synthetic outbound HTTPS boundary', endpointUrl: path, eventTypes: ['task.created'],
    }), 201, 'create outbound boundary webhook'));
  }
  await expectStatus(leader.post(`/api/work/sites/${a.siteId}/items`, {
    title: 'Synthetic outbound boundary event', description: 'Isolated receiver test',
  }), 201, 'create webhook event');
  let deliveries;
  for (let attempt = 0; attempt < 30; attempt++) {
    deliveries = await expectStatus(a.api.request(`${hookRoot}/deliveries`), 200, 'read outbound deliveries');
    if (subscriptions.every(subscription => deliveries.items.some(row => row.subscriptionId === subscription.id && row.attemptCount >= 1))) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const row = subscription => deliveries.items.find(value => value.subscriptionId === subscription.id);
  assert.equal(row(subscriptions[0])?.status, 'succeeded', 'Ignored large webhook body changed acknowledgement');
  assert.equal(row(subscriptions[0])?.lastHttpStatus, 200);
  assert.equal(row(subscriptions[1])?.status, 'retry', 'Webhook redirect was treated as delivered');
  assert.equal(row(subscriptions[1])?.lastHttpStatus, 302, 'Webhook redirect status contract changed');
  assert.equal(row(subscriptions[2])?.status, 'retry', 'Unapproved private webhook was delivered');
  assert.equal(row(subscriptions[2])?.lastHttpStatus, null, 'Unapproved private receiver was contacted');
  const canary = commandOutput('docker', ['compose', '-f', composeFile, '-p', project, 'exec', '-T', 'tls',
    'cat', '/var/log/nginx/outbound-canary.log']);
  assert.equal(canary.trim(), '', 'An outbound redirect/private-address attack reached the canary');
  for (const subscription of subscriptions) await expectStatus(a.api.request(`${hookRoot}/${subscription.id}`, 'DELETE'), 204, 'disable synthetic subscription');
  process.stdout.write(JSON.stringify({ outboundIntegrationBoundaries: 'passed',
    federationOversizedAndOperationLimit: 'passed', federationRedirectAndPrivateOrigin: 'passed',
    webhookLargeBodyIgnored: 'passed', webhookRedirectStatusPreserved: 'passed',
    webhookPrivateOriginRejected: 'passed', outboundCanaryRequests: 0 }) + '\n');
}

async function runWorkActivityPair() {
  const a = await setup('https://localhost:18443', 'a');
  const b = await setup('https://localhost:18444', 'b');
  const aPeer = `/api/platform/federation/peers/${b.instanceId}`;
  const bPeer = `/api/platform/federation/peers/${a.instanceId}`;
  const discoveredB = await expectStatus(a.api.post('/api/platform/federation/peers/discover', {
    baseUrl: 'https://tls:444',
  }), 200, 'discover retention receiver');
  const discoveredA = await expectStatus(b.api.post('/api/platform/federation/peers/discover', {
    baseUrl: 'https://tls:443',
  }), 200, 'discover retention sender');
  await expectStatus(a.api.post('/api/platform/federation/peers', {
    instanceId: b.instanceId, name: 'Retention B', baseUrl: discoveredB.baseUrl,
    fingerprint: discoveredB.fingerprint,
  }), 201, 'approve retention receiver');
  await expectStatus(b.api.post('/api/platform/federation/peers', {
    instanceId: a.instanceId, name: 'Retention A', baseUrl: discoveredA.baseUrl,
    fingerprint: discoveredA.fingerprint,
  }), 201, 'approve retention sender');
  await expectStatus(a.api.post(`${aPeer}/probe`, {}), 200, 'probe retention receiver');
  await expectStatus(b.api.post(`${bPeer}/probe`, {}), 200, 'probe retention sender');
  await expectStatus(a.api.post(`${aPeer}/catalog/sync`, {}), 200, 'sync retention receiver');
  await expectStatus(b.api.post(`${bPeer}/catalog/sync`, {}), 200, 'sync retention sender');
  await expectStatus(a.api.put('/api/platform/federation/routing', { enabled: true }),
    200, 'enable retention sender routing');
  await expectStatus(b.api.put('/api/platform/federation/routing', { enabled: true }),
    200, 'enable retention receiver routing');

  const leaderA = await makeSiteLeader(a, 'https://localhost:18443');
  const leaderB = await makeSiteLeader(b, 'https://localhost:18444');
  const returned = await assertQueuedOutboundDelivery(a, b, leaderA);
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM domain_events
    WHERE activity_type = 'assignment.sent' AND source_message_id = '${returned.originalMessageId}'`), '1',
    'Signed delivery retry duplicated the common activity fact');
  assert.equal(sqlValue('postgres-b', `SELECT COUNT(*) FROM domain_events
    WHERE activity_type = 'assignment.received' AND source_message_id = '${returned.originalMessageId}'
      AND context_work_item_id = '${returned.counterpartId}' AND source = 'federated'`), '1',
    'Signed receive retry duplicated or lost the federated activity fact');
  await assertOperationalReturnPath(a, b, returned, leaderA, leaderB);
  await assertOperationalSideRequest(a, b, leaderA);
  await assertOperationalPlannedRequest(a, b, leaderA);
  const cancelled = await assertQueuedOutboundDelivery(a, b, leaderA);
  await assertQueuedCancellation(a, b, cancelled, null, false, leaderA);
  process.stdout.write(JSON.stringify({ operationalWorkActivity: 'passed',
    signedReceiptAndRetry: 'passed', activityFactDeduplication: 'passed',
    progressAndOfficialAnswer: 'passed', privateLearningBoundary: 'passed',
    sideAndPlannedRequests: 'passed', cancellation: 'passed' }) + '\n');
}

async function runPair() {
  const a = await setup('https://localhost:18443', 'a');
  const b = await setup('https://localhost:18444', 'b');
  sql('postgres-a', `DO $$ BEGIN
    IF (SELECT is_nullable FROM information_schema.columns
        WHERE table_name = 'work_items' AND column_name = 'created_by_person_id') <> 'YES'
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_work_items_external_creator')
    THEN RAISE EXCEPTION 'external work creator migration is incomplete'; END IF;
  END; $$`);
  sql('postgres-a', `DO $$ BEGIN
    IF (SELECT is_nullable FROM information_schema.columns
        WHERE table_name = 'audit_events' AND column_name = 'actor_person_id') <> 'YES'
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CK_audit_events_actor_origin')
    THEN RAISE EXCEPTION 'federated audit actor migration is incomplete'; END IF;
  END; $$`);
  sql('postgres-a', `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_name = 'federation_inbound_receipts')
    OR NOT EXISTS (SELECT 1 FROM pg_indexes
        WHERE tablename = 'federation_inbound_receipts'
          AND indexname = 'IX_federation_inbound_receipts_local_work_item_id')
    THEN RAISE EXCEPTION 'inbound receipt migration is incomplete'; END IF;
  END; $$`);
  const leaderA = await makeSiteLeader(a, 'https://localhost:18443');
  const leaderB = await makeSiteLeader(b, 'https://localhost:18444');
  await expectStatus(a.api.put('/api/platform/classifications/settings', {
    enabled: true,
  }), 204, 'enable classifications on sender');
  await assertFederatedAuditActor(leaderA, a.siteId, b.instanceId, b.siteId);
  assert.notEqual(a.instanceId, b.instanceId);
  const syntheticPeer = await assertProbeReplayRejected(b);
  const aPeer = `/api/platform/federation/peers/${b.instanceId}`;
  const bPeer = `/api/platform/federation/peers/${a.instanceId}`;
  const discoveredB = await expectStatus(a.api.post('/api/platform/federation/peers/discover', {
    baseUrl: 'https://tls:444',
  }), 200, 'discover signed identity B');
  assert.equal(discoveredB.instanceId, b.instanceId);
  const discoveredA = await expectStatus(b.api.post('/api/platform/federation/peers/discover', {
    baseUrl: 'https://tls:443',
  }), 200, 'discover signed identity A');
  assert.equal(discoveredA.instanceId, a.instanceId);
  await expectStatus(a.api.post('/api/platform/federation/peers', {
    instanceId: discoveredB.instanceId, name: 'Synthetic B', baseUrl: discoveredB.baseUrl,
    fingerprint: '0'.repeat(64),
  }), 409, 'reject changed discovered fingerprint');
  await expectStatus(a.api.post('/api/platform/federation/peers', {
    instanceId: discoveredB.instanceId, name: 'Synthetic B', baseUrl: discoveredB.baseUrl,
    fingerprint: discoveredB.fingerprint,
  }), 201, 'approve B');
  await expectStatus(b.api.post('/api/platform/federation/peers', {
    instanceId: discoveredA.instanceId, name: 'Synthetic A', baseUrl: discoveredA.baseUrl,
    fingerprint: discoveredA.fingerprint,
  }), 201, 'approve A');
  await expectStatus(a.api.post(`${aPeer}/probe`, {}), 200, 'probe A to B');
  await expectStatus(b.api.post(`${bPeer}/probe`, {}), 200, 'probe B to A');
  await expectStatus(a.api.put(`${aPeer}/sites/${a.siteId}`, { isActive: true }), 200, 'publish A');
  await expectStatus(b.api.put(`${bPeer}/sites/${b.siteId}`, { isActive: true }), 200, 'publish B');
  await expectStatus(a.api.post(`${aPeer}/catalog/sync`, {}), 200, 'sync A');
  await expectStatus(b.api.post(`${bPeer}/catalog/sync`, {}), 200, 'sync B');
  const aCatalog = await expectStatus(a.api.request(`${aPeer}/catalog`), 200, 'read A catalog');
  assert.ok(aCatalog.some(site => site.siteId === b.siteId && site.isActive));
  const bCatalog = await expectStatus(b.api.request(`${bPeer}/catalog`), 200, 'read B catalog');
  assert.ok(bCatalog.some(site => site.siteId === a.siteId && site.isActive));
  await assertNoRemoteRecipient(leaderA, a.siteId, b.siteId);
  const outbound = `${aPeer}/grants/outbound/${a.siteId}/${b.siteId}`;
  const inbound = `${bPeer}/grants/inbound/${b.siteId}/${a.siteId}`;
  await expectStatus(a.api.put(outbound, { isActive: true }), 200, 'outbound A');
  await expectStatus(b.api.put(inbound, { isActive: true }), 200, 'inbound B');
  const verify = `${outbound}/verify`;
  const approved = await expectStatus(a.api.post(verify, {}), 200, 'reciprocal check');
  assert.equal(approved.reciprocal, true);
  assert.equal(approved.routable, false);
  await expectStatus(b.api.put(inbound, { isActive: false }), 200, 'revoke inbound B');
  const revoked = await expectStatus(a.api.post(verify, {}), 200, 'revoked check');
  assert.equal(revoked.reciprocal, false);
  assert.equal(revoked.routable, false);
  await expectStatus(b.api.put(inbound, { isActive: true }), 200, 'restore inbound B explicitly');
  assert.equal((await expectStatus(a.api.post(verify, {}), 200, 'restored check')).reciprocal, true);
  const disabledA = await expectStatus(a.api.request('/api/platform/federation/routing'),
    200, 'read disabled routing A');
  assert.equal(disabledA.enabled, false);
  assert.equal(disabledA.readyToEnable, true);
  const enabledA = await expectStatus(a.api.put('/api/platform/federation/routing', { enabled: true }),
    200, 'enable routing A through platform API');
  const enabledB = await expectStatus(b.api.put('/api/platform/federation/routing', { enabled: true }),
    200, 'enable routing B through platform API');
  assert.equal(enabledA.enabled, true);
  assert.equal(enabledB.enabled, true);
  assert.equal((await expectStatus(a.api.post(verify, {}), 200,
    'routable reciprocal check')).routable, true);
  assert.equal(sqlValue('postgres-a', `SELECT COUNT(*) FROM audit_events
    WHERE event_type = 'federation-routing.enabled'`), '1');
  await assertAutomaticKeyRotation(a, b);
  await assertMixedVersionUpgradeDowngrade(a, b, aPeer, bPeer);
  await assertSignedWorkReceive(b, syntheticPeer);
  const deliveredWork = await assertQueuedOutboundDelivery(a, b, leaderA);
  await assertEntitlementLossStopsOperationalRouting(a, b, leaderA);
  await assertOperationalSideRequest(a, b, leaderA);
  await assertOperationalPlannedRequest(a, b, leaderA);
  await assertQueuedProgress(a, b, deliveredWork);
  await assertQueuedOfficialAnswer(a, b, deliveredWork, outbound, leaderA, leaderB);
  await assertOperationalDeliveryControls(a, b, deliveredWork);
  assert.equal(sqlValue('postgres-a', `SELECT remote_progress_status FROM federation_work_links
    WHERE local_work_item_id = '${deliveredWork.originWorkItemId}'`), 'answered');
  const cancelledWork = await assertQueuedOutboundDelivery(a, b);
  await assertQueuedCancellation(a, b, cancelledWork, outbound);
  const operationalReturnWork = await assertQueuedOutboundDelivery(a, b, leaderA);
  await assertOperationalReturnPath(a, b, operationalReturnWork, leaderA, leaderB);
  await pauseForBrowserInspection(a, b, leaderA, leaderB, operationalReturnWork);
  const operationalCancellationWork = await assertQueuedOutboundDelivery(a, b, leaderA);
  await assertQueuedCancellation(a, b, operationalCancellationWork, outbound, true, leaderA);
  const answerCancellationRaceWork = await assertQueuedOutboundDelivery(a, b);
  await assertAnswerCancellationRace(a, b, answerCancellationRaceWork);
  await assertRevocationSendRace(a, b, inbound);
  await assertSiteMoveSendRace(a, b, aPeer, bPeer, outbound, inbound);
  const movedDestinationWork = await assertQueuedOutboundDelivery(a, b);
  const cancelledAfterMove = await assertQueuedOutboundDelivery(a, b);
  await assertReplyAfterDestinationSiteMove(a, b, movedDestinationWork, cancelledAfterMove, leaderA,
    leaderB, aPeer, bPeer, outbound, inbound);
  const bothMovedWork = await assertQueuedOutboundDelivery(a, b);
  await assertReplyAfterBothSitesMove(a, b, bothMovedWork, leaderA, leaderB,
    aPeer, bPeer, outbound, inbound);
  const outageWork = await assertQueuedOutboundDelivery(a, b);
  await assertQueuedAnswerSurvivesOutageAndMove(a, b, outageWork, leaderA, leaderB,
    aPeer, bPeer, outbound, inbound);
  const movedWork = await assertQueuedOutboundDelivery(a, b);
  await assertReplyAfterOriginSiteMove(a, b, movedWork, leaderA, leaderB, bPeer, outbound);

  const renamed = 'Synthetic Root B Renamed';
  await expectStatus(b.api.put(`/api/sites/${b.siteId}`, {
    name: renamed, parentOrganizationUnitId: null, isActive: true, overviewDesign: 'classic',
  }), 200, 'rename B');
  await expectStatus(a.api.post(`${aPeer}/catalog/sync`, {}), 200, 'sync renamed B');
  const renamedCatalog = await expectStatus(a.api.request(`${aPeer}/catalog`), 200, 'read renamed B');
  const renamedSnapshot = renamedCatalog.find(site => site.siteId === b.siteId);
  assert.equal(renamedSnapshot.name, renamed);
  assert.ok(renamedSnapshot.catalogRevision > aCatalog.find(site => site.siteId === b.siteId).catalogRevision);
  const archivedAfterRename = await expectStatus(leaderA.request(
    `/api/work/sites/${a.siteId}/reports`), 200, 'sender report after remote site rename');
  assert.equal(archivedAfterRename.reports.find(row => row.id === deliveredWork.originWorkItemId)?.siteName,
    'Synthetic Root b', 'Historical report header changed after a remote site rename');

  await expectStatus(b.api.put(`${bPeer}/sites/${b.siteId}`, { isActive: false }), 200, 'unpublish B');
  await expectStatus(a.api.post(`${aPeer}/catalog/sync`, {}), 200, 'sync revoked B');
  const unpublished = await expectStatus(a.api.request(`${aPeer}/catalog`), 200, 'read revoked B');
  assert.equal(unpublished.find(site => site.siteId === b.siteId).isActive, false);
  await expectStatus(a.api.post(verify, {}), 409, 'inactive remote grant check');
  await expectStatus(b.api.put(`${bPeer}/sites/${b.siteId}`, { isActive: true }), 200, 'republish B');
  await expectStatus(a.api.post(`${aPeer}/catalog/sync`, {}), 200, 'sync republished B');
  const grantsAfterRepublish = await expectStatus(a.api.request(`${aPeer}/grants`), 200, 'read suspended grant');
  assert.equal(grantsAfterRepublish.find(grant => grant.localSiteId === a.siteId &&
    grant.remoteSiteId === b.siteId && grant.direction === 'outbound').isActive, false,
  'Republishing a site must not silently reactivate an old grant');
  await assertNoRemoteRecipient(leaderA, a.siteId, b.siteId);
  await assertLostKeyRecovery(a, b, aPeer, outbound);
  await assertCatalogDefenses(a, b, aPeer);
  await assertPopulatedUpgrade(a);
  process.stdout.write(JSON.stringify({ federationPair: 'passed', distinctInstances: true,
    bilateralSignedDiscovery: true, mutualProof: true, catalogExchange: true,
    reciprocalGrant: true, remoteRevocation: true,
    probeReplayRejected: true, concurrentReplicaReplayRejected: true,
    siteRename: true, publicationRevocation: true, destinationSiteMove: true,
    cancellationAfterDestinationMove: true, bothSitesMove: true,
    answerAfterOutageAndMove: true,
    noImplicitGrantReactivation: true,
    noUnauthorizedRemoteRecipient: true, operationalRecipientAndCreation: true,
    entitlementLossStopsOperationalRouting: true,
    operationalSideRequest: true, operationalPlannedRequest: true,
    operationalProgressAnswerAndCancellation: true,
    answerCancellationRaceSerialized: true,
    revocationSendRaceBlocked: true,
    siteMoveSendRaceBlocked: true,
    operationalDeliveryControls: true,
    liveCapabilityNegotiation: true,
    realMixedVersionUpgradeDowngrade: true,
    automaticKeyRotation: true,
    controlledLostKeyRecovery: true,
    classifiedFederatedTasksPreserved: true,
    classifiedFederatedReportsPreserved: true,
    staleCatalogRejected: true, omittedSiteSuspended: true,
    populatedSchemaUpgrade: true, signedWorkReceive: true,
    signedWorkIsolation: true, concurrentWorkDeduplicated: true,
    queuedOutboundDelivery: true, signedReceiptVerified: true, deliveryRetryIdempotent: true,
    officialAnswerReturned: true, answerAfterGrantRevocation: true,
    coarseProgressReturned: true, staleProgressDoesNotRevert: true,
    cancellationAcknowledged: true, cancelledRecipientRetained: true,
    reportsArchivedAtBothSites: true, remoteReportHeaderStable: true,
    replyAfterOriginSiteMoves: true, noImplicitPublicationAfterMove: true,
    routable: true }) + '\n');
}

try {
  command('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', join(temporary, 'server.key'), '-out', join(temporary, 'server.pem'),
    '-subj', '/CN=tls', '-addext', 'subjectAltName=DNS:tls,DNS:localhost',
    '-addext', 'basicConstraints=critical,CA:TRUE'], { stdio: 'ignore' });
  writeFileSync(join(temporary, 'outbound-large.json'), JSON.stringify({ value: 'x'.repeat(1_000_001) }));
  writeFileSync(join(temporary, 'outbound-small.json'), JSON.stringify({ value: 'x'.repeat(16_385) }));
  copyFileSync(join(temporary, 'server.pem'), join(temporary, 'ca.pem'));
  setDefaultCACertificates([...getCACertificates('default'), readFileSync(join(temporary, 'ca.pem'), 'utf8')]);
  if (process.argv.includes('--no-build')) {
    if (!env.FYLKREN_E2E_API_IMAGE || !env.FYLKREN_E2E_WEB_IMAGE) throw new Error('Set candidate API and web image IDs for --no-build.');
    command('docker', ['tag', env.FYLKREN_E2E_API_IMAGE, 'fylkren-federation-pair-test-api:local']);
    command('docker', ['tag', env.FYLKREN_E2E_WEB_IMAGE, 'fylkren-federation-pair-test-web:local']);
  } else compose(['build', 'api-a', 'web-a']);
  try
  {
    compose(['up', '-d', '--no-build', '--wait']);
    if (outboundOnly) await runOutboundPair();
    else if (operationalOnly) await runWorkActivityPair();
    else if (loadOnly) await runLoadPair();
    else if (messageBoundaryOnly) await runMessageBoundaryPair();
    else if (restoreOnly) await runRestorePair();
    else if (retentionOnly) await runRetentionPair();
    else await runProductionBoundaryPair();
  }
  catch (error)
  {
    try { compose(['logs', '--tail', '100', 'api-a', 'api-b']); }
    catch { /* Preserve the original failure. */ }
    throw error;
  }
} finally {
  try { compose(['down', '-v', '--remove-orphans']); }
  finally { rmSync(temporary, { recursive: true, force: true }); }
}
