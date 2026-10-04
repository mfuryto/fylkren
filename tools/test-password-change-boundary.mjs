import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const endpoints = readFileSync('apps/api/Identity/IdentityProfileEndpoints.cs', 'utf8');
const routes = readFileSync('apps/api/Identity/IdentityEndpoints.cs', 'utf8');

assert.match(routes, /MapPut\("\/profile\/password", ChangePassword\)\.RequireAuthorization\(\)\.RequireRateLimiting\("authentication"\)/);
assert.match(endpoints, /string\.IsNullOrEmpty\(request\.CurrentPassword\) \|\| string\.IsNullOrEmpty\(request\.NewPassword\)/);
assert.match(endpoints, /VerifyHashedPassword\(identity, identity\.PasswordHash, request\.CurrentPassword\)/);
assert.match(endpoints, /request\.CurrentPassword == request\.NewPassword/);
assert.match(endpoints, /passwordPolicy\.Validate\(request\.NewPassword/);
assert.match(endpoints, /SetPasswordHash\(passwordHasher\.HashPassword\(identity, request\.NewPassword\)\)/);

process.stdout.write(`${JSON.stringify({ passwordChangeBoundary: 'passed', requiresCurrentPassword: true,
  requiresNewPassword: true, verifiesCurrentHash: true, rejectsReuse: true,
  validatesNewPassword: true, sharedAuthenticationRateLimit: true })}\n`);
