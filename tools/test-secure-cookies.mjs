import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const project = process.env.FYLKREN_COMPOSE_PROJECT ?? 'fylkren-edition-e2e';

function curl(args) {
  const result = spawnSync('docker', ['compose', '-p', project, 'exec', '-T', 'api', 'curl',
    '--silent', '--show-error', '--include', ...args], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `curl exited with ${result.status}`);
  const split = result.stdout.split(/\r?\n\r?\n/);
  const headerText = split.shift() ?? '';
  const status = Number(/^HTTP\/\S+\s+(\d+)/m.exec(headerText)?.[1]);
  const setCookies = [...headerText.matchAll(/^set-cookie:\s*(.+)$/gim)].map(match => match[1].trim());
  return { status, setCookies, body: split.join('\n\n') };
}

function assertHostCookie(value, name) {
  assert.ok(value, `${name} cookie was not issued`);
  assert.match(value, new RegExp(`^${name.replace('.', '\\.')}=`));
  assert.match(value, /;\s*path=\/(?:;|$)/i);
  assert.match(value, /;\s*secure(?:;|$)/i);
  assert.match(value, /;\s*httponly(?:;|$)/i);
  assert.match(value, /;\s*samesite=strict(?:;|$)/i);
  assert.doesNotMatch(value, /;\s*domain=/i);
}

const username = `cookie-${randomBytes(6).toString('hex')}`;
const password = `C7!${randomBytes(22).toString('base64url')}#s`;
const forwarded = ['--header', 'Host: localhost:18081', '--header', 'X-Forwarded-Proto: https'];
const bootstrap = curl([...forwarded, '--header', 'Content-Type: application/json', '--request', 'POST',
  '--data', JSON.stringify({ username, displayName: 'Synthetic Cookie Manager',
    email: `${username}@example.invalid`, password }),
  'http://localhost:8080/api/bootstrap/platform-manager']);
assert.equal(bootstrap.status, 201, bootstrap.body);
const session = bootstrap.setCookies.find(value => value.startsWith('__Host-Fylkren='));
assertHostCookie(session, '__Host-Fylkren');
assert.equal(bootstrap.setCookies.some(value => value.startsWith('Fylkren.Session=')), false);

const sessionPair = session.split(';', 1)[0];
const antiforgery = curl([...forwarded, '--header', `Cookie: ${sessionPair}`,
  'http://localhost:8080/api/security/antiforgery']);
assert.equal(antiforgery.status, 200, antiforgery.body);
const antiforgeryCookie = antiforgery.setCookies.find(value => value.startsWith('__Host-Fylkren.Antiforgery='));
assertHostCookie(antiforgeryCookie, '__Host-Fylkren.Antiforgery');
assert.equal(antiforgery.setCookies.some(value => value.startsWith('Fylkren.Antiforgery=')), false);

const plainHttp = curl(['--header', 'Host: localhost:18081', 'http://localhost:8080/api/session']);
assert.ok([307, 308].includes(plainHttp.status), `Plain HTTP returned ${plainHttp.status}`);
assert.equal(plainHttp.setCookies.length, 0, 'Plain HTTP response issued a cookie');

process.stdout.write(`${JSON.stringify({ secureHostCookies: 'passed', sessionCookie: '__Host-Fylkren',
  antiforgeryCookie: '__Host-Fylkren.Antiforgery', secure: true, hostOnly: true,
  pathRoot: true, plainHttpRedirectedWithoutCookie: true })}\n`);
