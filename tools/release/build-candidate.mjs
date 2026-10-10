import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { validateCandidateState } from './candidate-policy.mjs';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed${options.capture ? `: ${(result.stderr || result.stdout).trim()}` : ''}`);
  return options.capture ? result.stdout.trim() : '';
}

const version = readFileSync('VERSION', 'utf8').trim();
const candidateIndex = process.argv.indexOf('--candidate');
const candidate = candidateIndex >= 0 ? process.argv[candidateIndex + 1] : null;
if (!candidate) throw new Error('Provide --candidate rc.N.');
const commit = run('git', ['rev-parse', 'HEAD'], { capture: true });
const branch = run('git', ['branch', '--show-current'], { capture: true });
const status = run('git', ['status', '--porcelain'], { capture: true });
const candidateState = validateCandidateState({ version, candidate, branch, status, changelog: readFileSync('CHANGELOG.md', 'utf8') });

const output = path.resolve('output', 'release', candidateState.candidateVersion);
mkdirSync(output, { recursive: true });
const images = [];
const runtimeImages = [
  ['api', 'apps/api/Dockerfile'],
  ['web', 'apps/web/Dockerfile'],
  ['data-protection-init', 'apps/data-protection-custody/Dockerfile'],
  ['postgres', 'apps/postgres/Dockerfile'],
  ['tls-init', 'apps/tls-init/Dockerfile'],
];
for (const [role, dockerfile] of runtimeImages) {
  const tag = `fylkren-${role}:${candidateState.candidateVersion}`;
  run('docker', ['build', '--file', dockerfile, '--tag', tag,
    '--label', `org.opencontainers.image.title=Fylkren ${role}`,
    '--label', `org.opencontainers.image.version=${version}`,
    '--label', `org.opencontainers.image.ref.name=${candidateState.candidateVersion}`,
    '--label', `org.opencontainers.image.revision=${commit}`,
    '--label', 'org.opencontainers.image.source=https://github.com/mfuryto/fylkren', '.']);
  const inspected = JSON.parse(run('docker', ['image', 'inspect', tag], { capture: true }))[0];
  assert.match(inspected.Id, /^sha256:[0-9a-f]{64}$/);
  assert.equal(inspected.Config.Labels['org.opencontainers.image.version'], version);
  assert.equal(inspected.Config.Labels['org.opencontainers.image.revision'], commit);
  images.push({ role, tag, imageId: inspected.Id, repoDigests: inspected.RepoDigests ?? [] });
}

const sbomOutput = path.join(output, 'sbom');
const sbomArgs = ['tools/security/generate-release-sbom.mjs', '--output', sbomOutput];
for (const image of images) sbomArgs.push('--image', `${image.role}=${image.tag}`);
run(process.execPath, sbomArgs);
const sbomManifest = JSON.parse(readFileSync(path.join(sbomOutput, 'manifest.json'), 'utf8'));
assert.equal(sbomManifest.sourceCommit, commit);
for (const image of images)
  assert.equal(sbomManifest.artifacts.find(artifact => artifact.role === image.role)?.imageId, image.imageId);

const manifest = {
  schema: 'fylkren-release-candidate/v1',
  version,
  candidate: candidateState.candidateVersion,
  commit,
  branch,
  createdAt: new Date().toISOString(),
  images,
  sbomManifest: path.relative(output, path.join(sbomOutput, 'manifest.json')),
};
writeFileSync(path.join(output, 'candidate.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ releaseCandidate: 'built', version, candidate: candidateState.candidateVersion, commit, images }));
