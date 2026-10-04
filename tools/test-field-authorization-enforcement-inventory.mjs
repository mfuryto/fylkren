import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controls = [
  ['authentication-secret', 'tools/e2e/portability.mjs', 'Authentication secrets included as package entries'],
  ['self-profile', 'tools/test-sensitive-account-reauthentication-runtime.mjs', 'rejectedChangeAtomic'],
  ['personnel-administration', 'tools/e2e/authorization-boundaries.mjs', 'Foreign personnel access through Site Manager'],
  ['work-content', 'tools/e2e/cross-site-requests.mjs', 'Sender can inspect receiver internal task'],
  ['cross-site-official', 'tools/e2e/cross-site-requests.mjs', 'Approved official response missing from sender view'],
  ['private-learning', 'tools/e2e/learning.mjs', 'Private learning content leaked into activity'],
  ['classified-report', 'tools/e2e/administration-report-apis.mjs', 'Classified report leaked without grant'],
  ['audit-activity', 'tools/e2e/learning.mjs', 'Internal point text leaked into administrative audit'],
  ['integration-secret', 'tools/run-identity-sso-lab.mjs', 'clientSecret'],
  ['archive-export', 'tools/e2e/governance-lifecycle.mjs', 'Custodian gained operational membership'],
];
const access = readFileSync('docs/administration/ACCESS_MATRIX.md', 'utf8');
for (const [fieldClass, path, marker] of controls) {
  assert.ok(access.includes(`| \`${fieldClass}\` |`), `Undocumented protected field class: ${fieldClass}`);
  assert.ok(readFileSync(path, 'utf8').toLowerCase().includes(marker.toLowerCase()),
    `${fieldClass} lacks maintained enforcement evidence in ${path}`);
}

const identity = readFileSync('apps/api/Identity/IdentityEndpoints.cs', 'utf8');
assert.doesNotMatch(identity, /Results\.Ok\([^\n]*(?:PasswordHash|TotpSecret|ResetToken)/,
  'Identity response appears to return authentication secret material');
const providers = readFileSync('apps/api/Platform/IdentityProviderEndpoints.cs', 'utf8');
assert.match(providers, /with \{ Secret = null \}/);
assert.match(providers, /hasSecret = .*\.Secret is not null/);

process.stdout.write(`${JSON.stringify({
  fieldAuthorizationEnforcementInventory: 'passed', fieldClasses: controls.length,
  maintainedEvidenceBindings: controls.length, explicitResponseProjections: true,
})}\n`);
