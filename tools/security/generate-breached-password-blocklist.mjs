#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) {
  console.error('Usage: generate-breached-password-blocklist.mjs <source.txt> <output.sha256>');
  process.exit(2);
}

const expectedSourceSha256 = '6b9a57a8a3d8cfce01bd1e0f6892aafdefbdb03c1551351d70f8fb25da29425d';
const source = await readFile(sourcePath);
const actualSourceSha256 = createHash('sha256').update(source).digest('hex');
if (actualSourceSha256 !== expectedSourceSha256)
  throw new Error(`Unexpected source checksum: ${actualSourceSha256}`);

const fingerprints = [...new Set(source.toString('utf8')
  .split(/\r?\n/u)
  .filter(password => password.length >= 14 && password.length <= 128)
  .map(password => createHash('sha256')
    .update(password.normalize('NFKC').toLocaleLowerCase('und'), 'utf8')
    .digest('hex')))]
  .sort()
  .map(value => Buffer.from(value, 'hex'));

await writeFile(outputPath, Buffer.concat(fingerprints));
console.log(`Wrote ${fingerprints.length} sorted SHA-256 fingerprints to ${outputPath}.`);
