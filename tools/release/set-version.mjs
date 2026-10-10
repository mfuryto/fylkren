import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { validateTransition } from './version-policy.mjs';

const argumentsAfterScript = process.argv.slice(2);
const rootOption = process.argv.indexOf('--root');
const nextValue = argumentsAfterScript[0];
const root = path.resolve(rootOption >= 0 ? process.argv[rootOption + 1] : '.');
const dryRun = process.argv.includes('--dry-run');
if (!nextValue) throw new Error('Usage: node tools/release/set-version.mjs VERSION [--dry-run]');

const versionPath = path.join(root, 'VERSION');
const propsPath = path.join(root, 'Directory.Build.props');
const readmePath = path.join(root, 'README.md');
const current = readFileSync(versionPath, 'utf8').trim();
validateTransition(current, nextValue);

const replacements = [
  [versionPath, `${nextValue}\n`],
  [propsPath, readFileSync(propsPath, 'utf8').replace(`<Version>${current}</Version>`, `<Version>${nextValue}</Version>`)],
  [readmePath, readFileSync(readmePath, 'utf8').replace(`<code>VERSION ${current}</code>`, `<code>VERSION ${nextValue}</code>`)],
];
for (const [file, content] of replacements) {
  if (file !== versionPath && content === readFileSync(file, 'utf8'))
    throw new Error(`${path.basename(file)} does not contain the current version ${current}.`);
  if (!dryRun) writeFileSync(file, content);
}

console.log(JSON.stringify({ versionTransition: dryRun ? 'validated' : 'updated', current, next: nextValue,
  files: ['VERSION', 'Directory.Build.props', 'README.md'] }));
