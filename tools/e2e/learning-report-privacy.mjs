import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

export const learningSentinels = ['PRIVATE_POSITIVE_LEARNING_SENTINEL', 'PRIVATE_IMPROVEMENT_LEARNING_SENTINEL'];

export async function addPrivateLearning({ evaluate, setInput, waitFor }) {
  for (const [index, text] of learningSentinels.entries()) {
    await waitFor(`document.querySelectorAll('.learning-report-points fieldset')[${index}].querySelector('button.secondary-button:not(:disabled)') !== null`, 'learning draft ready');
    await evaluate(`document.querySelectorAll('.learning-report-points fieldset')[${index}].querySelector('button.secondary-button').click()`);
    await waitFor(`document.querySelector('.learning-report-points fieldset:nth-of-type(${index + 1}) textarea') !== null`, 'learning draft field');
    await setInput(`.learning-report-points fieldset:nth-of-type(${index + 1}) textarea`, text);
  }
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".learning-draft-points li"), e => e.value)'), [1, 1]);
}

export async function verifyPrivateLearning({ request, siteId, itemId, completed }) {
  const lessons = await request(`/api/work/learning?siteId=${siteId}&workItemId=${itemId}&view=all`);
  assert.equal(lessons.status, 200);
  assert.equal(lessons.body.total, 2);
  assert.deepEqual(lessons.body.items.map(value => value.text).sort(), [...learningSentinels].sort());
  const archive = await request(`/api/work/sites/${siteId}/reports`);
  const versions = await request(`/api/approvals/sites/${siteId}/items/${itemId}/versions`);
  assert.equal(archive.status, 200); assert.equal(versions.status, 200);
  for (const text of learningSentinels) {
    assert.ok(!JSON.stringify(completed).includes(text), 'Private learning leaked into the completed task');
    assert.ok(!JSON.stringify(archive.body).includes(text), 'Private learning leaked into the report archive');
    assert.ok(!JSON.stringify(versions.body).includes(text), 'Private learning leaked into an approved version');
  }
}

export function verifyPrivateLearningPdf(path) {
  const text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' });
  for (const sentinel of learningSentinels) assert.ok(!text.includes(sentinel), 'Private learning leaked into the generated PDF');
}
