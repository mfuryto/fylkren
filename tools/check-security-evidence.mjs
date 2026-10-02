import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// This checks traceability, not whether security controls passed.
const matrix = readFileSync('docs/security/ASVS_5.0.0_L2_MATRIX.md', 'utf8');
const rows = matrix.split('\n').filter(line => line.startsWith('| v5.0.0-'));
assert.equal(rows.length, 253, 'Pinned ASVS 5.0.0 Level 1/2 requirements must remain complete');
const ids = new Set();
const counts = new Map();
for (const row of rows) {
  const cells = row.split(' | ');
  assert.equal(cells.length, 6, 'Do not introduce unescaped table separators');
  const id = cells[0].slice(2), status = cells[4], evidence = cells[5];
  assert.match(id, /^v5\.0\.0-\d+\.\d+\.\d+$/);
  assert.ok(!ids.has(id), `Duplicate requirement ${id}`);
  ids.add(id);
  assert.ok(['Not assessed', 'In progress', 'Passed', 'Not applicable', 'Finding'].includes(status), `Unknown status for ${id}`);
  counts.set(status, (counts.get(status) ?? 0) + 1);
  if (status === 'Passed') {
    assert.match(evidence, /Test: \[[^\]]+\]\([^)]+\)/, `${id}: Passed requires an identifiable test`);
    assert.match(evidence, /Evidence: \[[^\]]+\]\([^)]+\)/, `${id}: Passed requires a linked execution record`);
    assert.doesNotMatch(evidence, /available evidence are recorded in the maintained security documentation/, `${id}: generic evidence is insufficient`);
  }
}
console.log(`ASVS traceability check passed for ${rows.length} requirements. Statuses: ${JSON.stringify(Object.fromEntries(counts))}. This does not execute or certify controls.`);
