import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const webRoot = path.join(root, 'apps', 'web');
const manifestPath = path.join(root, 'dev-notes', 'localization', 'LINGUISTIC_REVIEW.json');
const webRequire = createRequire(pathToFileURL(path.join(webRoot, 'package.json')));
const { createServer } = await import(pathToFileURL(webRequire.resolve('vite')));
const server = await createServer({ root: webRoot, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });

function digest(catalog) {
  const entries = Object.entries(catalog).sort(([left], [right]) => left.localeCompare(right));
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

try {
  const [{ languageCatalogs }, { en }] = await Promise.all([
    server.ssrLoadModule('/src/localization/index.ts'),
    server.ssrLoadModule('/src/localization/catalogs/en-US/index.ts'),
  ]);
  const locales = Object.keys(languageCatalogs);
  const sourceKeys = Object.keys(en).sort();
  const sourceCatalogSha256 = digest(en);

  if (process.argv.includes('--initialize')) {
    const manifest = {
      schema: 'fylkren-linguistic-review/v1',
      sourceLocale: 'en-US',
      sourceKeyCount: sourceKeys.length,
      sourceCatalogSha256,
      reviewOrder: locales.filter(locale => locale !== 'en-US'),
      locales: Object.fromEntries(locales.map(locale => [locale, {
        status: locale === 'en-US' ? 'source' : 'pending',
        reviewedKeyCount: 0,
        catalogSha256: digest(languageCatalogs[locale]),
      }])),
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (process.argv.includes('--refresh-pending')) {
    for (const locale of locales) {
      if (['pending', 'in-review'].includes(manifest.locales[locale].status))
        manifest.locales[locale].catalogSha256 = digest(languageCatalogs[locale]);
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const beginLocale = option('--begin');
  if (beginLocale) {
    assert.ok(manifest.reviewOrder.includes(beginLocale), `${beginLocale} is not a derived locale`);
    const firstIncomplete = manifest.reviewOrder.find(locale => manifest.locales[locale].status !== 'verified');
    assert.equal(beginLocale, firstIncomplete, `Complete ${firstIncomplete} before starting ${beginLocale}`);
    manifest.locales[beginLocale].status = 'in-review';
    manifest.locales[beginLocale].catalogSha256 = digest(languageCatalogs[beginLocale]);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const verifyLocale = option('--verify-locale');
  if (verifyLocale) {
    const evidence = option('--evidence');
    assert.equal(manifest.locales[verifyLocale]?.status, 'in-review', `${verifyLocale} is not in review`);
    assert.ok(evidence, 'Provide --evidence with the maintained review record path');
    manifest.locales[verifyLocale] = {
      status: 'verified',
      reviewedKeyCount: sourceKeys.length,
      catalogSha256: digest(languageCatalogs[verifyLocale]),
      verifiedSourceCatalogSha256: sourceCatalogSha256,
      verifiedAt: new Date().toISOString().slice(0, 10),
      evidence: [evidence],
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  assert.equal(manifest.schema, 'fylkren-linguistic-review/v1');
  assert.equal(manifest.sourceLocale, 'en-US');
  assert.equal(manifest.sourceKeyCount, sourceKeys.length, 'The source key count changed; restart affected locale reviews');
  assert.equal(manifest.sourceCatalogSha256, sourceCatalogSha256, 'The English source changed; restart affected locale reviews');
  assert.deepEqual(Object.keys(manifest.locales).sort(), [...locales].sort(), 'The review manifest must contain every registered locale');
  assert.deepEqual(manifest.reviewOrder, locales.filter(locale => locale !== 'en-US'), 'The review order must match the registered derived locales');

  const summary = {};
  for (const locale of locales) {
    const review = manifest.locales[locale];
    const currentHash = digest(languageCatalogs[locale]);
    assert.ok(['source', 'pending', 'in-review', 'verified'].includes(review.status), `${locale} has an invalid review status`);
    assert.equal(review.catalogSha256, currentHash, `${locale} changed after its review inventory was recorded`);
    if (review.status === 'verified') {
      assert.equal(review.reviewedKeyCount, sourceKeys.length, `${locale} does not record a review of every source key`);
      assert.equal(review.verifiedSourceCatalogSha256, sourceCatalogSha256, `${locale} was verified against another source catalog`);
      assert.match(review.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(Array.isArray(review.evidence) && review.evidence.length > 0, `${locale} has no review evidence`);
    }
    summary[review.status] = (summary[review.status] ?? 0) + 1;
  }

  if (process.argv.includes('--require-verified')) {
    const incomplete = locales.filter(locale => locale !== 'en-US' && manifest.locales[locale].status !== 'verified');
    assert.deepEqual(incomplete, [], `Derived locales are not linguistically verified: ${incomplete.join(', ')}`);
  }
  console.log(JSON.stringify({ linguisticReview: 'checked', sourceKeys: sourceKeys.length, locales: locales.length, summary }));
} finally {
  await server.close();
}
