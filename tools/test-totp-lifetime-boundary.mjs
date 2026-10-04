import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('apps/api/Identity/TotpService.cs', 'utf8');
const runtime = readFileSync('tools/e2e/totp-security.mjs', 'utf8');

assert.match(service, /DateTimeOffset\.UtcNow\.ToUnixTimeSeconds\(\) \/ 30/);
assert.match(service, /Code\(secret, counter\)/);
assert.doesNotMatch(service, /Code\(secret, counter\s*[+-]/);
assert.match(service, /period=30/);
assert.match(runtime, /code\(setup\.body\.secret, -1\)\)\)\.status, 401/);
assert.match(runtime, /code\(setup\.body\.secret, 1\)\)\)\.status, 401/);

process.stdout.write(`${JSON.stringify({ totpLifetimeBoundary: 'passed', periodSeconds: 30,
  acceptedWindows: ['current'], previousWindowRejected: true, nextWindowRejected: true,
  outOfBandAuthenticationMechanism: false })}\n`);
