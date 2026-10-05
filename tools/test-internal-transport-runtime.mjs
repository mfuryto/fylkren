import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';

const project = process.env.FYLKREN_INTERNAL_TLS_PROJECT;
const password = process.env.FYLKREN_INTERNAL_TLS_DB_PASSWORD;
const baseUrl = process.env.FYLKREN_INTERNAL_TLS_BASE_URL;
assert.ok(project && password && baseUrl,
  'Set FYLKREN_INTERNAL_TLS_PROJECT, FYLKREN_INTERNAL_TLS_DB_PASSWORD and FYLKREN_INTERNAL_TLS_BASE_URL.');

const compose = (...args) => execFileSync('docker', ['compose', '-p', project, ...args], { encoding: 'utf8' }).trim();
const composeResult = (...args) => spawnSync('docker', ['compose', '-p', project, ...args], { encoding: 'utf8' });

const health = await fetch(`${baseUrl}/health`);
assert.equal(health.status, 200);
assert.equal(await health.text(), 'Healthy');

assert.notEqual(composeResult('exec', '-T', 'api', 'curl', '--fail', '--silent', 'http://api:8443/health').status, 0,
  'The API unexpectedly accepted plaintext HTTP on its internal endpoint.');
assert.notEqual(composeResult('exec', '-T', 'api', 'curl', '--fail', '--silent', '--cacert',
  '/run/fylkren-trust/ca.crt', 'https://127.0.0.1:8443/health').status, 0,
  'The API certificate unexpectedly validated for the wrong host.');

const database = `host=postgres port=5432 dbname=fylkren user=fylkren password=${password}`;
assert.notEqual(composeResult('exec', '-T', 'postgres', 'psql', `${database} sslmode=disable`, '-c', 'select 1').status, 0,
  'PostgreSQL unexpectedly accepted a plaintext network connection.');
assert.equal(composeResult('exec', '-T', 'postgres', 'psql',
  `${database} sslmode=verify-full sslrootcert=/run/fylkren-trust/ca.crt`, '-c', 'select 1').status, 0,
  'PostgreSQL verified TLS connection failed.');
assert.notEqual(composeResult('exec', '-T', 'postgres', 'psql',
  `host=127.0.0.1 hostaddr=127.0.0.1 port=5432 dbname=fylkren user=fylkren password=${password} sslmode=verify-full sslrootcert=/run/fylkren-trust/ca.crt`,
  '-c', 'select 1').status, 0, 'PostgreSQL certificate unexpectedly validated for the wrong host.');

const negotiated = compose('exec', '-T', 'postgres', 'psql', '-U', 'fylkren', '-d', 'fylkren', '-Atc',
  "select version || '|' || cipher from pg_stat_ssl where ssl and pid in (select pid from pg_stat_activity where datname='fylkren' and client_addr is not null) limit 1");
assert.match(negotiated, /^TLSv1\.[23]\|.+/);

const mounts = service => {
  const id = compose('ps', '-q', service);
  assert.ok(id, `${service} container is not running.`);
  return execFileSync('docker', ['inspect', '--format', '{{range .Mounts}}{{println .Name "|" .Destination}}{{end}}', id], { encoding: 'utf8' });
};
for (const service of ['web', 'api', 'postgres'])
  assert.doesNotMatch(mounts(service), /fylkren-tls-ca-private/, `${service} can read the internal CA private key.`);
assert.doesNotMatch(mounts('web'), /fylkren-tls-api/, 'The gateway can read the API private key.');
assert.doesNotMatch(mounts('api'), /fylkren-tls-postgres/, 'The API can read the PostgreSQL private key.');

console.log(JSON.stringify({
  internalTransportTls: 'passed',
  gatewayToApi: 'verified-hostname',
  apiToPostgres: negotiated,
  plaintextFallbacksAccepted: 0,
  wrongHostnameAccepted: 0,
  caPrivateKeyMountedInRuntimeServices: false,
}));
