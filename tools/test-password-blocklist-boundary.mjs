import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const bytes = readFileSync('apps/api/Identity/common-passwords.sha256');
const documentation = readFileSync('docs/security/PASSWORD_BLOCKLIST.md', 'utf8');
const generator = readFileSync('tools/security/generate-password-blocklist.mjs', 'utf8');
assert.equal(bytes.length, 3000 * 32, 'The maintained blocklist must contain exactly 3,000 SHA-256 fingerprints');
for (let offset = 32; offset < bytes.length; offset += 32)
  assert.ok(Buffer.compare(bytes.subarray(offset - 32, offset), bytes.subarray(offset, offset + 32)) < 0,
    'The binary-search password fingerprints must be unique and sorted');
for (const password of ['12345678901234', 'password123456', 'qwertyuiop1234']) {
  const fingerprint = createHash('sha256').update(password.normalize('NFKC').toLowerCase()).digest();
  assert.ok(bytes.includes(fingerprint), `Known policy-compatible common password is missing: ${password}`);
}
assert.match(generator, /\.filter\(password => password\.length >= 14 && password\.length <= 128\)/);
assert.match(generator, /\.slice\(0, 3000\)/);
assert.ok(documentation.includes('first 3,000 entries that satisfy Fylkren\'s 14–128 character password policy'));
process.stdout.write(`${JSON.stringify({ passwordBlocklistBoundary: 'passed', fingerprints: 3000,
  fingerprintBytes: 32, sortedUnique: true, policyCompatibleKnownCases: 3, pinnedSource: true })}\n`);
