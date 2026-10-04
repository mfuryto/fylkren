import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';
assert.equal(process.env.FYLKREN_COMPOSE_PROJECT, 'fylkren-edition-e2e');
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual', ...options });
  const text = await response.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, setCookies: response.headers.getSetCookie() };
}
async function session(cookie) {
  const response = await request('/api/session', { headers: { Cookie: `Fylkren.Session=${cookie}` } });
  assert.equal(response.status, 200); return response.body.authenticated;
}

const suffix = randomBytes(6).toString('hex'); const password = `A7!${randomBytes(18).toString('base64url')}#`;
const bootstrap = await request('/api/bootstrap/platform-manager', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: `timeout-${suffix}`, password, displayName: 'Synthetic Timeout Manager', email: `timeout-${suffix}@example.invalid` }),
});
assert.equal(bootstrap.status, 201, JSON.stringify(bootstrap.body));
const header = bootstrap.setCookies.find((value) => value.startsWith('Fylkren.Session='));
assert.ok(header); const cookie = header.split(';', 1)[0].slice('Fylkren.Session='.length);

const keyDirectory = mkdtempSync(join(tmpdir(), 'fylkren-session-keys-'));
try {
  execFileSync('docker', ['cp', 'fylkren-edition-e2e-api-1:/var/lib/fylkren/keys/.', keyDirectory]);
  const output = execFileSync('dotnet', ['run', '--project', 'tools/session-ticket-tool/session-ticket-tool.csproj',
    '--configuration', 'Release', '--verbosity', 'quiet', '--', cookie, keyDirectory], { encoding: 'utf8' });
  const tickets = JSON.parse(output.trim().split('\n').at(-1));
  assert.equal(await session(tickets.inactivityBefore), true);
  assert.equal(await session(tickets.inactivityAfter), false);
  assert.equal(await session(tickets.absoluteBefore), true);
  assert.equal(await session(tickets.absoluteAfter), false);
} finally { rmSync(keyDirectory, { recursive: true, force: true }); }

process.stdout.write(`${JSON.stringify({ sessionTimeoutRuntime: 'passed', inactivityHours: 1, absoluteHours: 12,
  inactivityBeforeAccepted: true, inactivityAfterRejected: true,
  absoluteBeforeAccepted: true, absoluteAfterRejected: true })}\n`);
