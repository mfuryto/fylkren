import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : entry.name.endsWith('.cs') ? [path] : [];
  });
}

const sources = files('apps/api').map(path => ({
  path: relative('.', path).replaceAll('\\', '/'), source: readFileSync(path, 'utf8'),
}));
const methods = ['Get', 'Post', 'Put', 'Patch', 'Delete'];
const operationCount = sources.reduce((total, file) => total + methods.reduce((count, method) =>
  count + [...file.source.matchAll(new RegExp(`\\.Map${method}\\(`, 'g'))].length, 0), 0);
assert.equal(operationCount, 295, 'Route inventory changed; reconcile function authorization before accepting it');

const anonymousByFile = Object.fromEntries(sources.map(file => [file.path,
  [...file.source.matchAll(/\.AllowAnonymous\(/g)].length]).filter(([, count]) => count > 0));
assert.deepEqual(anonymousByFile, {
  'apps/api/Federation/FederationCancellationReceiveEndpoints.cs': 1,
  'apps/api/Federation/FederationCapabilityEndpoints.cs': 1,
  'apps/api/Federation/FederationCatalogEndpoints.cs': 1,
  'apps/api/Federation/FederationGrantCheckEndpoints.cs': 1,
  'apps/api/Federation/FederationIdentityDiscoveryEndpoints.cs': 1,
  'apps/api/Federation/FederationKeyRotationEndpoints.cs': 1,
  'apps/api/Federation/FederationOfficialAnswerReceiveEndpoints.cs': 1,
  'apps/api/Federation/FederationProbeEndpoints.cs': 1,
  'apps/api/Federation/FederationProgressReceiveEndpoints.cs': 1,
  'apps/api/Federation/FederationWorkReceiveEndpoints.cs': 1,
  'apps/api/Identity/DirectoryEndpoints.cs': 1,
  'apps/api/Identity/IdentityEndpoints.cs': 5,
  'apps/api/Identity/OidcEndpoints.cs': 1,
  'apps/api/Identity/SamlEndpoints.cs': 1,
  'apps/api/Identity/WebAuthnEndpoints.cs': 2,
  'apps/api/Platform/BrandingEndpoints.cs': 2,
  'apps/api/Platform/PublicConfigurationEndpoints.cs': 1,
  'apps/api/Program.cs': 1,
}, 'Anonymous route set changed; every exception requires an explicit security review');

const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
assert.match(registration, /FallbackPolicy = new AuthorizationPolicyBuilder\(\)\s*\.RequireAuthenticatedUser\(\)/);
assert.match(registration, /AddPolicy\("MachineApi", policy => policy\.RequireAuthenticatedUser\(\)\.RequireClaim\("fylkren:machine_id"\)\)/);

const anonymousFederationFiles = Object.keys(anonymousByFile).filter(path => path.includes('/Federation/'));
for (const path of anonymousFederationFiles) {
  const source = sources.find(candidate => candidate.path === path).source;
  assert.match(source, /Request\.IsHttps/, `${path} does not enforce its transport boundary`);
  if (!path.endsWith('FederationIdentityDiscoveryEndpoints.cs'))
    assert.match(source, /(?:FederationProbeProtocol|FederationKeyRotationProtocol)\.Verify/,
      `${path} does not enforce signed peer authentication`);
}
assert.match(sources.find(file => file.path.endsWith('FederationIdentityDiscoveryEndpoints.cs')).source,
  /FederationProbeProtocol\.Sign/);

const platform = readFileSync('apps/api/Platform/PlatformOperationsEndpoints.cs', 'utf8');
assert.match(platform, /RequireRole\("PlatformManager"\)/);
const cryptographicMaintenance = readFileSync('apps/api/Platform/CryptoReprotectionEndpoints.cs', 'utf8');
assert.match(cryptographicMaintenance, /RequireRole\("PlatformManager"\)/);
assert.match(cryptographicMaintenance, /IsRequestValidAsync[\s\S]*RequireRateLimiting\("costly-operation"\)/);
const site = readFileSync('apps/api/Organization/AccessAuthorization.cs', 'utf8') +
  readFileSync('apps/api/Organization/OrganizationAuthorization.cs', 'utf8');
assert.match(site, /CanAdministerSite/);
assert.match(site, /SiteManagerAssignments/);
const operational = readFileSync('apps/api/WorkManagement/WorkItemPolicy.cs', 'utf8');
for (const policy of ['CanManageItem', 'CanReadReportsAtLevel', 'CanReadWorkTree']) assert.match(operational, new RegExp(policy));

const machine = readFileSync('apps/api/Platform/AdministrationApiEndpoints.cs', 'utf8') +
  readFileSync('apps/api/Platform/AdministrationUserEndpoints.cs', 'utf8') +
  readFileSync('apps/api/Platform/AdministrationClassificationEndpoints.cs', 'utf8') +
  readFileSync('apps/api/Platform/ReportApiEndpoints.cs', 'utf8');
for (const scope of ['sites:read', 'sites:write', 'sites:move', 'sites:deactivate', 'users:read',
  'users:assign', 'users:move', 'users:deactivate', 'classifications:read', 'classifications:write', 'reports:read'])
  assert.ok(machine.includes(`RequireClaim("scope", "${scope}")`), `Missing machine scope enforcement: ${scope}`);

const dynamic = readFileSync('tools/e2e/authorization-boundaries.mjs', 'utf8');
for (const boundary of ['Platform work overview', 'Site Manager task creation', 'Sibling section details',
  'Unrelated site overview', 'Foreign organization through Site Manager', 'Foreign object under authorized site route'])
  assert.ok(dynamic.includes(boundary), `Maintained negative authorization case is missing: ${boundary}`);

process.stdout.write(`${JSON.stringify({
  functionAuthorizationInventory: 'passed', operationCount, anonymousDeclarations: 24,
  globalAuthenticatedFallback: true,
  policyFamilies: ['platform-role', 'site-manager-assignment', 'operational-role-level', 'machine-scope', 'signed-federation'],
  maintainedNegativeRoleBoundaries: 6,
})}\n`);
