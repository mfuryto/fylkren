import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Fresh synthetic installations only; keep generated credentials and PDFs out of Git.
const project = `fylkren-release-browser-${randomBytes(4).toString('hex')}`;
const browser = `${project}-chromium`;
const temporary = mkdtempSync(join(tmpdir(), 'fylkren-release-browser-'));
const fixture = JSON.parse(readFileSync('tools/e2e/license-fixture.json', 'utf8'));
const env = { ...process.env, FYLKREN_DB_PASSWORD: 'synthetic-release-browser-only',
  FYLKREN_HTTP_PORT: '127.0.0.1:18082', FYLKREN_PUBLIC_URL: 'http://localhost:18082', FYLKREN_MFA_ENABLED: 'false',
  FYLKREN_LICENSE_PUBLIC_KEY_SPKI: fixture.publicKeySpki, FYLKREN_BROWSER_TARGET_URL: 'http://localhost:18082/',
  FYLKREN_BROWSER_CDP_URL: 'http://127.0.0.1:19224', FYLKREN_BROWSER_REPORT_PDF: 'output/pdf/release-classified-report.pdf', FYLKREN_BROWSER_LICENSE_PATH: '/work/tools/e2e/license-upload-fixture.json',
};
const files = ['-f', 'compose.yaml', '-f', 'tools/e2e/browser-smtp.compose.yaml'];
const originalEnvironment = existsSync('.env') ? readFileSync('.env') : null;
if (originalEnvironment === null) writeFileSync('.env', 'FYLKREN_DB_PASSWORD=synthetic-release-browser-only\n', { mode: 0o600 });
mkdirSync('output/pdf', { recursive: true });
for (const tool of ['pdfinfo', 'pdftotext']) writeFileSync(join(temporary, tool),
  `#!/bin/sh\nexec docker exec ${browser} ${tool} "$@"\n`, { mode: 0o700 });
env.PATH = `${temporary}:${process.env.PATH}`;
function command(program, args) {
  const result = spawnSync(program, args, { env, stdio: 'inherit', timeout: 600_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} failed with ${result.status}`);
}
function compose(args) { command('docker', ['compose', ...files, '-p', project, ...args]); }
async function start() {
  compose(['up', '-d', '--build', '--wait']);
  compose(['exec', '-T', 'postgres', 'psql', '-U', 'fylkren', '-d', 'fylkren', '-v', 'ON_ERROR_STOP=1', '-c',
    `UPDATE instance_identity SET instance_id = '${fixture.instanceId}' WHERE key = 1`]);
  command('docker', ['run', '--rm', '-d', '--name', browser, '--network', 'host', '--shm-size=256m',
    '-v', `${resolve('.') }:/work:ro`, '-v', `${resolve('output/pdf')}:/work/output/pdf:rw`, '-w', '/work',
    'node:24-alpine', 'sh', '-c', 'apk add --no-cache chromium font-noto-emoji poppler-utils >/tmp/install.log 2>&1 && chromium --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port=19224 --remote-allow-origins=* about:blank']);
  for (let attempt = 0; attempt < 120; attempt++) {
    try { if ((await fetch(`${env.FYLKREN_BROWSER_CDP_URL}/json/version`, { signal: AbortSignal.timeout(5000) })).ok) return; } catch { /* Browser packages are still installing. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Chromium did not become ready');
}
function stop() {
  spawnSync('docker', ['stop', browser], { env, stdio: 'ignore' });
  compose(['down', '-v', '--remove-orphans']);
}
try {
  const authOnly = process.argv.includes('--totp-only') || process.argv.includes('--webauthn-only');
  if (authOnly) env.FYLKREN_MFA_ENABLED = 'true';
  env.FYLKREN_WEBAUTHN_ENABLED = 'true';
  env.FYLKREN_WEBAUTHN_RP_ID = 'localhost';
  env.FYLKREN_WEBAUTHN_ORIGIN = env.FYLKREN_BROWSER_TARGET_URL.replace(/\/$/, '');
  await start();
  if (authOnly) {
    command(process.execPath, [process.argv.includes('--webauthn-only') ? 'tools/e2e/webauthn-security.mjs' : 'tools/e2e/totp-security.mjs']);
  } else if (process.argv.includes('--community-only')) {
    command(process.execPath, ['tools/e2e/community-browser-smoke.mjs', '--task-flow', '--smtp', '--keyboard', '--classified-pdf']);
  } else {
    command(process.execPath, ['tools/e2e/community-browser-smoke.mjs', '--task-flow', '--smtp', '--keyboard', '--classified-pdf']);
    stop();
    await start();
    command(process.execPath, ['tools/e2e/community-browser-smoke.mjs', '--enterprise']);
    stop();
    env.FYLKREN_MFA_ENABLED = 'true';
    await start();
    command(process.execPath, ['tools/e2e/totp-security.mjs']);
    stop();
    await start();
    command(process.execPath, ['tools/e2e/webauthn-security.mjs']);
  }
} finally {
  try { stop(); }
  finally {
    rmSync(temporary, { recursive: true, force: true });
    if (originalEnvironment === null) rmSync('.env', { force: true });
  }
}
