import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const project = process.env.FYLKREN_COMPOSE_PROJECT ?? 'fylkren-edition-e2e';
const forwardedHost = ['--header', 'Host: localhost:18081'];

function curl(path, args = []) {
  const result = spawnSync('docker', ['compose', '-p', project, 'exec', '-T', 'api', 'curl',
    '--silent', '--show-error', '--include', ...forwardedHost, ...args, `http://localhost:8080${path}`],
  { encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  const [headers, ...body] = result.stdout.split(/\r?\n\r?\n/);
  const status = Number(/^HTTP\/\S+\s+(\d+)/m.exec(headers)?.[1]);
  const values = Object.fromEntries([...headers.matchAll(/^([^:\r\n]+):\s*(.+)$/gm)]
    .map(match => [match[1].toLowerCase(), match[2].trim()]));
  return { status, headers: values, body: body.join('\n\n') };
}

for (const path of ['/', '/tasks?view=active', '/manual/path']) {
  const response = curl(path);
  assert.equal(response.status, 307, `${path}: browser route was not upgraded`);
  assert.equal(response.headers.location, `https://localhost:18081${path}`);
  assert.equal(response.headers['set-cookie'], undefined, `${path}: HTTP redirect issued a cookie`);
}

const serviceCases = [
  ['/api/configuration/public', []],
  ['/api/session', ['--request', 'POST', '--header', 'Content-Type: application/json',
    '--data', '{"username":"plaintext-probe","password":"must-not-be-processed"}']],
  ['/api/v1/administration/sites', ['--header', 'Authorization: Bearer plaintext-probe']],
  ['/health', []],
  ['/signin-oidc', ['--request', 'POST', '--header', 'Content-Type: application/x-www-form-urlencoded',
    '--data', 'code=plaintext-probe&state=plaintext-probe']],
];
for (const [path, args] of serviceCases) {
  const response = curl(path, args);
  assert.equal(response.status, 400, `${path}: plaintext service request returned ${response.status}`);
  assert.equal(response.headers.location, undefined, `${path}: plaintext service request was redirected`);
  assert.match(response.headers['content-type'] ?? '', /^application\/problem\+json;\s*charset=utf-8\b/i);
  assert.equal(response.headers['set-cookie'], undefined, `${path}: plaintext rejection issued a cookie`);
  assert.match(response.headers['cache-control'] ?? '', /no-store/i);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.doesNotMatch(response.body, /plaintext-probe|must-not-be-processed/,
    `${path}: plaintext request material was reflected`);
}

process.stdout.write(`${JSON.stringify({ httpUpgradeBoundary: 'passed', browserRedirectCases: 3,
  serviceFailureCases: serviceCases.length, browserStatus: 307, serviceStatus: 400,
  serviceRedirects: 0, plaintextCookies: 0 })}\n`);
