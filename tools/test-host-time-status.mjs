import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const root = mkdtempSync(join(tmpdir(), 'fylkren-host-time-'));
const project = join(root, 'project');
const binaries = join(root, 'bin');
mkdirSync(join(project, 'runtime'), { recursive: true });
mkdirSync(binaries);
writeFileSync(join(project, 'compose.yaml'), 'services: {}\n');
writeFileSync(join(binaries, 'docker'), `#!/bin/sh
case "$1" in
  version) printf '%s\n' '29.1.3' ;;
  compose)
    case "$*" in
      *" ps -q web") printf '%s\n' 'web-id' ;;
      *" ps -q api") printf '%s\n' 'api-id' ;;
      *" ps -q postgres") printf '%s\n' 'postgres-id' ;;
    esac ;;
  inspect)
    case "$3" in
      *State.Status*) printf '%s\n' 'running' ;;
      *State.Health*) printf '%s\n' 'healthy' ;;
      *RestartCount*) printf '%s\n' '0' ;;
      *Config.Env*)
        case "$4" in
          web-id) printf '%s\n' 'NGINX_VERSION=1.29.8' 'IGNORED_SECRET=must-not-appear' ;;
          api-id) printf '%s\n' 'ASPNET_VERSION=10.0.12' ;;
          postgres-id) printf '%s\n' 'PG_VERSION=18.6' ;;
        esac ;;
    esac ;;
esac
`);
writeFileSync(join(binaries, 'chronyc'), `#!/bin/sh
if [ "$FAKE_CHRONY" = yes ]; then
  printf '%s\\n' 'Reference ID    : 192.0.2.10' 'Last offset     : -0.000004000 seconds' 'Leap status     : Normal'
  exit 0
fi
exit 1
`);
writeFileSync(join(binaries, 'timedatectl'), `#!/bin/sh
case "$*" in
  "show --property=NTPSynchronized --value") printf '%s\\n' "$FAKE_SYNC" ;;
  "show-timesync --property=ServerName --value") printf '%s\\n' 'ntp.example.invalid' ;;
  "timesync-status --no-pager") printf '       Offset: %s\\n' "$FAKE_OFFSET" ;;
esac
`);
chmodSync(join(binaries, 'docker'), 0o755);
chmodSync(join(binaries, 'chronyc'), 0o755);
chmodSync(join(binaries, 'timedatectl'), 0o755);

const collector = resolve('deploy/host-status/collect-host-status.sh');
function collect(sync, offset, chrony = 'no') {
  const result = spawnSync(collector, [project], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${binaries}:${process.env.PATH}`, FAKE_SYNC: sync, FAKE_OFFSET: offset, FAKE_CHRONY: chrony },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(readFileSync(join(project, 'runtime', 'host-status.json'), 'utf8'));
}

try {
  const snapshot = collect('yes', '+2.500ms');
  assert.deepEqual(snapshot.time, {
    synchronized: true, status: 'healthy', source: 'ntp.example.invalid', offsetMilliseconds: 2.5,
    maximumAllowedOffsetMilliseconds: 1000,
    detail: 'Host clock is synchronized and within the configured offset boundary.',
  });
  assert.equal(snapshot.runtime.containerEngineName, 'Docker Engine');
  assert.equal(snapshot.runtime.containerEngineVersion, '29.1.3');
  assert.deepEqual(snapshot.services.map(service => service.runtime), [
    { name: 'nginx', version: '1.29.8' },
    { name: 'ASP.NET Core', version: '10.0.12' },
    { name: 'PostgreSQL', version: '18.6' },
  ]);
  assert.doesNotMatch(JSON.stringify(snapshot), /IGNORED_SECRET|must-not-appear/);
  assert.equal(collect('yes', '-1500ms').time.status, 'down');
  assert.equal(collect('no', '').time.status, 'down');
  const chrony = collect('no', '', 'yes').time;
  assert.equal(chrony.status, 'healthy');
  assert.equal(chrony.offsetMilliseconds, -0.004);
  console.log(JSON.stringify({ hostTimeStatus: 'passed', maximumOffsetMilliseconds: 1000,
    synchronizedWithinBoundary: 'healthy', excessiveOffset: 'down', unsynchronized: 'down' }));
} finally {
  rmSync(root, { recursive: true, force: true });
}
