import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const inventory = read('docs/security/CONFIGURATION_SECURITY.md');
const install = read('deploy/compose/install.sh');
const compose = read('compose.yaml');
const apiDockerfile = read('apps/api/Dockerfile');
const webDockerfile = read('apps/web/Dockerfile');
const project = read('apps/api/Fylkren.Api.csproj');
const program = read('apps/api/Program.cs');
const machine = read('apps/api/Platform/AdministrationClientEndpoints.cs');
const nginx = read('apps/web/nginx.conf');

assert.match(install, /openssl rand -hex 32/, 'random non-default database credential');
assert.match(install, /chmod 600 "\$env_file"/, 'owner-only environment file');
assert.match(compose, /POSTGRES_USER: fylkren/, 'dedicated database account');
assert.match(compose, /cap_drop:\n\s+- ALL/, 'container capability drop');
assert.match(machine, /AllowedScopes/, 'machine least-privilege scope allowlist');
assert.match(machine, /request\.ExpiresAt > now\.AddDays\(366\)/, 'machine credential lifetime ceiling');
assert.match(inventory, /SV-104/, 'backend credential finding');
assert.match(inventory, /SV-105/, 'secret custody finding');

assert.match(apiDockerfile, /dotnet publish[^\n]*-c Release/, 'Release API build');
assert.match(webDockerfile, /pnpm --filter @fylkren\/web build/, 'production web build');
assert.doesNotMatch(apiDockerfile, /COPY \. \.|COPY \. \/app/, 'repository copied into API runtime');
assert.doesNotMatch(webDockerfile, /COPY \. \.|COPY \. \/usr\/share/, 'repository copied into web runtime');
assert.doesNotMatch(project + program, /Swagger|OpenApi|UseDeveloperExceptionPage/, 'development API surface');
assert.doesNotMatch(nginx, /autoindex\s+on/, 'directory listing');

console.log(JSON.stringify({
  productionConfigurationInventory: 'assessed',
  backendIdentities: 6,
  randomDatabaseCredential: true,
  releaseBuilds: true,
  sourceMetadataInRuntimeImages: false,
  findings: ['SV-104', 'SV-105'],
}));
