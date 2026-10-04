import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const sourceRoot = 'apps/web/src';
const expectedUserPasswordIds = new Set([
  'setup-password',
  'setup-confirm-password',
  'password',
  'password-reset-new',
  'password-reset-confirm',
  'manager-password',
  'profile-current-password',
  'current-password',
  'new-password',
  'confirm-password',
  'disable-2fa-password',
  'setup-2fa-password',
  'passkey-current-password',
]);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.tsx') ? [path] : [];
  });
}

const passwordInputs = [];
const userPasswordIds = new Set();
for (const path of sourceFiles(sourceRoot)) {
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(/<input\b[\s\S]*?\/>/g)) {
    const input = match[0];
    const id = input.match(/\bid="([^"]+)"/)?.[1];
    const isPasswordInput = Boolean(id && /password/i.test(id) && id !== 'password-reset-code')
      || /\bvalue=\{secret\}/.test(input)
      || (path.endsWith('SmtpPage.tsx') && /\bvalue=\{password\}/.test(input));
    if (!isPasswordInput) continue;
    assert.match(input, /\btype="password"/, `${relative('.', path)} contains an unmasked password or secret input`);
    if (id && expectedUserPasswordIds.has(id)) userPasswordIds.add(id);
    passwordInputs.push({ path: relative('.', path), id: id ?? null });
  }
}

assert.deepEqual(userPasswordIds, expectedUserPasswordIds,
  'The complete set of user-password inputs must remain covered by the masking test');
assert.equal(passwordInputs.length, 15,
  'Review newly added or removed password/secret inputs and update the explicit inventory');

process.stdout.write(`${JSON.stringify({
  passwordInputMasking: 'passed',
  maskedPasswordOrSecretInputs: passwordInputs.length,
  userPasswordInputs: userPasswordIds.size,
  coveredUserFlows: ['bootstrap', 'login', 'reset', 'user-creation', 'profile', 'totp', 'passkey'],
})}\n`);
