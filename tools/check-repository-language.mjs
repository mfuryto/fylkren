import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const root = resolve(import.meta.dirname, '..');
const norwegianCatalog = 'apps/web/src/localization/catalogs/nb-NO';
const baselinePath = resolve(root, 'tools/repository-language-baseline.json');
const checkedExtensions = new Set(['.cs', '.json', '.md', '.mjs', '.sh', '.ts', '.tsx', '.yaml', '.yml']);
const ignoredDirectories = new Set(['.git', '.git-local', 'backups', 'bin', 'dist', 'node_modules', 'obj', 'output', 'tmp']);
const norwegianCharacters = /[æøåÆØÅ]/g;
const norwegianWords = /\b(?:ikke|eller|skal|lagre|slette|endre|opprette|oppdrag|innstilling(?:er)?|språk|tidssone|målesystem|velg|ingen|nettleser|pålogging|varsling(?:er)?|utførelse|godkjenning)\b/gi;

function allFiles(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    if (ignoredDirectories.has(name)) continue;
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) files.push(...allFiles(path));
    else if (checkedExtensions.has(extname(name))) files.push(path);
  }
  return files;
}

function markerCounts() {
  const counts = {};
  for (const absolutePath of allFiles(root)) {
    const path = relative(root, absolutePath);
    if (path === norwegianCatalog || path.startsWith(`${norwegianCatalog}/`)) continue;
    const content = readFileSync(absolutePath, 'utf8');
    const count = (content.match(norwegianCharacters)?.length ?? 0) +
      (content.match(norwegianWords)?.length ?? 0);
    if (count) counts[path] = count;
  }
  return counts;
}

const full = process.argv.includes('--full');
const writeBaseline = process.argv.includes('--write-baseline');
const current = markerCounts();
if (writeBaseline) {
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(current).length} legacy paths to ${relative(root, baselinePath)}.`);
  process.exit(0);
}
const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {};
const findings = Object.entries(current)
  .filter(([path, count]) => full ? count > 0 : count > (baseline[path] ?? 0))
  .map(([path, count]) => `${path}: ${count} marker(s); baseline ${baseline[path] ?? 0}`);
if (findings.length) {
  console.error(`${full ? 'Repository' : 'New or increased content'} contains Norwegian outside ${norwegianCatalog}:`);
  for (const finding of findings.slice(0, 100)) console.error(`- ${finding}`);
  if (findings.length > 100) console.error(`- ... ${findings.length - 100} additional findings`);
  process.exitCode = 1;
} else {
  console.log(full
    ? `Full repository language check passed; Norwegian is confined to ${norwegianCatalog}.`
    : `Repository language baseline did not increase. New files must be English; legacy markers may only decrease.`);
}
