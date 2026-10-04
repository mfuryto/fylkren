import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function filesUnder(directory, extension) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path, extension) : entry.name.endsWith(extension) ? [path] : [];
  });
}

const reviewed = [
  ...filesUnder('apps/api/Identity', '.cs'),
  'apps/api/Persistence/OrganizationIdentityModelConfiguration.cs',
  'apps/api/Persistence/Migrations/FylkrenDbContextModelSnapshot.cs',
  'apps/api/Organization/LocalUserEndpoints.cs',
  'apps/api/Organization/SiteMemberEndpoints.cs',
  'apps/api/Platform/PlatformUserAccountEndpoints.cs',
  'apps/web/src/auth/LoginPage.tsx',
  'apps/web/src/api/authClient.ts',
];
const source = reviewed.map((path) => `${path}\n${readFileSync(path, 'utf8')}`).join('\n');
const forbidden = [
  /password[_ ]?hint/i,
  /security[_ ]?question/i,
  /secret[_ ]?question/i,
  /knowledge[_ -]?based/i,
  /security[_ ]?answer/i,
  /secret[_ ]?answer/i,
  /recovery[_ ]?question/i,
];
for (const pattern of forbidden) assert.doesNotMatch(source, pattern);

const endpoints = readFileSync('apps/api/Identity/IdentityEndpoints.cs', 'utf8');
const completion = readFileSync('apps/api/Identity/IdentityPasswordResetEndpoints.cs', 'utf8');
const login = readFileSync('apps/web/src/auth/LoginPage.tsx', 'utf8');
assert.match(endpoints, /CompletePasswordResetRequest\(string\? ResetCode, string\? NewPassword\)/);
assert.match(completion, /PasswordResetGrant\.Normalize\(request\.ResetCode/);
assert.match(completion, /passwordPolicy\.Validate\(request\.NewPassword/);
assert.deepEqual([...login.matchAll(/id="password-reset-([^"]+)"/g)].map((match) => match[1]), ['code', 'new', 'confirm']);

process.stdout.write(`${JSON.stringify({
  passwordRecoveryKnowledgeBoundary: 'passed',
  reviewedFiles: reviewed.length,
  forbiddenMechanisms: forbidden.length,
  resetRequestFields: ['resetCode', 'newPassword'],
  resetUiFields: ['oneTimeCode', 'newPassword', 'repeatPassword'],
  passwordHints: false,
  knowledgeBasedRecovery: false,
})}\n`);
