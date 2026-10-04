import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';
const checked = [];

async function typed(path, status, expectedType, options = {}) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual', ...options });
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, status, `${path}: unexpected status (${bytes.toString('utf8').slice(0, 200)})`);
  assert.ok(bytes.length > 0, `${path}: expected a response body`);
  const contentType = response.headers.get('content-type') ?? '';
  assert.match(contentType, expectedType, `${path}: incorrect Content-Type ${contentType || 'missing'}`);
  if (/^(?:text\/|application\/(?:javascript|json|problem\+json|xml)|image\/svg\+xml)/i.test(contentType))
    assert.match(contentType, /;\s*charset=utf-8\b/i, `${path}: textual body has no explicit UTF-8 charset`);
  checked.push({ path, status, contentType });
  return { response, bytes };
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.cs') ? [path] : [];
  });
}

const apiSource = sourceFiles('apps/api').map(path => readFileSync(path, 'utf8')).join('\n');
assert.equal((apiSource.match(/Results\.File\s*\(/g) ?? []).length, 3,
  'Review newly introduced file-response types before updating the response inventory');
assert.equal((apiSource.match(/Results\.(?:Text|Content)\s*\(/g) ?? []).length, 0,
  'Review newly introduced explicit textual response types');
for (const value of [...apiSource.matchAll(/ContentType\s*=\s*"([^"]+)"/g)].map(match => match[1]))
  assert.equal(value, 'application/problem+json', `Unexpected direct ContentType assignment: ${value}`);

const home = await typed('/', 200, /^text\/html;\s*charset=utf-8\b/i);
const assetPaths = [...home.bytes.toString('utf8').matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)]
  .map(match => match[1]);
assert.ok(assetPaths.some(path => path.endsWith('.js')), 'No versioned JavaScript asset was found');
assert.ok(assetPaths.some(path => path.endsWith('.css')), 'No versioned CSS asset was found');
for (const path of assetPaths) {
  await typed(path, 200, path.endsWith('.css')
    ? /^text\/css;\s*charset=utf-8\b/i
    : /^(?:text|application)\/javascript;\s*charset=utf-8\b/i);
}
await typed('/assets/asvs-media-type-does-not-exist.js', 404, /^text\/html;\s*charset=utf-8\b/i);
await typed('/health', 200, /^text\/plain;\s*charset=utf-8\b/i);
await typed('/api/configuration/public', 200, /^application\/json;\s*charset=utf-8\b/i);

const username = `media-${randomBytes(6).toString('hex')}`;
const password = `M9!${randomBytes(22).toString('base64url')}#t`;
const bootstrap = await typed('/api/bootstrap/platform-manager', 201, /^application\/json;\s*charset=utf-8\b/i, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, displayName: 'Synthetic Media Type Manager',
    email: `${username}@example.invalid`, password }),
});
const bootstrapBody = JSON.parse(bootstrap.bytes.toString('utf8'));
assert.ok(bootstrapBody && typeof bootstrapBody === 'object' && !Array.isArray(bootstrapBody),
  'Bootstrap response did not contain a JSON object');
const session = bootstrap.response.headers.getSetCookie().find(value =>
  value.startsWith('__Host-Fylkren=') || value.startsWith('Fylkren.Session='));
assert.ok(session, 'Bootstrap did not issue an application session');
const sessionPair = session.split(';', 1)[0];

const antiforgery = await typed('/api/security/antiforgery', 200, /^application\/json;\s*charset=utf-8\b/i,
  { headers: { Cookie: sessionPair } });
const token = JSON.parse(antiforgery.bytes.toString('utf8')).token;
const antiforgeryCookie = antiforgery.response.headers.getSetCookie().find(value =>
  value.startsWith('__Host-Fylkren.Antiforgery=') || value.startsWith('Fylkren.Antiforgery='));
assert.ok(token && antiforgeryCookie, 'Antiforgery pair was not issued');
const protectedHeaders = {
  Cookie: `${sessionPair}; ${antiforgeryCookie.split(';', 1)[0]}`,
  'X-Fylkren-CSRF': token,
};

await typed('/api/sites/', 400, /^application\/problem\+json;\s*charset=utf-8\b/i, {
  method: 'POST', headers: { ...protectedHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'x', overviewDesign: 'classic' }),
});
const site = await typed('/api/sites/', 201, /^application\/json;\s*charset=utf-8\b/i, {
  method: 'POST', headers: { ...protectedHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Media type test Site', overviewDesign: 'classic' }),
});
const siteId = JSON.parse(site.bytes.toString('utf8')).id;

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const logoForm = new FormData();
logoForm.append('logo', new Blob([png], { type: 'image/png' }), 'pixel.png');
const logoUpdate = await fetch(`${base}/api/platform/branding/logo`, {
  method: 'PUT', headers: protectedHeaders, body: logoForm,
});
const logoUpdateBytes = Buffer.from(await logoUpdate.arrayBuffer());
assert.equal(logoUpdate.status, 204, logoUpdateBytes.toString('utf8'));
assert.equal(logoUpdateBytes.length, 0, '204 response unexpectedly contained a body');
const logo = await typed('/api/branding/logo', 200, /^image\/png$/i);
assert.equal(logo.bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG response body did not match its declared type');

const exported = await typed(`/api/portability/sites/${siteId}/export`, 200, /^application\/zip$/i, {
  method: 'POST', headers: protectedHeaders,
});
assert.equal(exported.bytes.subarray(0, 4).toString('hex'), '504b0304', 'ZIP response body did not match its declared type');
assert.match(exported.response.headers.get('content-disposition') ?? '', /^attachment;/i);

process.stdout.write(`${JSON.stringify({ responseMediaTypes: 'passed', bodyBearingResponseCases: checked.length,
  textualCharsets: 'utf-8', jsonAndProblemJson: true, staticHtmlJsCss: true,
  plainText: true, pngSignature: true, zipSignatureAndAttachment: true,
  explicitApiFileResponseSites: 3 })}\n`);
