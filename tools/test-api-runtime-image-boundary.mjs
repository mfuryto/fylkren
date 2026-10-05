import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync('apps/api/Dockerfile', 'utf8');

assert.match(dockerfile, /FROM mcr\.microsoft\.com\/dotnet\/aspnet:10\.0-alpine/,
  'The production API runtime must use the qualified minimal Alpine base.');
assert.match(dockerfile, /rid=linux-musl-x64[\s\S]*rid=linux-musl-arm64/,
  'Runtime-specific publishing must target musl for both supported architectures.');
assert.match(dockerfile, /DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false/,
  'Localized sorting and culture handling require full globalization.');
for (const dependency of ['curl', 'icu-data-full', 'icu-libs', 'krb5-libs', 'libldap', 'tzdata'])
  assert.match(dockerfile, new RegExp(`apk add --no-cache[^\n]*\\b${dependency}\\b`),
    `Missing qualified runtime dependency: ${dependency}`);
assert.doesNotMatch(dockerfile, /apt-get|ubuntu|debian/i,
  'The production API runtime unexpectedly reintroduced the former OS family.');

console.log(JSON.stringify({ apiRuntimeImageBoundary: 'passed', os: 'alpine',
  runtimeIdentifiers: ['linux-musl-x64', 'linux-musl-arm64'], fullGlobalization: true }));
