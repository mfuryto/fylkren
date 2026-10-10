import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isReleaseCandidate, parseVersion, validateTransition } from './release/version-policy.mjs';

assert.deepEqual(parseVersion('1.2.3-rc.4'), { value: '1.2.3-rc.4', major: 1, minor: 2, patch: 3, prerelease: 'rc.4' });
assert.equal(isReleaseCandidate('1.0.0-rc.1'), true);
assert.equal(isReleaseCandidate('1.0.0-dev.1'), false);
assert.throws(() => validateTransition('1.1.0', '1.0.1'), /regression/);
assert.throws(() => validateTransition('1.0.0', '1.0.0-rc.2'), /cannot be replaced/);
validateTransition('0.99.0-dev.1', '1.0.0-rc.1');
validateTransition('1.0.0-rc.1', '1.0.0');
validateTransition('0.99.0-dev.1', '1.0.0');
validateTransition('1.0.0', '1.0.1');

const root = mkdtempSync(path.join(tmpdir(), 'fylkren-version-'));
try {
  writeFileSync(path.join(root, 'VERSION'), '0.99.0-dev.1\n');
  writeFileSync(path.join(root, 'Directory.Build.props'), '<Version>0.99.0-dev.1</Version>\n');
  writeFileSync(path.join(root, 'README.md'), '<code>VERSION 0.99.0-dev.1</code>\n');
  const result = spawnSync(process.execPath, ['tools/release/set-version.mjs', '1.0.0', '--root', root], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(path.join(root, 'VERSION'), 'utf8'), '1.0.0\n');
  assert.match(readFileSync(path.join(root, 'Directory.Build.props'), 'utf8'), /<Version>1\.0\.0<\/Version>/);
  assert.match(readFileSync(path.join(root, 'README.md'), 'utf8'), /VERSION 1\.0\.0/);
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log(JSON.stringify({ releaseVersionPolicy: 'passed', supportedPromotion: 'dev -> rc -> stable' }));
