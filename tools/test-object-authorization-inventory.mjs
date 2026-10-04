import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const access = readFileSync('docs/administration/ACCESS_MATRIX.md', 'utf8');
const resources = [
  'site-configuration', 'person-membership-role', 'work-item', 'planning-execution',
  'decision-risk-measure-comment', 'learning', 'report', 'template-workflow',
  'audit-activity', 'lifecycle-archive-preservation', 'portable-export',
  'machine-client-grant', 'federation-peer-message',
];
for (const resource of resources)
  assert.ok(access.includes(`| \`${resource}\` |`), `Missing object authorization class: ${resource}`);
assert.match(access, /client-supplied Site or parent identifier is never accepted as proof of ownership/i);

const evidence = [
  ['tools/e2e/authorization-boundaries.mjs', ['Foreign object under authorized site route', 'Authorized object under foreign site route', 'Sibling planning run by direct ID']],
  ['tools/e2e/learning.mjs', ['Foreign work level read internal discussion', 'Internal learning leaked into approved report versions']],
  ['tools/e2e/administration-report-apis.mjs', ['Classified report detail leaked without classified permission']],
  ['tools/e2e/portability.mjs', ['Authentication secrets included as package entries']],
  ['tools/e2e/cross-site-requests.mjs', ['Sender can inspect receiver internal task']],
  ['tools/e2e/activity-lifecycle.mjs', ['sibling', 'otherSiteId']],
  ['tools/e2e/governance-lifecycle.mjs', ['custodian', 'Unsafe loss of custody']],
  ['tools/e2e/decisions-risks-versions.mjs', ['risk', 'decision']],
];
for (const [path, markers] of evidence) {
  const source = readFileSync(path, 'utf8');
  for (const marker of markers)
    assert.ok(source.toLowerCase().includes(marker.toLowerCase()), `${path} lacks object-boundary evidence marker: ${marker}`);
}

process.stdout.write(`${JSON.stringify({
  objectAuthorizationInventory: 'passed', resourceClasses: resources.length,
  ownershipBindingDocumented: true, maintainedEvidenceSuites: evidence.length,
})}\n`);
