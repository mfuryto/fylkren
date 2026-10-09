import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync('apps/api/Dockerfile', 'utf8');

assert.match(dockerfile, /FROM mcr\.microsoft\.com\/dotnet\/aspnet:10\.0-azurelinux3\.0/,
  'The production API runtime must use the qualified Azure Linux 3.0 base.');
assert.match(dockerfile, /rid=linux-x64[\s\S]*rid=linux-arm64/,
  'Runtime-specific publishing must target glibc for both supported architectures.');
assert.match(dockerfile, /DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false/,
  'Localized sorting and culture handling require full globalization.');
for (const dependency of ['curl', 'krb5-libs', 'tzdata'])
  assert.match(dockerfile, new RegExp(`tdnf install -y[^\n]*\\b${dependency}\\b`),
    `Missing qualified runtime dependency: ${dependency}`);
assert.doesNotMatch(dockerfile, /aspnet:10\.0-alpine|linux-musl-|\bapk\b|apt-get|ubuntu|debian/i,
  'The production API runtime unexpectedly reintroduced an unqualified OS or libc boundary.');

console.log(JSON.stringify({ apiRuntimeImageBoundary: 'passed', os: 'azurelinux3.0',
  runtimeIdentifiers: ['linux-x64', 'linux-arm64'], fullGlobalization: true }));
