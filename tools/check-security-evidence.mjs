import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// This checks traceability, not whether security controls passed.
const matrix = readFileSync('dev-notes/security/ASVS_5.0.0_L2_MATRIX.md', 'utf8');
const findingRegister = readFileSync('dev-notes/security/SECURITY_VERIFICATION.md', 'utf8');
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
    assert.doesNotMatch(evidence, /does not claim complete|remain(?:s)? open under|other factor boundaries remain/i,
      `${id}: Passed evidence must not retain superseded incomplete-scope wording`);
  }
  if (status === 'Not applicable') {
    assert.ok(evidence.trim().length >= 30, `${id}: Not applicable requires a verifiable rationale`);
  }
}
const declared = matrix.match(/all 253 .*?: (\d+) Passed and (\d+) Not applicable\./);
assert.ok(declared, 'Current matrix summary and totals are required');
assert.equal(Number(declared[1]), counts.get('Passed') ?? 0, 'Declared Passed total must match the rows');
assert.equal(Number(declared[2]), counts.get('Not applicable') ?? 0, 'Declared Not applicable total must match the rows');
assert.equal((counts.get('Finding') ?? 0) + (counts.get('In progress') ?? 0) + (counts.get('Not assessed') ?? 0), 0,
  'The current matrix summary claims completion but incomplete rows remain');
const findingRows = findingRegister.split('\n').filter(line => /^\| SV-\d+ /.test(line));
const findingIds = findingRows.map(line => line.split(' | ')[0].slice(2));
assert.equal(new Set(findingIds).size, findingIds.length, 'Finding register IDs must be unique');
const openSection = findingRegister.split('### Open residual findings')[1]?.split('\n## Release decision')[0] ?? '';
const openFindingRows = openSection.split('\n').filter(line => /^\| SV-\d+ /.test(line));
assert.equal(openFindingRows.length, counts.get('Finding') ?? 0,
  'Open finding-register rows must match ASVS Finding rows');
console.log(`ASVS traceability check passed for ${rows.length} requirements. Statuses: ${JSON.stringify(Object.fromEntries(counts))}. This does not execute or certify controls.`);
