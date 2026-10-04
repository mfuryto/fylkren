import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const access = readFileSync('docs/administration/ACCESS_MATRIX.md', 'utf8');
const fieldClasses = [
  'authentication-secret', 'self-profile', 'personnel-administration', 'work-content',
  'cross-site-official', 'private-learning', 'classified-report', 'audit-activity',
  'integration-secret', 'archive-export',
];
for (const fieldClass of fieldClasses) {
  assert.ok(access.includes(`| \`${fieldClass}\` |`),
    `ACCESS_MATRIX.md does not define field authorization class ${fieldClass}`);
}
assert.match(access, /Read rule \| Write rule \| State and resource attributes/);
assert.match(access, /unknown fields are not dynamically bound/i);

const learning = readFileSync('tools/e2e/learning.mjs', 'utf8');
assert.match(learning, /Internal learning leaked into approved report versions/);
assert.match(learning, /Private learning content leaked into activity/);

const machineReports = readFileSync('tools/e2e/administration-report-apis.mjs', 'utf8');
assert.match(machineReports, /Classified report leaked without grant/);
assert.match(machineReports, /Classified report detail leaked without classified permission/);

const portability = readFileSync('tools/e2e/portability.mjs', 'utf8');
assert.match(portability, /Authentication secrets included as package entries/);

const crossSite = readFileSync('tools/e2e/cross-site-requests.mjs', 'utf8');
assert.match(crossSite, /Sender can inspect receiver internal task/);
assert.match(crossSite, /Approved official response missing from sender view/);

process.stdout.write(`${JSON.stringify({
  fieldAuthorizationDocumentation: 'passed',
  fieldClasses: fieldClasses.length,
  stateDependentRulesDocumented: true,
  maintainedNegativeEvidence: ['private-learning', 'classified-report', 'archive-export', 'cross-site-official'],
})}\n`);
