import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.cs') ? [path] : [];
  });
}

const families = [
  { id: 'public-bootstrap', matches: path => path === 'apps/api/Program.cs' || /Platform\/(PublicConfiguration|Branding)Endpoints\.cs$/.test(path) },
  { id: 'identity-session', matches: path => path.includes('/Identity/') },
  { id: 'machine-api', matches: path => /Platform\/(Administration|ReportApi|OperationalApi|ApiDescription|WorkApiManagement)/.test(path) },
  { id: 'federation', matches: path => path.includes('/Federation/') },
  { id: 'archive-portability', matches: path => /InformationLifecycle\/ArchiveReaderEndpoints\.cs$/.test(path) || path.includes('/Portability/') },
  { id: 'platform-governance', matches: path => path.includes('/Platform/') || path.includes('/Licensing/') || path.includes('/DomainEvents/Webhook') || path.includes('/ActivityAudit/Platform') || /InformationLifecycle\/(Governance|Preservation)/.test(path) },
  { id: 'site-administration', matches: path => path.includes('/Organization/') || path.includes('/Notifications/') || path.includes('/ActivityAudit/Site') || /WorkManagement\/(Template|ReferenceSettings)Endpoints\.cs$/.test(path) },
  { id: 'operational-work', matches: () => true },
];

const methodCounts = { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 };
const familyCounts = Object.fromEntries(families.map(family => [family.id, 0]));
const endpointFiles = [];

for (const absolutePath of sourceFiles('apps/api')) {
  const path = relative('.', absolutePath).replaceAll('\\', '/');
  const source = readFileSync(absolutePath, 'utf8');
  let count = 0;
  for (const method of Object.keys(methodCounts)) {
    const occurrences = [...source.matchAll(new RegExp(`\\.Map${method[0]}${method.slice(1).toLowerCase()}\\(`, 'g'))].length;
    methodCounts[method] += occurrences;
    count += occurrences;
  }
  if (count === 0) continue;
  endpointFiles.push(path);
  const family = families.find(candidate => candidate.matches(path));
  assert.ok(family, `Endpoint source has no documented authorization family: ${path}`);
  familyCounts[family.id] += count;
}

assert.deepEqual(methodCounts, { GET: 119, POST: 120, PUT: 47, PATCH: 0, DELETE: 28 },
  'Endpoint inventory changed; reconcile the new or removed routes with ACCESS_MATRIX.md before accepting the count');
assert.equal(Object.values(familyCounts).reduce((sum, count) => sum + count, 0), 314);

const documentation = readFileSync('docs/administration/ACCESS_MATRIX.md', 'utf8');
for (const family of families) {
  assert.ok(documentation.includes(`| \`${family.id}\` |`),
    `ACCESS_MATRIX.md does not define authorization family ${family.id}`);
}
assert.match(documentation, /314 registered HTTP operations across 99 endpoint source files/);
assert.match(documentation, /pending users?[\s\S]*ordinary authenticated fallback denies/i);
assert.match(documentation, /consumer permission.*resource attributes/i);
assert.match(documentation, /field and response boundary/i);

process.stdout.write(`${JSON.stringify({
  authorizationDocumentationInventory: 'passed',
  endpointFiles: endpointFiles.length,
  endpointOperations: 314,
  methodCounts,
  familyCounts,
})}\n`);
