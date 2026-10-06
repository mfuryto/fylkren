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
const tlsInitializer = read('apps/tls-init/initialize-internal-tls.sh');
const postgresHba = read('apps/postgres/pg_hba.fylkren.conf');
const postgresIdent = read('apps/postgres/pg_ident.fylkren.conf');

assert.match(install, /chmod 600 "\$env_file"/, 'owner-only environment file');
assert.match(compose, /POSTGRES_USER: fylkren/, 'dedicated database account');
assert.doesNotMatch(compose + install, /FYLKREN_DB_PASSWORD|POSTGRES_PASSWORD/, 'database password in supported deployment');
assert.match(compose, /SSL Certificate=\/run\/fylkren-database-client\/fylkren-api\.crt/, 'API database client certificate');
assert.match(postgresHba, /cert clientcert=verify-full map=fylkren_api/, 'certificate-only database authentication');
assert.match(postgresIdent, /fylkren_api\s+fylkren-api\s+fylkren/, 'least-privilege database identity map');
assert.match(tlsInitializer, /extendedKeyUsage=clientAuth/, 'database client-only certificate purpose');
assert.match(compose, /cap_drop:\n\s+- ALL/, 'container capability drop');
assert.match(machine, /AllowedScopes/, 'machine least-privilege scope allowlist');
assert.match(machine, /request\.ExpiresAt > now\.AddDays\(366\)/, 'machine credential lifetime ceiling');
assert.match(machine, /ApiMachineSignatures\.Create\(\)/, 'request-bound machine signing identity issuance');
assert.match(inventory, /SV-104 is closed/, 'backend credential finding closure');
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
  databaseAuthentication: 'certificate',
  releaseBuilds: true,
  sourceMetadataInRuntimeImages: false,
  findings: ['SV-105'],
}));
