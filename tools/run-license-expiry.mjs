import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { machineCredential, signedMachineRequest } from './e2e/machine-auth.mjs';

const project = 'fylkren-license-expiry-e2e';
const base = 'http://localhost:18087';
const instanceId = randomUUID();
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicKeySpki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const env = {
  ...process.env,
  FYLKREN_DB_PASSWORD: 'synthetic-license-expiry-only',
  FYLKREN_HTTP_PORT: '127.0.0.1:18087',
  FYLKREN_PUBLIC_URL: base,
  FYLKREN_MFA_ENABLED: 'false',
  FYLKREN_MFA_REQUIRED: 'false',
  FYLKREN_LICENSE_PUBLIC_KEY_SPKI: publicKeySpki,
};

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
  return command('docker', ['compose', '-p', project, ...args], options);
}

function psql(sql) {
  return compose(['exec', '-T', 'postgres', 'psql', '-U', 'fylkren', '-d', 'fylkren', '-tA', '-v', 'ON_ERROR_STOP=1', '-c', sql]);
}

function envelope(expiresAt) {
  const payload = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    licenseId: randomUUID(),
    instanceId,
    customer: 'Synthetic live-expiry test',
    notBefore: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: expiresAt.toISOString(),
    entitlements: ['machine-api', 'webhooks', 'external-identity', 'instance-federation'],
  }));
  const signature = sign('sha256', payload, { key: privateKey, dsaEncoding: 'ieee-p1363' });
  assert.equal(signature.length, 64);
  return { payload: payload.toString('base64'), signature: signature.toString('base64') };
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
    post(path, body) {
      return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    },
    put(path, body) {
      return request(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    },
    async csrf() {
      const response = await request('/api/security/antiforgery');
      assert.equal(response.status, 200, JSON.stringify(response.body));
      csrfToken = response.body.token;
    },
  };
}

