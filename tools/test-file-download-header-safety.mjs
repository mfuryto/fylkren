import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.name.endsWith('.cs') ? [path] : [];
  });
}

const api = sourceFiles('apps/api').map(path => readFileSync(path, 'utf8')).join('\n');
const profile = readFileSync('apps/api/Identity/IdentityProfileEndpoints.cs', 'utf8');
const branding = readFileSync('apps/api/Platform/BrandingEndpoints.cs', 'utf8');
const portability = readFileSync('apps/api/Portability/PortabilityEndpoints.cs', 'utf8');

assert.equal((api.match(/Results\.File\s*\(/g) ?? []).length, 3,
  'Review a new file response before extending the disposition inventory');
assert.equal((api.match(/\.Attachments\.Add\s*\(/g) ?? []).length, 0,
  'Review a new email attachment before extending the filename inventory');
assert.match(profile, /inline; filename=\\"profile-image\{SafeImageUpload\.DownloadExtension\(contentType\)\}\\"/);
assert.match(branding, /inline; filename=\\"branding-logo\{SafeImageUpload\.DownloadExtension\(contentType\)\}\\"/);
assert.match(portability, /Results\.File\(content, "application\/zip", \$"fylkren-site-\{siteId:N\}-export\.zip"\)/);
assert.doesNotMatch([profile, branding, portability].join('\n'),
  /ContentDisposition[^\n]*(?:FileName|DisplayName|Name|Title)/,
  'Untrusted display metadata reached a Content-Disposition header');

for (const name of ['profile-image.png', 'profile-image.jpg', 'profile-image.webp', 'profile-image.bin',
  'branding-logo.png', 'branding-logo.jpg', 'branding-logo.webp', 'branding-logo.bin',
  'fylkren-site-0123456789abcdef0123456789abcdef-export.zip']) {
  assert.match(name, /^[a-z0-9.-]+$/, `${name} is outside the maintained ASCII filename grammar`);
  assert.doesNotMatch(name, /[\r\n";\\/]/, `${name} can alter Content-Disposition structure`);
}

process.stdout.write(`${JSON.stringify({ fileDownloadHeaderSafety: 'passed', fileResponses: 3,
  emailAttachments: 0, callerControlledHeaderFields: 0, asciiFilenameFamilies: 3,
  responseHeaderInjectionCharacters: 0 })}\n`);
