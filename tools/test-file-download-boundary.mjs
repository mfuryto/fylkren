import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const image = readFileSync('apps/api/SafeImageUpload.cs', 'utf8');
const profile = readFileSync('apps/api/Identity/IdentityProfileEndpoints.cs', 'utf8');
const branding = readFileSync('apps/api/Platform/BrandingEndpoints.cs', 'utf8');
const portability = readFileSync('apps/api/Portability/PortabilityEndpoints.cs', 'utf8');

assert.match(image, /"image\/png" => "\.png"/);
assert.match(image, /"image\/jpeg" => "\.jpg"/);
assert.match(image, /"image\/webp" => "\.webp"/);
assert.match(image, /_ => "\.bin"/);
assert.match(profile, /inline; filename=\\"profile-image\{SafeImageUpload\.DownloadExtension\(contentType\)\}\\"/);
assert.match(branding, /inline; filename=\\"branding-logo\{SafeImageUpload\.DownloadExtension\(contentType\)\}\\"/);
assert.match(portability, /fylkren-site-\{siteId:N\}-export\.zip/);
for (const source of [profile, branding, portability]) {
  assert.doesNotMatch(source, /file\.FileName[^\n]*(?:ContentDisposition|Results\.File)/,
    'A caller-controlled upload filename reached a download response');
}

process.stdout.write(`${JSON.stringify({ fileDownloadBoundary: 'passed', fileResponses: 3,
  callerControlledResponseFilenames: 0, fixedInlineImageNames: 2,
  serverGeneratedAttachmentNames: 1, allowlistedImageExtensions: 3 })}\n`);
