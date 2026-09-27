import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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
};
function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}
try {
  run('docker', ['compose', '-p', project, 'up', '-d', '--build']);
  // A disposable, empty database only: bind the public test fixture to a reserved identity.
  run('docker', ['compose', '-p', project, 'exec', '-T', 'postgres', 'psql', '-U', 'fylkren', '-d', 'fylkren',
    '-c', `UPDATE instance_identity SET instance_id = '${fixture.instanceId}' WHERE key = 1`]);
  run(process.execPath, ['tools/test-e2e-local.mjs']);
} finally {
  run('docker', ['compose', '-p', project, 'down', '-v']);
}
