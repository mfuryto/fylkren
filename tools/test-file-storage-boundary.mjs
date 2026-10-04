import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profile = readFileSync('apps/api/Identity/IdentityProfileEndpoints.cs', 'utf8');
const branding = readFileSync('apps/api/Platform/BrandingEndpoints.cs', 'utf8');
const portability = readFileSync('apps/api/Portability/PortabilityEndpoints.cs', 'utf8');
const program = readFileSync('apps/api/Program.cs', 'utf8');
const identityModel = readFileSync('apps/api/Persistence/OrganizationIdentityModelConfiguration.cs', 'utf8');
const platformModel = readFileSync('apps/api/Persistence/PlatformModelConfiguration.cs', 'utf8');
const compose = readFileSync('compose.yaml', 'utf8');
const webDockerfile = readFileSync('apps/web/Dockerfile', 'utf8');
const nginx = readFileSync('apps/web/nginx.conf', 'utf8');

assert.match(profile, /SetProfileImage\(validatedImage\.Bytes, validatedImage\.ContentType\)/);
assert.match(branding, /SetLogo\(validatedLogo\.Bytes, validatedLogo\.ContentType\)/);
assert.match(identityModel, /ProfileImage\).*HasColumnName\("profile_image"\)/);
assert.match(platformModel, /branding\.Property\(value => value\.Logo\).*HasColumnName\("logo"\)/);
assert.match(profile, /Results\.File\(identity\.Person\.ProfileImage,/);
assert.match(branding, /Results\.File\(value\.Logo,/);
assert.match(portability, /Results\.File\(content, "application\/zip"/);
assert.doesNotMatch(program, /UseStaticFiles|UseFileServer/);
for (const source of [profile, branding, portability])
  assert.doesNotMatch(source, /PhysicalFile|File\.(?:Write|Create|Move)|new FileStream/);

assert.equal((compose.match(/read_only: true/g) ?? []).length, 2, 'Web/API root filesystems must remain read-only');
assert.ok((compose.match(/noexec/g) ?? []).length >= 3, 'Writable web/API temporary filesystems must remain noexec');
assert.match(webDockerfile, /COPY --from=build \/src\/apps\/web\/dist \/usr\/share\/nginx\/html/);
assert.match(nginx, /root \/usr\/share\/nginx\/html;/);
assert.match(nginx, /try_files \$uri \$uri\/ \/index\.html;/);

process.stdout.write(`${JSON.stringify({ fileStorageBoundary: 'passed', serverMultipartFeatures: 3,
  databaseStoredUploads: 2, generatedInMemoryDownloads: 1, publicUploadDirectories: 0,
  readOnlyApplicationContainers: 2, noexecTemporaryMounts: 3 })}\n`);
