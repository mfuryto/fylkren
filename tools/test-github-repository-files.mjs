import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = relative => readFile(path.join(root, relative), 'utf8');
const workflowDirectory = path.join(root, '.github', 'workflows');
const workflowFiles = (await readdir(workflowDirectory)).filter(name => name.endsWith('.yml')).sort();
assert.deepEqual(workflowFiles, ['codeql.yml', 'pages.yml', 'quality.yml']);

let actionReferences = 0;
for (const name of workflowFiles) {
  const source = await read(path.join('.github', 'workflows', name));
  assert.match(source, /^permissions:/m, `${name} must declare top-level token permissions`);
  assert.doesNotMatch(source, /pull_request(?:_target)?|workflow_run|write-all|persist-credentials:\s*true/, `${name} contains a prohibited workflow or pull-request capability`);
  for (const match of source.matchAll(/^\s*uses:\s*([^@\s]+)@([^\s#]+)/gm)) {
    actionReferences += 1;
    assert.match(match[2], /^[0-9a-f]{40}$/, `${name}: ${match[1]} must be pinned to a complete commit SHA`);
  }
}
assert.ok(actionReferences >= 12, 'expected every maintained external Action reference to be inventoried');

const pages = await read('.github/workflows/pages.yml');
assert.match(pages, /push:\n\s+branches: \[main\]/, 'Pages must deploy from main only');
assert.match(pages, /path: apps\/demo\/dist/, 'Pages must upload only the built static demo');
assert.match(pages, /pages: write/);
assert.match(pages, /id-token: write/);

const readme = await read('README.md');
const normalizedReadme = readme.toLowerCase();
for (const phrase of ['multilingual', 'ai-assisted', 'self-hosted', 'air-gapped', 'https://mfuryto.github.io/fylkren/']) assert.ok(normalizedReadme.includes(phrase), `README is missing ${phrase}`);

const demo = await read('apps/demo/index.html');
for (const marker of ['rel="canonical"', 'application/ld+json', 'og:image', 'robots', 'SoftwareApplication']) assert.ok(demo.includes(marker), `demo metadata is missing ${marker}`);

const security = await read('SECURITY.md');
assert.match(security, /security\/advisories\/new/);
assert.match(security, /Supported versions/);
assert.match(await read('.github/ISSUE_TEMPLATE/config.yml'), /blank_issues_enabled: false/);

const hardening = await read('tools/security/harden-public-github-repository.sh');
assert.doesNotMatch(hardening, /"visibility"\s*:/, 'the hardening script must never change repository visibility');
for (const control of ['private-vulnerability-reporting', 'secret_scanning_push_protection', 'actions/permissions/workflow', 'repos/$repo/pages']) assert.ok(hardening.includes(control), `hardening script is missing ${control}`);
assert.match(hardening, /"has_pull_requests": false/, 'the public repository must keep pull requests disabled');

console.log(JSON.stringify({ githubRepositoryFiles: 'passed', workflows: workflowFiles.length, pinnedActionReferences: actionReferences, pullRequestAutomation: false, issueForms: 3, pagesSource: 'apps/demo' }));
