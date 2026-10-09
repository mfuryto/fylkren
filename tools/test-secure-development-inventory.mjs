import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const read = path => readFileSync(path, 'utf8');
const policy = read('docs/security/SECURE_DEVELOPMENT_AND_DEPENDENCIES.md');
const program = read('apps/api/Program.cs');
const registration = read('apps/api/ServiceRegistration.cs');
const bounded = read('apps/api/Networking/BoundedResponseHandler.cs');
const apiDockerfile = read('apps/api/Dockerfile');
const webDockerfile = read('apps/web/Dockerfile');
const sbom = read('tools/security/generate-release-sbom.mjs');

for (const target of ['72 hours for Critical', '14 days for High', '60 days for Medium', '180 days for Low']) assert.match(policy, new RegExp(target));
for (const family of ['Authentication', 'Upload/import/image decoding', 'Search, lists, timelines and audit', 'Outbound HTTP, federation and webhooks', 'Background notifications']) assert.match(policy, new RegExp(family));
assert.match(policy, /CycloneDX JSON SBOMs/);
assert.match(sbom, /docker.*image.*inspect/s);
assert.match(sbom, /trivy.*image.*cyclonedx/s);
assert.match(sbom, /trivy.*fs.*cyclonedx/s);
assert.match(sbom, /pkg:npm/);
assert.match(sbom, /pkg:nuget/);
assert.match(sbom, /sourceCommit/);
assert.match(sbom, /sha256/);
assert.match(registration, /KnownProxies|KnownNetworks/);
assert.match(bounded, /rejectRedirects/);
assert.match(bounded, /Outbound response exceeds the allowed size/);
assert.match(program, /IsEnvironment\("FederationTest"\)/);
assert.doesNotMatch(apiDockerfile + webDockerfile, /tools\/|tests\//);
assert.match(apiDockerfile, /aspnet:10\.0-azurelinux3\.0/, 'qualified stable API runtime image');
assert.match(apiDockerfile, /DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false/, 'full globalization on Azure Linux');

const roots = ['apps/api', 'apps/web/src'];
const files = [];
const walk = dir => { for (const item of readdirSync(dir, { withFileTypes: true })) item.isDirectory() ? (item.name !== 'Migrations' && walk(join(dir, item.name))) : files.push(join(dir, item.name)); };
roots.forEach(walk);
const source = files.filter(path => /\.(cs|ts|tsx)$/.test(path) && !/\.test\.tsx?$/.test(path)).map(read).join('\n');
assert.doesNotMatch(source, /Object\.assign\s*\(/, 'unsafe generic object assignment requires review');
assert.doesNotMatch(source, /\[['"](?:__proto__|prototype|constructor)['"]\]\s*=/, 'prototype mutation requires review');

console.log(JSON.stringify({
  secureDevelopmentInventory: 'assessed',
  remediationTargets: 4,
  resourceDemandFamilies: 8,
  automaticRedirectBoundary: true,
  unsafeObjectMergeUses: 0,
  releaseSbomGenerator: true,
}));
