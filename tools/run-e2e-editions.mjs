import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const project = 'fylkren-edition-e2e';
const fixture = JSON.parse(readFileSync(new URL('./e2e/license-fixture.json', import.meta.url), 'utf8'));
const env = {
  ...process.env,
  FYLKREN_DB_PASSWORD: 'synthetic-e2e-only',
  FYLKREN_HTTP_PORT: '127.0.0.1:18081',
  FYLKREN_PUBLIC_URL: 'http://localhost:18081',
  FYLKREN_MFA_ENABLED: 'false',
  FYLKREN_LICENSE_PUBLIC_KEY_SPKI: fixture.publicKeySpki,
  FYLKREN_E2E_BASE_URL: 'http://localhost:18081',
  FYLKREN_COMPOSE_PROJECT: project,
};
const backupRoot = mkdtempSync(join(tmpdir(), 'fylkren-backup-e2e-'));
const environmentPath = '.env';
const savedEnvironment = existsSync(environmentPath) ? readFileSync(environmentPath) : null;
if (savedEnvironment === null) writeFileSync(environmentPath, 'FYLKREN_DB_PASSWORD=synthetic-e2e-only\n', { mode: 0o600 });
const backupMarkers = ['runtime/last-backup.timestamp', 'runtime/last-backup.json'];
const savedMarkers = new Map(backupMarkers.map(path => [path, existsSync(path) ? readFileSync(path) : null]));
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { env, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}
try {
  run('docker', ['compose', '-p', project, 'up', '-d', '--build', '--wait']);
  // A disposable, empty database only: bind the public test fixture to a reserved identity.
  run('docker', ['compose', '-p', project, 'exec', '-T', 'postgres', 'psql', '-U', 'fylkren', '-d', 'fylkren',
    '-c', `UPDATE instance_identity SET instance_id = '${fixture.instanceId}' WHERE key = 1`]);
  run('docker', ['compose', '-p', project, 'exec', '-T', 'api', 'sh', '-c', 'test ! -e /var/run/docker.sock']);
  run('./deploy/compose/backup.sh', [backupRoot]);
  const backupSets = readdirSync(backupRoot).filter(name => name.startsWith('fylkren-'));
  if (backupSets.length !== 1) throw new Error(`Expected one backup set, received ${backupSets.length}`);
  const backupSet = join(backupRoot, backupSets[0]);
  for (const artifact of ['fylkren.dump', 'env.backup', 'data-protection-keys.tar.gz', 'manifest.json', 'SHA256SUMS', 'COMPLETE']) {
    if (!statSync(join(backupSet, artifact)).isFile()) throw new Error(`Missing backup artifact: ${artifact}`);
  }
  if (existsSync(join(backupSet, 'INCOMPLETE'))) throw new Error('Completed backup retained its INCOMPLETE marker');
  run('sha256sum', ['-c', 'SHA256SUMS'], { cwd: backupSet });
  run(process.execPath, ['tools/test-e2e-local.mjs']);
} finally {
  try {
    run('docker', ['compose', '-p', project, 'down', '-v']);
  } finally {
    rmSync(backupRoot, { recursive: true, force: true });
    if (savedEnvironment === null) rmSync(environmentPath, { force: true });
    for (const [path, content] of savedMarkers) {
      if (content === null) rmSync(path, { force: true });
      else writeFileSync(path, content);
    }
  }
}
