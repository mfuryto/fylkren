import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const bytes = readFileSync('apps/api/Identity/breached-passwords.sha256');
const common = readFileSync('apps/api/Identity/common-passwords.sha256');
const documentation = readFileSync('docs/security/PASSWORD_BLOCKLIST.md', 'utf8');
const generator = readFileSync('tools/security/generate-breached-password-blocklist.mjs', 'utf8');
const policy = readFileSync('apps/api/Identity/PasswordSecurityPolicy.cs', 'utf8');

assert.equal(bytes.length, 8249 * 32, 'The breached-password resource must contain the reviewed compatible set');
for (let offset = 32; offset < bytes.length; offset += 32)
  assert.ok(Buffer.compare(bytes.subarray(offset - 32, offset), bytes.subarray(offset, offset + 32)) < 0,
    'Breached-password fingerprints must be unique and sorted');
for (const password of ['__GettingCloser#@@', '__iSwDev202002', '_!Habluetzel8421']) {
  const fingerprint = createHash('sha256').update(password.normalize('NFKC').toLowerCase()).digest();
  assert.ok(bytes.includes(fingerprint), `Known policy-compatible breached password is missing: ${password}`);
  assert.ok(!common.includes(fingerprint), `Breached-password evidence must not depend on the common-password set: ${password}`);
}
assert.match(generator, /6b9a57a8a3d8cfce01bd1e0f6892aafdefbdb03c1551351d70f8fb25da29425d/);
assert.match(policy, /LoadFingerprints\("breached-passwords\.sha256"\)/);
for (const value of ['8,249 sorted SHA-256 fingerprints', 'Fortinet breach',
  'raw breach list is used only as generator input and is not distributed'])
  assert.ok(documentation.includes(value), `Breached-password documentation is missing: ${value}`);

process.stdout.write(`${JSON.stringify({ breachedPasswordBoundary: 'passed', fingerprints: 8249,
  fingerprintBytes: 32, sortedUnique: true, knownBreachedCases: 3,
  independentFromCommonSet: true, pinnedPiiFreeSource: true })}\n`);
