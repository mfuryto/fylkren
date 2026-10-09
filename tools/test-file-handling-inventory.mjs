import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const documentation = readFileSync('docs/security/FILE_HANDLING.md', 'utf8');
const sourceFiles = [
  'apps/api/Identity/IdentityProfileEndpoints.cs',
  'apps/api/Platform/BrandingEndpoints.cs',
  'apps/api/Portability/PortabilityEndpoints.cs',
  'apps/api/WorkManagement/PrimaryDocumentEndpoints.cs',
];
const formReaders = sourceFiles.flatMap(path =>
  [...readFileSync(path, 'utf8').matchAll(/ReadFormAsync\(/g)].map(() => path));
assert.equal(formReaders.length, 4, 'Review and document every server multipart reader');

for (const marker of [
  'PUT /api/profile/image',
  'PUT /api/platform/branding/logo',
  'POST /api/portability/sites/{siteId}/imports/validate',
  'POST /api/work/sites/{siteId}/items/{itemId}/primary-document',
  'Enterprise licence selection',
  'Export custody confirmation',
  '16 MiB aggregate declared entry length; 250 entries',
  'fully decodes and re-encodes supported raster uploads',
  'Validation is not antivirus scanning',
  '100,000 extracted characters',
]) assert.ok(documentation.includes(marker), `File inventory is missing: ${marker}`);

const imagePolicy = readFileSync('apps/api/SafeImageUpload.cs', 'utf8');
assert.match(imagePolicy, /MaximumBytes = 2 \* 1024 \* 1024/);
assert.match(imagePolicy, /MaximumDimension = 4096/);
assert.match(imagePolicy, /SKBitmap\.Decode/);
assert.match(imagePolicy, /bitmap\.Encode/);
for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
  assert.ok(imagePolicy.includes(`"${type}"`), `Image policy changed without inventory review: ${type}`);
  assert.ok(documentation.includes(type), `Image type is absent from the inventory: ${type}`);
}

const portability = readFileSync('apps/api/Portability/PortableExportPackage.cs', 'utf8');
assert.match(portability, /MaximumPackageBytes = 16L \* 1024 \* 1024/);
assert.match(portability, /MaximumImportRequestBytes = MaximumPackageBytes \+ 1024 \* 1024/);
assert.match(portability, /MaximumEntries = 250/);
const webGateway = readFileSync('apps/web/nginx.conf', 'utf8');
assert.match(webGateway, /primary-document\$" \{\s*client_max_body_size 9m;/s,
  'Primary-document gateway limit must include the documented 8 MiB file plus multipart overhead');

const serverFileResults = sourceFiles.flatMap(path =>
  [...readFileSync(path, 'utf8').matchAll(/Results\.File\(/g)].map(() => path));
assert.equal(serverFileResults.length, 3, 'Review and document every server file response');

process.stdout.write(`${JSON.stringify({ fileHandlingInventory: 'passed',
  serverMultipartFeatures: formReaders.length, browserOnlyFileSelections: 2,
  serverFileResponses: serverFileResults.length, imageMaximumMiB: 2,
  portabilityMaximumMiB: 16, portabilityMaximumEntries: 250,
  primaryDocumentMaximumMiB: 8,
  knownMalwareScannerPresent: false })}\n`);
