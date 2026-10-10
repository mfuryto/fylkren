import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}
const manifestIndex = process.argv.indexOf('--manifest');
if (manifestIndex < 0 || !process.argv[manifestIndex + 1]) throw new Error('Provide --manifest output/release/VERSION-rc.N/candidate.json.');
const manifestPath = path.resolve(process.argv[manifestIndex + 1]);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.schema, 'fylkren-release-candidate/v1');
const version = readFileSync('VERSION', 'utf8').trim();
const commit = run('git', ['rev-parse', 'HEAD']);
assert.equal(run('git', ['branch', '--show-current']), 'main', 'Promotion requires main');
assert.equal(run('git', ['status', '--porcelain']), '', 'Promotion requires a clean worktree');
assert.equal(manifest.version, version, 'Candidate product version differs from VERSION');
assert.equal(manifest.commit, commit, 'Candidate was not built from the current accepted commit');
run('git', ['tag', '--verify', `v${version}`]);

const images = [];
for (const candidateImage of manifest.images) {
  const inspected = JSON.parse(run('docker', ['image', 'inspect', candidateImage.tag]))[0];
  assert.equal(inspected.Id, candidateImage.imageId, `${candidateImage.role} candidate image changed or is unavailable`);
  const stableTag = `fylkren-${candidateImage.role}:${version}`;
  run('docker', ['tag', candidateImage.imageId, stableTag]);
  assert.equal(JSON.parse(run('docker', ['image', 'inspect', stableTag]))[0].Id, candidateImage.imageId);
  images.push({ role: candidateImage.role, candidateTag: candidateImage.tag, stableTag, imageId: candidateImage.imageId });
}
const promotion = { schema: 'fylkren-release-promotion/v1', version, commit, tag: `v${version}`,
  promotedAt: new Date().toISOString(), candidateManifest: manifestPath, images };
const output = path.join(path.dirname(manifestPath), 'promotion.json');
writeFileSync(output, `${JSON.stringify(promotion, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ releasePromotion: 'verified', version, commit, images }));
