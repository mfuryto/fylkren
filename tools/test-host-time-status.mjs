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
writeFileSync(join(binaries, 'docker'), '#!/bin/sh\nexit 0\n');
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
  return JSON.parse(readFileSync(join(project, 'runtime', 'host-status.json'), 'utf8')).time;
}

try {
  assert.deepEqual(collect('yes', '+2.500ms'), {
    synchronized: true, status: 'healthy', source: 'ntp.example.invalid', offsetMilliseconds: 2.5,
    maximumAllowedOffsetMilliseconds: 1000,
    detail: 'Host clock is synchronized and within the configured offset boundary.',
  });
  assert.equal(collect('yes', '-1500ms').status, 'down');
  assert.equal(collect('no', '').status, 'down');
  const chrony = collect('no', '', 'yes');
  assert.equal(chrony.status, 'healthy');
  assert.equal(chrony.offsetMilliseconds, -0.004);
  console.log(JSON.stringify({ hostTimeStatus: 'passed', maximumOffsetMilliseconds: 1000,
    synchronizedWithinBoundary: 'healthy', excessiveOffset: 'down', unsynchronized: 'down' }));
} finally {
  rmSync(root, { recursive: true, force: true });
}
