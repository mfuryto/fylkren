import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function repeatedOptions(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

function safeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const api = option('--api', process.env.FYLKREN_SBOM_API_IMAGE);
const web = option('--web', process.env.FYLKREN_SBOM_WEB_IMAGE);
const output = resolve(option('--output', 'output/sbom'));
const explicitImages = repeatedOptions('--image').map(value => {
  const separator = value.indexOf('=');
  if (separator <= 0 || separator === value.length - 1) throw new Error(`Invalid --image value ${value}; expected ROLE=REFERENCE.`);
  return [value.slice(0, separator), value.slice(separator + 1)];
});
const images = explicitImages.length > 0 ? explicitImages : api && web ? [['api', api], ['web', web]] : [];
if (images.length === 0) throw new Error('Provide one or more --image ROLE=REFERENCE values, or the compatible --api and --web image references.');
assert.equal(new Set(images.map(([role]) => role)).size, images.length, 'Image roles must be unique');

assert.match(run('trivy', ['--version']), /^Version:/, 'Trivy is required');
mkdirSync(output, { recursive: true });
const sourceCommit = run('git', ['rev-parse', 'HEAD']);
const generatedAt = new Date().toISOString();
const artifacts = [];

for (const [role, reference] of images) {
  const inspected = JSON.parse(run('docker', ['image', 'inspect', reference]))[0];
  assert.match(inspected.Id, /^sha256:[0-9a-f]{64}$/);
  const filename = `${role}-${safeName(inspected.Id)}.cyclonedx.json`;
  const path = resolve(output, filename);
  run('trivy', ['image', '--quiet', '--format', 'cyclonedx', '--output', path, inspected.Id]);
  const bom = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(bom.bomFormat, 'CycloneDX');
  assert.ok(/^1\.[4-9]$/.test(bom.specVersion), `Unsupported CycloneDX version ${bom.specVersion}`);
  assert.ok(Array.isArray(bom.components) && bom.components.length > 0, `${role} SBOM has no components`);
  const operatingSystem = bom.components.filter(component => component.type === 'operating-system' || component.properties?.some(property => property.name === 'aquasecurity:trivy:PkgType' && ['ubuntu', 'alpine'].includes(property.value))).length;
  const application = bom.components.filter(component => component.purl?.startsWith('pkg:nuget/') || component.purl?.startsWith('pkg:npm/')).length;
  assert.ok(operatingSystem > 0, `${role} SBOM has no operating-system package evidence`);
  if (['api', 'data-protection-init'].includes(role))
    assert.ok(application > 0, `${role} image SBOM has no application dependency evidence`);
  artifacts.push({ role, requestedReference: reference, imageId: inspected.Id, repoDigests: inspected.RepoDigests ?? [], filename, sha256: sha256(path), components: bom.components.length, operatingSystemComponents: operatingSystem, applicationComponents: application });
}

const sourceFilename = 'source-dependencies.cyclonedx.json';
const sourcePath = resolve(output, sourceFilename);
run('trivy', ['fs', '--quiet', '--format', 'cyclonedx', '--output', sourcePath, '--skip-dirs', 'node_modules', '--skip-dirs', 'apps/api/bin', '--skip-dirs', 'apps/api/obj', '.']);
const sourceBom = JSON.parse(readFileSync(sourcePath, 'utf8'));
assert.equal(sourceBom.bomFormat, 'CycloneDX');
const npmComponents = sourceBom.components.filter(component => component.purl?.startsWith('pkg:npm/')).length;
const nugetComponents = sourceBom.components.filter(component => component.purl?.startsWith('pkg:nuget/')).length;
assert.ok(npmComponents > 0, 'source SBOM has no npm components');
assert.ok(nugetComponents > 0, 'source SBOM has no NuGet components');
artifacts.push({ role: 'source-dependencies', sourceCommit, filename: sourceFilename, sha256: sha256(sourcePath), components: sourceBom.components.length, npmComponents, nugetComponents });

const manifest = {
  schema: 'fylkren-release-sbom-manifest/v1',
  sourceCommit,
  generatedAt,
  generator: run('trivy', ['--version']).split('\n')[0],
  format: 'CycloneDX JSON',
  artifacts,
};
writeFileSync(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ releaseSbom: 'passed', sourceCommit, artifacts: artifacts.map(({ role, imageId, components, sha256 }) => ({ role, imageId, components, sha256 })) }));
