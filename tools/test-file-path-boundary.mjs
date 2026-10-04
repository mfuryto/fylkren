import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const image = readFileSync('apps/api/SafeImageUpload.cs', 'utf8');
const exportPackage = readFileSync('apps/api/Portability/PortableExportPackage.cs', 'utf8');
const importValidator = readFileSync('apps/api/Portability/PortableImportValidator.cs', 'utf8');
const profile = readFileSync('apps/api/Identity/IdentityProfileEndpoints.cs', 'utf8');
const branding = readFileSync('apps/api/Platform/BrandingEndpoints.cs', 'utf8');
const portability = readFileSync('apps/api/Portability/PortabilityEndpoints.cs', 'utf8');

assert.match(image, /Path\.GetExtension\(fileName \?\? ""\)/);
assert.doesNotMatch(image, /WriteAllBytes|CreateDirectory|FileStream|PhysicalFile/);
for (const source of [profile, branding, portability])
  assert.doesNotMatch(source, /PhysicalFile|File\.(?:Write|Create|Move)|new FileStream/);
assert.match(exportPackage, /attachments\/profile-images\/\{person\.Id:N\}\.\{extension\}/);
assert.match(portability, /fylkren-site-\{siteId:N\}-export\.zip/);
assert.match(importValidator, /FullName\.Contains\("\.\."/);
assert.match(importValidator, /FullName\.StartsWith\('\/'\)/);
assert.match(importValidator, /FullName\.StartsWith\('\\\\'\)/);
assert.match(importValidator, /dataset\.Path\.StartsWith\("data\/"/);
assert.match(importValidator, /attachment\.Path\.StartsWith\("attachments\/"/);
assert.doesNotMatch(importValidator, /ExtractTo|File\.(?:Write|Create|Move)|Directory\.(?:Create|Move)/);

process.stdout.write(`${JSON.stringify({ filePathBoundary: 'passed', clientFilenamesPersisted: 0,
  filesystemExtractionSites: 0, generatedPathFamilies: 2, rejectedArchivePathFamilies: 3 })}\n`);