async function waitForExpiry(client, deadline) {
  while (Date.now() < deadline) {
    const configuration = await client.request('/api/configuration');
    if (configuration.status === 200 && configuration.body.edition === 'community') return configuration.body;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('The installed license did not cross to Community before the deadline.');
}

let started = false;
try {
  process.stdout.write('Building and starting the isolated live-expiry stack...\n');
  compose(['up', '-d', '--build', '--wait'], { stdio: 'inherit' });
  started = true;
  psql(`UPDATE instance_identity SET instance_id = '${instanceId}' WHERE key = 1`);

  const client = browserClient();
  const suffix = randomBytes(5).toString('hex');
  const username = `expiry-${suffix}`;
  const password = `V9!${randomBytes(24).toString('base64url')}#q`;
  const bootstrap = await client.post('/api/bootstrap/platform-manager', {
    username,
    displayName: 'Synthetic Expiry Manager',
    email: `${username}@example.invalid`,
    password,
  });
  assert.equal(bootstrap.status, 201, JSON.stringify(bootstrap.body));
  await client.csrf();

  const expiresAt = new Date(Date.now() + 25_000);
  const firstLicense = envelope(expiresAt);
  const activation = await client.post('/api/platform/license', firstLicense);
  assert.equal(activation.status, 200, JSON.stringify(activation.body));
  assert.equal(activation.body.status.edition, 'enterprise');
  assert.equal(activation.body.status.state, 'valid');
  const firstLicenseId = activation.body.status.licenseId;

  const sites = [];
  for (let index = 1; index <= 4; index++) {
    const created = await client.post('/api/sites/', { name: `Expiry Site ${index} ${suffix}`, overviewDesign: 'classic' });
    assert.equal(created.status, 201, `Site ${index}: ${JSON.stringify(created.body)}`);
    sites.push(created.body.id);
  }

  const machine = await client.post('/api/platform/api-clients/', {
    name: 'Live expiry machine client',
    scopes: ['sites:read'],
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  assert.equal(machine.status, 201, JSON.stringify(machine.body));
  const machineToken = machineCredential(machine.body);

  const webhook = await client.post(`/api/platform/webhooks/sites/${sites[0]}`, {
    name: 'Live expiry webhook',
    endpointUrl: 'https://example.invalid/fylkren-expiry',
    eventTypes: ['task.created'],
  });
  assert.equal(webhook.status, 201, JSON.stringify(webhook.body));

  const provider = await client.request('/api/platform/identity/providers/oidc');
  assert.equal(provider.status, 200, JSON.stringify(provider.body));
  const configuredProvider = await client.put('/api/platform/identity/providers/oidc', {
    enabled: false,
    clearSecret: false,
    configuration: {
      ...provider.body.configuration,
      authority: 'https://identity.example.invalid',
      clientId: 'live-expiry-client',
      secret: 'synthetic-live-expiry-secret',
    },
  });
  assert.equal(configuredProvider.status, 204, JSON.stringify(configuredProvider.body));

  const federationIdentity = await client.post('/api/platform/federation/identity', {});
  assert.equal(federationIdentity.status, 200, JSON.stringify(federationIdentity.body));

  const machineBeforeExpiry = await signedMachineRequest(base, machineToken, '/api/v1/administration/sites');
  assert.equal(machineBeforeExpiry.status, 200);

  process.stdout.write(`Enterprise active until ${expiresAt.toISOString()}; waiting for the real clock transition...\n`);
  const expiredConfiguration = await waitForExpiry(client, expiresAt.getTime() + 15_000);
  assert.deepEqual(expiredConfiguration.entitlements, []);

  const expiredStatus = await client.request('/api/platform/license');
  assert.equal(expiredStatus.status, 200, JSON.stringify(expiredStatus.body));
  assert.equal(expiredStatus.body.status.edition, 'community');
  assert.equal(expiredStatus.body.status.state, 'expired');
  assert.equal(expiredStatus.body.status.licenseId, firstLicenseId);

  const machineAfterExpiry = await signedMachineRequest(base, machineToken, '/api/v1/administration/sites');
  assert.equal(machineAfterExpiry.status, 403, 'Existing machine token must lose Enterprise API access immediately');

  const blockedMachine = await client.post('/api/platform/api-clients/', {
    name: 'Blocked after expiry',
    scopes: ['sites:read'],
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  assert.equal(blockedMachine.status, 403);

  const blockedWebhook = await client.post(`/api/platform/webhooks/sites/${sites[0]}`, {
    name: 'Blocked after expiry',
    endpointUrl: 'https://example.invalid/blocked',
    eventTypes: ['task.created'],
  });
  assert.equal(blockedWebhook.status, 403);

  const retainedProvider = await client.request('/api/platform/identity/providers/oidc');
  assert.equal(retainedProvider.status, 200);
  assert.equal(retainedProvider.body.hasSecret, true, 'Stored Enterprise identity configuration must be retained');
  assert.equal(retainedProvider.body.configuration.secret, null, 'Stored provider secret must not be returned');
  const blockedProvider = await client.put('/api/platform/identity/providers/oidc', {
    enabled: false,
    clearSecret: false,
    configuration: retainedProvider.body.configuration,
  });
  assert.equal(blockedProvider.status, 403);

  const blockedRotation = await client.post('/api/platform/federation/identity/rotation', {});
  assert.equal(blockedRotation.status, 403);
  const blockedInboundFederation = await fetch(`${base}/api/federation/v1/work`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(blockedInboundFederation.status, 403);

  const fifthSite = await client.post('/api/sites/', { name: `Blocked Site 5 ${suffix}`, overviewDesign: 'classic' });
  assert.equal(fifthSite.status, 409, JSON.stringify(fifthSite.body));
  assert.equal(fifthSite.body.code, 'community_site_limit');
  const retainedSites = await client.request('/api/sites');
  assert.equal(retainedSites.status, 200, JSON.stringify(retainedSites.body));
  assert.ok(retainedSites.body.length >= 4, 'Sites created under Enterprise must remain visible after expiry');

  const domainEventId = randomUUID();
  const resourceId = randomUUID();
  psql(`INSERT INTO domain_events (id,event_type,schema_version,occurred_at,site_id,actor_person_id,resource_type,resource_id,payload_json,webhooks_projected_at) VALUES ('${domainEventId}','task.created',1,NOW(),'${sites[0]}',NULL,'task','${resourceId}','{}'::jsonb,NULL)`);
  await new Promise(resolve => setTimeout(resolve, 12_000));
  assert.equal(psql(`SELECT COALESCE(webhooks_projected_at::text,'NULL') FROM domain_events WHERE id='${domainEventId}'`), 'NULL',
    'Webhook projection worker must stop while the entitlement is expired');

  const renewal = await client.post('/api/platform/license', envelope(new Date(Date.now() + 600_000)));
  assert.equal(renewal.status, 200, JSON.stringify(renewal.body));
  assert.equal(renewal.body.status.edition, 'enterprise');
  assert.equal(renewal.body.status.state, 'valid');

  const machineAfterRenewal = await signedMachineRequest(base, machineToken, '/api/v1/administration/sites');
  assert.equal(machineAfterRenewal.status, 200, 'Retained machine client must resume under a renewed entitlement');

  let projected = 'NULL';
  for (let attempt = 0; attempt < 30 && projected === 'NULL'; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    projected = psql(`SELECT COALESCE(webhooks_projected_at::text,'NULL') FROM domain_events WHERE id='${domainEventId}'`);
  }
  assert.notEqual(projected, 'NULL', 'Webhook projection worker must resume after renewal');

  const siteAfterRenewal = await client.post('/api/sites/', { name: `Renewed Site 5 ${suffix}`, overviewDesign: 'classic' });
  assert.equal(siteAfterRenewal.status, 201, JSON.stringify(siteAfterRenewal.body));

  process.stdout.write(`${JSON.stringify({
    liveLicenseExpiry: 'passed',
    immediateDowngrade: 'passed',
    enterpriseBoundaries: 'passed',
    retainedDataAndConfiguration: 'passed',
    webhookWorkerPauseAndResume: 'passed',
    renewalWithoutRestart: 'passed',
  }, null, 2)}\n`);
} finally {
  if (started) {
    try { compose(['down', '-v'], { stdio: 'inherit' }); }
    catch (error) { process.stderr.write(`Cleanup failed: ${error.message}\n`); }
  }
}
