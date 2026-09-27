import assert from 'node:assert/strict';

export async function assertClassificationOrder(evaluate) {
  const options = await evaluate(`[...document.querySelectorAll('#final-report-classification option')]
    .map(value => ({ value: value.value, label: value.textContent.trim() }))`);
  assert.deepEqual(options, [
    { value: '', label: 'Ingen klassifisering' },
    { value: 'PUB', label: 'PUBLIC (PUB)' },
    { value: 'INT', label: 'INTERNAL (INT)' },
    { value: 'CONF', label: 'CONFIDENTIAL (CONF)' },
    { value: 'SENS', label: 'SENSITIVE (SENS)' },
    { value: 'SECRET', label: 'SECRET (SECRET)' },
  ]);
}
