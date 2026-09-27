import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

export function verifyMultiPageClassifiedPdf(path) {
  const info = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
  const pages = Number(/^Pages:\s+(\d+)$/m.exec(info)?.[1]);
  assert.ok(pages >= 3, `Expected at least three PDF pages, received ${pages}`);
  assert.match(info, /^Page size:\s+594\.\d+ x 841\.\d+ pts \(A4\)$/m);
  assert.match(info, /^Form:\s+none$/m);
  assert.match(info, /^JavaScript:\s+no$/m);
  assert.match(info, /^Encrypted:\s+no$/m);

  const text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' });
  const pageText = text.split('\f').filter(value => value.trim());
  assert.equal(pageText.length, pages, 'Extracted page count differs from pdfinfo');
  pageText.forEach((value, index) => {
    const markings = value.match(/\bCONFIDENTIAL\b/g) ?? [];
    assert.equal(markings.length, 2,
      `Page ${index + 1} does not contain both classification markings`);
    assert.ok(value.replace(/\bCONFIDENTIAL\b/g, '').trim().length >= 40,
      `Page ${index + 1} contains no substantive report content`);
  });
  assert.match(text, /Synthetic Report Author/);
  assert.match(text, /Synthetic Report Approver/);
  assert.match(text, /Task completed\./);
  assert.match(text, /Final verification marker\./);
  return { pages, bytes: statSync(path).size };
}
