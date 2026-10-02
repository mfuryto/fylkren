import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const name = `fylkren-postgres-privilege-${randomBytes(4).toString('hex')}`, volume = `${name}-data`;
function command(args) {
  const value = spawnSync('docker', args, { encoding: 'utf8' });
  if (value.error) throw value.error;
  if (value.status !== 0) throw new Error(`Docker privilege fixture failed: ${value.stderr}`);
  return value.stdout.trim();
}
async function start(image, options = []) {
  command(['run', '-d', '--name', name, ...options, '-v', `${volume}:/var/lib/postgresql`,
    '-e', 'POSTGRES_DB=fylkren', '-e', 'POSTGRES_USER=fylkren', '-e', 'POSTGRES_PASSWORD=synthetic-upgrade-only', image]);
  for (let attempt = 0; attempt < 60; attempt++) {
    const check = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'fylkren', '-d', 'fylkren'], { stdio: 'ignore' });
    if (check.status === 0) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('PostgreSQL privilege fixture did not become ready');
}
function sql(statement) { return command(['exec', name, 'psql', '-U', 'fylkren', '-d', 'fylkren', '-At', '-v', 'ON_ERROR_STOP=1', '-c', statement]); }
try {
  command(['volume', 'create', volume]);
  await start('postgres:18-alpine'); // Previous root entrypoint initializes the existing named volume.
  sql("CREATE TABLE release_privilege_probe(value text); INSERT INTO release_privilege_probe VALUES ('preserved');");
  command(['stop', name]); command(['rm', name]);
  await start('fylkren-postgres:latest', ['--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true']);
  assert.equal(sql('SELECT value FROM release_privilege_probe'), 'preserved');
  assert.notEqual(command(['exec', name, 'id', '-u']), '0');
  const status = command(['exec', name, 'cat', '/proc/1/status']);
  assert.match(status, /^Uid:\s+70\s+70\s+70\s+70$/m);
  assert.match(status, /^NoNewPrivs:\s+1$/m); assert.match(status, /^CapEff:\s+0000000000000000$/m);
  console.log(JSON.stringify({ postgresNonRootUpgrade: 'passed', existingRootInitializedVolumePreserved: true, processUid: 70, effectiveCapabilities: 0, noPrivilegeEscalation: true }));
} finally {
  spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  spawnSync('docker', ['volume', 'rm', volume], { stdio: 'ignore' });
}
