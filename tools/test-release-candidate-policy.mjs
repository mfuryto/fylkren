import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { validateCandidateState } from './release/candidate-policy.mjs';

const valid = validateCandidateState({ version: '1.0.0', candidate: 'rc.1', branch: 'staging', status: '', changelog: '# Changelog\n\n## 1.0.0 - 2026-10-10\n' });
assert.deepEqual(valid, { stableVersion: '1.0.0', candidateVersion: '1.0.0-rc.1' });
assert.throws(() => validateCandidateState({ version: '0.99.0-dev.1', candidate: 'rc.1', branch: 'staging', status: '', changelog: '## 1.0.0' }), /stable/);
assert.throws(() => validateCandidateState({ version: '1.0.0', candidate: 'candidate-1', branch: 'staging', status: '', changelog: '## 1.0.0' }), /rc.N/);
assert.throws(() => validateCandidateState({ version: '1.0.0', candidate: 'rc.1', branch: 'main', status: '', changelog: '## 1.0.0' }), /staging/);
assert.throws(() => validateCandidateState({ version: '1.0.0', candidate: 'rc.1', branch: 'staging', status: ' M file', changelog: '## 1.0.0' }), /clean/);
assert.throws(() => validateCandidateState({ version: '1.0.0', candidate: 'rc.1', branch: 'staging', status: '', changelog: '## Unreleased' }), /CHANGELOG/);
const builder = readFileSync('tools/release/build-candidate.mjs', 'utf8');
const promoter = readFileSync('tools/release/promote-candidate.mjs', 'utf8');
assert.match(builder, /org\.opencontainers\.image\.revision/);
assert.match(builder, /generate-release-sbom/);
for (const role of ['api', 'web', 'data-protection-init', 'postgres', 'tls-init'])
  assert.match(builder, new RegExp(`\\['${role}',`), `candidate builder must include ${role}`);
assert.doesNotMatch(builder, /docker[^\n]*push/);
assert.match(promoter, /tag.*--verify/s);
assert.match(promoter, /candidateImage\.imageId/);
assert.doesNotMatch(promoter, /docker[^\n]*build/);
assert.doesNotMatch(promoter, /docker[^\n]*push/);
function filesBelow(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const candidatePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return ['bin', 'obj', 'node_modules', '.git', '.git-local'].includes(entry.name) ? [] : filesBelow(candidatePath);
    return [candidatePath];
  });
}
const projects = filesBelow('.').filter(file => file.endsWith('.csproj'));
assert.ok(projects.length > 0);
for (const project of projects)
  assert.ok(existsSync(path.join(path.dirname(project), 'packages.lock.json')), `${project} is missing packages.lock.json`);
for (const dockerfile of ['apps/api/Dockerfile', 'apps/data-protection-custody/Dockerfile']) {
  const source = readFileSync(dockerfile, 'utf8');
  assert.match(source, /packages\.lock\.json/);
  assert.match(source, /dotnet restore[^\n]*--locked-mode/);
}
console.log(JSON.stringify({ releaseCandidatePolicy: 'passed', requiredBranch: 'staging', productVersion: 'MAJOR.MINOR.PATCH', candidateLabel: 'rc.N' }));
