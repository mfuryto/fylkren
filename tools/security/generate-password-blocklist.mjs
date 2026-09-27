#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) {
  console.error("Usage: generate-password-blocklist.mjs <source.txt> <output.sha256>");
  process.exit(2);
}

const expectedSourceSha256 = "e9a88f67aafe65496682dc374559ee714e978bee50314767494c3e37a18c9fc8";
const source = await readFile(sourcePath);
const actualSourceSha256 = createHash("sha256").update(source).digest("hex");
if (actualSourceSha256 !== expectedSourceSha256) {
  throw new Error(`Unexpected source checksum: ${actualSourceSha256}`);
}

const fingerprints = [...new Set(source.toString("utf8")
  .split(/\r?\n/u)
  .filter(password => password.length >= 14 && password.length <= 128)
  .map(password => createHash("sha256")
    .update(password.normalize("NFKC").toLocaleLowerCase("und"), "utf8")
    .digest("hex")))]
  .slice(0, 3000)
  .sort()
  .map(value => Buffer.from(value, "hex"));

await writeFile(outputPath, Buffer.concat(fingerprints));
console.log(`Wrote ${fingerprints.length} sorted SHA-256 fingerprints to ${outputPath}.`);
