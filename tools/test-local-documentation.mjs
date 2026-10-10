import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const shell = readFileSync('shared/frontend/src/product-shell.tsx', 'utf8');
const profileItem = shell.indexOf('{onProfile && <button');
const documentationItem = shell.indexOf('{documentationHref && <a');
const signOutItem = shell.indexOf('{onSignOut && <button');
assert.ok(profileItem >= 0 && profileItem < documentationItem, 'Profile must be the first account-menu action');
assert.ok(documentationItem < signOutItem, 'Documentation must be directly above Sign out');

const main = readFileSync('apps/web/src/main.tsx', 'utf8');
assert.match(main, /documentationHref="\/documentation\/"/);
assert.match(main, /documentation: translate\(baseLanguage, "documentation"\)/);

execFileSync(process.execPath, ['build-local-documentation.mjs'], { cwd: 'apps/web', stdio: 'inherit' });

const version = readFileSync('VERSION', 'utf8').trim();
const outputRoot = 'apps/web/.generated-public/documentation';
const index = readFileSync(path.join(outputRoot, 'index.html'), 'utf8');
assert.match(index, new RegExp(`Version ${version.replaceAll('.', '\\.').replaceAll('-', '\\-')}`));
assert.match(index, /administration\/USER_MANUAL\.html/);

function filesBelow(directory) {
  return readdirSync(directory).flatMap(name => {
    const candidate = path.join(directory, name);
    return statSync(candidate).isDirectory() ? filesBelow(candidate) : [candidate];
  });
}

const sourceDocuments = filesBelow('docs').filter(file => file.endsWith('.md'));
const outputDocuments = filesBelow(outputRoot).filter(file => file.endsWith('.html'));
const outputDocumentPaths = new Set(outputDocuments.map(file => path.resolve(file)));
assert.equal(outputDocuments.length, sourceDocuments.length + 5, 'Every maintained document plus five repository documents must be bundled');
for (const output of outputDocuments) {
  const html = readFileSync(output, 'utf8');
  assert.doesNotMatch(html, /href="[^"]+\.md(?:#[^"]*)?"/i, `${output} contains an unconverted Markdown link`);
  for (const [, href] of html.matchAll(/href="([^"]+\.html(?:#[^"]*)?)"/gi)) {
    if (/^[a-z]+:/i.test(href)) continue;
    const [linkedFile, fragment] = href.split('#', 2);
    const target = path.resolve(path.dirname(output), linkedFile);
    assert.ok(outputDocumentPaths.has(target), `${output} links to missing local page ${href}`);
    if (fragment)
      assert.match(readFileSync(target, 'utf8'), new RegExp(`id="${fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), `${output} links to missing heading ${href}`);
  }
}

console.log(JSON.stringify({
  localDocumentation: 'passed',
  version,
  bundledDocumentationPages: outputDocuments.length,
  accountMenuOrder: ['profile', 'documentation', 'signOut'],
}));
