import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const policy=readFileSync('apps/api/Identity/PasswordSecurityPolicy.cs','utf8');
assert.doesNotMatch(policy,/RequireDigit|RequireUppercase|RequireLowercase|RequireNonAlphanumeric|[A-Z].*[a-z].*\\d/);
assert.match(policy,/password\?\.Length is not/);assert.match(policy,/ContainsFingerprint/);assert.match(policy,/ContextTokens/);
process.stdout.write(`${JSON.stringify({passwordCompositionBoundary:'passed',requiredCharacterClasses:0,allowedCompositionFamilies:4})}\n`);
