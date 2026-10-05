import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    if (path.includes('/Persistence/Migrations/')) return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.cs') ? [path] : [];
  });
}
const files = sourceFiles('apps/api');
const sources = files.map(path => `${path}\n${readFileSync(path, 'utf8')}`).join('\n');
const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');

assert.match(registration, /EncryptionAlgorithm = EncryptionAlgorithm\.AES_256_CBC[\s\S]{0,160}ValidationAlgorithm = ValidationAlgorithm\.HMACSHA256/,
  'AES-CBC must remain authenticated by HMAC-SHA-256 through Data Protection');
assert.doesNotMatch(sources, /CipherMode\.ECB|EncryptionAlgorithm\.[A-Z0-9_]*ECB/,
  'ECB mode is prohibited');
assert.doesNotMatch(sources, /RSAEncryptionPadding\.Pkcs1|RSAEncryptionPadding\.CreateOaep\(HashAlgorithmName\.(?:SHA1|MD5)\)/,
  'Weak RSA encryption padding is prohibited');
assert.doesNotMatch(sources, /(?:DES|TripleDES|RC2)\.Create\(/,
  'Legacy block ciphers are prohibited');
assert.doesNotMatch(sources, /PaddingMode\.Zeros|PaddingMode\.None/,
  'Unauthenticated manual block padding is prohibited');

console.log(JSON.stringify({
  encryptionModeBoundary: 'passed',
  productionSourceFiles: files.length,
  ecbUses: 0,
  weakRsaEncryptionPaddingUses: 0,
  authenticatedCbcContexts: 1,
}));
