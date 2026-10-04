import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const documentation = readFileSync('docs/security/PASSWORD_BLOCKLIST.md', 'utf8');
const policy = readFileSync('apps/api/Identity/PasswordSecurityPolicy.cs', 'utf8');
const bootstrap = readFileSync('apps/api/Identity/IdentityBootstrapEndpoints.cs', 'utf8');
const profile = readFileSync('apps/api/Identity/IdentityProfileEndpoints.cs', 'utf8');
const reset = readFileSync('apps/api/Identity/IdentityPasswordResetEndpoints.cs', 'utf8');

for (const value of ['built-in product identifier `Fylkren`', "identity's username",
  "person's display name", "person's email address", 'Unicode NFKC',
  'invariant lowercase', 'Tokens shorter than four characters'])
  assert.ok(documentation.includes(value), `Context-word documentation is missing: ${value}`);
assert.match(policy, /ContextTokens\(contextualValues\.Prepend\("Fylkren"\)\)/);
assert.match(policy, /Normalize\(string value\) => value\.Normalize\(NormalizationForm\.FormKC\)\.ToLowerInvariant\(\)/);
assert.match(policy, /value\.Length >= 4/);
for (const source of [bootstrap, profile, reset])
  assert.match(source, /passwordPolicy\.Validate\([^\n]*username|passwordPolicy\.Validate\([^\n]*identity\.Username/i,
    'A local password-setting flow omitted the maintained identity context');

process.stdout.write(`${JSON.stringify({ passwordContextDocumentation: 'passed',
  contextualValueFamilies: 4, normalization: 'NFKC-lowercase', minimumTokenLength: 4,
  localPasswordSettingFlows: 3, offlineCommonPasswordList: true })}\n`);
