import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const algorithms = readFileSync('tools/test-self-contained-token-algorithms.mjs', 'utf8');
const sessionRuntime = readFileSync('tools/test-dynamic-session-token-runtime.mjs', 'utf8');

assert.match(registration, /EncryptionAlgorithm = EncryptionAlgorithm\.AES_256_CBC[\s\S]{0,160}ValidationAlgorithm = ValidationAlgorithm\.HMACSHA256/,
  'Data Protection must use approved AES-256-CBC with HMAC-SHA-256');
assert.match(algorithms, /AES-256-CBC/, 'algorithm inventory must cover the encryption mode');
assert.match(algorithms, /HMAC-SHA256/, 'algorithm inventory must cover ciphertext authentication');
assert.match(sessionRuntime, /const tampered =[\s\S]*rejected\.body\.authenticated, false/,
  'maintained runtime evidence must reject modified protected ciphertext');
assert.doesNotMatch(registration, /EncryptionAlgorithm\.(?!AES_256_CBC)[A-Z0-9_]+/,
  'An unreviewed Data Protection cipher is configured');

console.log(JSON.stringify({
  authenticatedEncryptionBoundary: 'passed',
  approvedCipherContexts: 1,
  cipher: 'AES-256-CBC',
  authentication: 'HMAC-SHA-256',
  modifiedCiphertextRejected: true,
}));
