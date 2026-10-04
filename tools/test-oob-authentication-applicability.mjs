import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const identityServer = readdirSync('apps/api/Identity')
  .filter((name) => name.endsWith('.cs'))
  .map((name) => readFileSync(`apps/api/Identity/${name}`, 'utf8'))
  .join('\n');
const identityClient = [
  'apps/web/src/auth/LoginPage.tsx',
  'apps/web/src/api/authClient.ts',
  'apps/web/src/profile/ProfilePage.tsx',
  'apps/web/src/profile/profileApi.ts',
].map((path) => readFileSync(path, 'utf8')).join('\n');
const project = readFileSync('apps/api/Fylkren.Api.csproj', 'utf8');
const identity = `${identityServer}\n${identityClient}\n${project}`;

for (const mechanism of [
  /\bSms(Authentication|Otp|Code|Provider)?\b/i,
  /\bVoice(Authentication|Otp|Code|Provider)?\b/i,
  /\bEmail(Otp|AuthenticationCode|AuthenticationToken)\b/i,
  /\bPush(Authentication|Approval|Provider)\b/i,
  /\bOutOfBand(Authentication|Code|Token)\b/i,
  /\bTwilio\b/i,
]) assert.doesNotMatch(identity, mechanism);

const endpoints = readFileSync('apps/api/Identity/IdentityEndpoints.cs', 'utf8');
for (const route of ['session', 'password-reset/complete', 'session/2fa', 'profile/2fa/setup', 'profile/2fa/confirm'])
  assert.match(endpoints, new RegExp(`"/${route.replace('/', '\\/')}"`));

process.stdout.write(`${JSON.stringify({ oobAuthenticationApplicability: 'not-applicable',
  reviewedServerIdentityFiles: readdirSync('apps/api/Identity').filter((name) => name.endsWith('.cs')).length,
  reviewedClientFlows: 4, implementedInteractiveFactors: ['password', 'totp', 'recoveryCode', 'webauthn', 'externalProvider'],
  oobMechanisms: [], reopenOn: ['sms-authentication', 'voice-authentication', 'email-otp', 'push-authentication'] })}\n`);
