import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url);
const text = path => readFileSync(new URL(path, root), 'utf8');
function files(path) {
  const absolute = new URL(path, root).pathname;
  return readdirSync(absolute).flatMap(name => {
    const child = join(absolute, name);
    if (statSync(child).isDirectory()) return files(`${path}/${name}`);
    return [{ path: relative(new URL('.', root).pathname, child), body: readFileSync(child, 'utf8') }];
  });
}

const packageJson = JSON.parse(text('apps/web/package.json'));
const tsconfig = JSON.parse(text('apps/web/tsconfig.json'));
assert.equal(tsconfig.compilerOptions.target, 'ES2022', 'The web build must target a supported JavaScript platform');
assert.deepEqual(Object.keys(packageJson.dependencies).sort(), ['@fylkren/ui', 'qrcode', 'react', 'react-dom'],
  'Review newly introduced browser runtime dependencies before accepting them');

const client = files('apps/web/src').filter(file => /\.(?:ts|tsx|css)$/.test(file.path) && !/\.test\.[^.]+$/.test(file.path));
const html = [{ path: 'apps/web/index.html', body: text('apps/web/index.html') }];
const production = [...client, ...html];
const prohibited = /<\s*(?:applet|embed|object)\b|ActiveXObject|navigator\.plugins|application\/(?:x-shockwave-flash|x-silverlight)|\b(?:Shockwave|Silverlight|NaCl)\b/gi;
const legacyHits = production.flatMap(file => [...file.body.matchAll(prohibited)].map(match => `${file.path}:${match[0]}`));
assert.deepEqual(legacyHits, [], `Unsupported browser technology found: ${legacyHits.join(', ')}`);

const navigationSink = /(?:window\.)?location\.(?:assign|replace)\s*\(|window\.open\s*\(/g;
const navigationHits = client.flatMap(file => [...file.body.matchAll(navigationSink)].map(match => `${file.path}:${match[0]}`));
assert.deepEqual(navigationHits, ['apps/web/src/auth/LoginPage.tsx:window.location.replace('],
  'Review newly introduced automatic browser navigation sinks');
const login = text('apps/web/src/auth/LoginPage.tsx');
assert.match(login, /window\.location\.replace\(`\/api\/auth\/\$\{automaticSso\}\/login`\)/,
  'Automatic client navigation must remain a same-origin authentication path');
assert.match(login, /const automaticSso = configuration\.authentication\.ssoAutoRedirectProvider/);

const server = files('apps/api').filter(file => file.path.endsWith('.cs'));
const serverBody = server.map(file => file.body).join('\n');
assert.equal((serverBody.match(/Results\.Redirect\s*\(/g) ?? []).length, 0,
  'Review newly introduced server redirect helpers');
assert.equal((serverBody.match(/Results\.Challenge\s*\(/g) ?? []).length, 2,
  'The external provider challenge inventory changed');
assert.equal((serverBody.match(/Response\.Headers\.Location\s*=/g) ?? []).length, 1,
  'The explicit Location header inventory changed');
assert.match(text('apps/api/Platform/AdministrationApiEndpoints.cs'),
  /Response\.Headers\.Location = \$"\/api\/v1\/administration\/sites\/\{site\.Id\}"/,
  'The administration Location header must remain same-origin');
assert.match(text('apps/api/Program.cs'), /UseMiddleware<ExternalAuthenticationRedirectMiddleware>/,
  'External authentication redirects must pass the origin boundary');
assert.match(text('apps/api/Identity/SamlMetadataCache.cs'),
  /ValidateIdentityDestination\(idp\.SingleSignOnServiceUrl, configuration\.MetadataUrl\)/,
  'SAML browser destinations must pass the origin boundary');

process.stdout.write(`${JSON.stringify({
  supportedBrowserTechnology: 'passed',
  javascriptTarget: tsconfig.compilerOptions.target,
  runtimeDependencies: Object.keys(packageJson.dependencies).length,
  productionClientFiles: production.length,
  legacyPluginSinks: legacyHits.length,
  automaticClientNavigationSinks: navigationHits.length,
  automaticExternalProviderFamilies: ['oidc', 'saml'],
  externalDestinationPolicy: 'exact configured origin or deployment allowlist',
})}\n`);
