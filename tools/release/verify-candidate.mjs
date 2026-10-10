import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { validateCandidateState } from './candidate-policy.mjs';

const sourceOnly = process.argv.includes('--source-only');
const candidateIndex = process.argv.indexOf('--candidate');
const candidate = candidateIndex >= 0 ? process.argv[candidateIndex + 1] : null;
function output(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}
const version = readFileSync('VERSION', 'utf8').trim();
const commit = output('git', ['rev-parse', 'HEAD']);
const branch = output('git', ['branch', '--show-current']);
const status = output('git', ['status', '--porcelain']);
if (!sourceOnly) {
  if (!candidate) throw new Error('Provide --candidate rc.N.');
  validateCandidateState({ version, candidate, branch, status, changelog: readFileSync('CHANGELOG.md', 'utf8') });
}

function filesBelow(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const candidatePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return ['bin', 'obj', 'node_modules', '.git', '.git-local'].includes(entry.name) ? [] : filesBelow(candidatePath);
    return [candidatePath];
  });
}
const dotnetProjects = filesBelow('.').filter(file => file.endsWith('.csproj')).sort();
const common = [
  ['pnpm', ['install', '--frozen-lockfile', '--offline']],
  ...dotnetProjects.map(project => ['dotnet', ['restore', project, '--locked-mode']]),
  ['pnpm', ['check:version']],
  ['bash', ['tools/security/verify-repository-safety.sh', '--history']],
  ['pnpm', ['check:docs']],
  ['pnpm', ['check:language:full']],
  ['pnpm', ['check:structure']],
  ['pnpm', ['typecheck']],
  ['pnpm', ['test']],
  ['pnpm', ['build']],
  ...dotnetProjects.map(project => ['dotnet', ['build', project, '--configuration', 'Release', '--no-restore']]),
];
const candidateOnly = [
  [process.execPath, ['tools/run-foundation-tests.mjs']],
  ['pnpm', ['test:e2e:editions']],
  ['pnpm', ['test:e2e:browser']],
  ['pnpm', ['test:e2e:identity-directory']],
  ['pnpm', ['test:e2e:identity-ad']],
  ['pnpm', ['test:e2e:identity-sso']],
  ['pnpm', ['test:e2e:license-expiry']],
  ['pnpm', ['test:e2e:postgres-upgrade']],
  [process.execPath, ['tools/release/build-candidate.mjs', '--candidate', candidate]],
];
const results = [];
const destination = path.resolve('output', 'release-verification');
mkdirSync(destination, { recursive: true });
function writeReport(outcome) {
  const report = { schema: 'fylkren-release-verification/v1', outcome, mode: sourceOnly ? 'source' : 'candidate', version,
    candidate: sourceOnly ? null : `${version}-${candidate}`, commit, branch, worktreeDirtyAtStart: Boolean(status),
    completedAt: new Date().toISOString(), results };
  const file = path.join(destination, `${version}-${commit.slice(0, 12)}-${report.mode}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  return report;
}
for (const [command, args] of sourceOnly ? common : [...common, ...candidateOnly]) {
  const startedAt = new Date();
  console.log(`\n[release] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  const completedAt = new Date();
  results.push({ command: [command, ...args], startedAt: startedAt.toISOString(), completedAt: completedAt.toISOString(), durationMs: completedAt - startedAt, exitCode: result.status });
  if (result.status !== 0) {
    writeReport('failed');
    throw new Error(`Release verification stopped after ${command} exited with ${result.status}.`);
  }
}
const report = writeReport('passed');
console.log(JSON.stringify({ releaseVerification: 'passed', mode: report.mode, version, commit, checks: results.length }));
