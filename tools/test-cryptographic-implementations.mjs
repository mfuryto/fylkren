import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = path => readFileSync(path, 'utf8');
const policy = read('docs/security/CRYPTOGRAPHIC_KEY_MANAGEMENT.md');
const packages = read('Directory.Packages.props');
const project = read('apps/api/Fylkren.Api.csproj');
const registration = read('apps/api/ServiceRegistration.cs');
const machine = read('apps/api/Platform/ApiMachineAuthentication.cs');
const federation = read('apps/api/Federation/FederationProbeProtocol.cs');
const totp = read('apps/api/Identity/TotpService.cs');

for (const provider of ['System.Security.Cryptography', 'ASP.NET Core Data Protection and Identity',
  'Microsoft ASP.NET Core OpenID Connect handler', 'Sustainsys SAML2', 'Fido2 and Fido2.AspNet',
  'Deployment TLS stack'])
  assert.ok(policy.includes(provider), `Missing maintained implementation provider: ${provider}`);

for (const packageName of ['Microsoft.AspNetCore.Authentication.OpenIdConnect',
  'Sustainsys.Saml2.AspNetCore2', 'Fido2', 'Fido2.AspNet']) {
  assert.match(packages, new RegExp(`PackageVersion Include="${packageName.replace('.', '\\.') }" Version="[^"]+"`),
    `Missing centrally pinned provider version: ${packageName}`);
  assert.ok(project.includes(`PackageReference Include="${packageName}"`),
    `Missing API provider reference: ${packageName}`);
}

assert.match(registration, /AddDataProtection\(\)/, 'ASP.NET Data Protection provider');
assert.match(registration, /IPasswordHasher<LoginIdentity>/, 'ASP.NET Identity password hasher');
assert.match(machine, /Rfc2898DeriveBytes\.Pbkdf2/, '.NET PBKDF2 implementation');
assert.match(machine, /RandomNumberGenerator\.GetBytes/, '.NET CSPRNG implementation');
assert.match(federation, /key\.SignData\(/, '.NET ECDSA signing implementation');
assert.match(federation, /key\.VerifyData\(/, '.NET ECDSA verification implementation');
assert.match(totp, /new HMACSHA1\(/, '.NET HMAC implementation');
assert.match(totp, /CryptographicOperations\.FixedTimeEquals/, '.NET fixed-time comparison');

function sourceFiles(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    if (path.includes('/Persistence/Migrations/')) return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.cs') ? [path] : [];
  });
}
const productionSources = sourceFiles('apps/api').map(read).join('\n');
assert.doesNotMatch(productionSources,
  /class\s+(?:AES|RSA|ECDSA|SHA\d*|HMAC\w*)\b|BigInteger\s*\.\s*ModPow|(?:Encrypt|Decrypt)(?:Block|Round)\s*\(/,
  'Custom cryptographic primitive implementation detected');

console.log(JSON.stringify({
  cryptographicImplementations: 'passed',
  maintainedProviders: 6,
  customCryptographicPrimitives: 0,
  centrallyPinnedIdentityLibraries: 4,
}));
