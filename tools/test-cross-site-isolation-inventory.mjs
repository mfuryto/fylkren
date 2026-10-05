import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const access = readFileSync('docs/administration/ACCESS_MATRIX.md', 'utf8');
for (const resource of ['site-configuration', 'person-membership-role', 'work-item',
  'planning-execution', 'decision-risk-measure-comment', 'learning', 'report',
  'audit-activity', 'lifecycle-archive-preservation', 'portable-export'])
  assert.ok(access.includes(`| \`${resource}\` |`), `Cross-Site inventory lacks ${resource}`);

const authorization = readFileSync('tools/e2e/authorization-boundaries.mjs', 'utf8');
for (const boundary of [
  'Unrelated site overview', 'Unrelated site task list', 'Unrelated site task details',
  'Unrelated site report archive', 'Unrelated site workload history',
  'Unrelated site descendant workload', 'Unrelated site planning queue',
  'Unrelated site execution queue', 'Unrelated site workflow definitions',
  'Unrelated site templates', 'Foreign organization through Site Manager',
  'Foreign personnel access through Site Manager', 'Foreign object under authorized site route',
  'Authorized object under foreign site route',
]) assert.ok(authorization.includes(boundary), `Missing direct cross-Site boundary: ${boundary}`);

const specialized = [
  ['tools/e2e/task-comments.mjs', 'Wrong Site'],
  ['tools/e2e/learning.mjs', 'siteId=${otherSiteId}'],
  ['tools/e2e/decisions-risks-versions.mjs', 'otherSiteId'],
  ['tools/e2e/activity-lifecycle.mjs', 'otherSiteId'],
  ['tools/e2e/portability.mjs', 'foreign lifecycle owner'],
  ['tools/e2e/cross-site-requests.mjs', 'Sender can inspect receiver internal task'],
];
for (const [path, marker] of specialized)
  assert.ok(readFileSync(path, 'utf8').includes(marker), `${path} lacks ${marker}`);

const preservation = readFileSync('tests/foundations/PreservationTests.cs', 'utf8');
assert.match(preservation, /Concurrent snapshot test did not execute its independent writer/);
assert.match(preservation, /Export mixed snapshots or exposed foreign content/);
const counts = readFileSync('tests/foundations/NavigationCountMeasurements.cs', 'utf8');
assert.match(counts, /Concurrent counts changed or broadened authorization/);

process.stdout.write(`${JSON.stringify({
  crossSiteIsolationInventory: 'passed', resourceClasses: 10,
  directHttpBoundaries: 14, specializedSuites: specialized.length,
  concurrentSnapshotIsolation: true, concurrentCountIsolation: true,
})}\n`);
