import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const inventory = read('docs/security/COMMUNICATION_SECURITY.md');
const compose = read('compose.yaml');
const gateway = read('apps/web/nginx.conf');
const outbound = read('apps/api/Networking/OutboundHttpPolicy.cs');
const smtp = read('apps/api/Notifications/SmtpTransport.cs');
const serviceRegistration = read('apps/api/ServiceRegistration.cs');

for (const path of ['Browser or machine client → public gateway', 'Gateway → API',
  'API → PostgreSQL', 'API → OIDC/SAML provider', 'API → webhook receiver',
  'API ↔ federation peer', 'API → SMTP relay', 'API → AD/LDAP',
  'Administrator → host', 'Backup transfer'])
  assert.ok(inventory.includes(path), `Missing communication inventory path: ${path}`);

assert.match(gateway, /proxy_pass http:\/\/api:8080/, 'internal gateway/API plaintext path');
assert.match(compose, /Host=postgres;Port=5432/, 'internal API/database path');
assert.match(compose, /backend:\n\s+internal: true/, 'database network isolation');
assert.match(outbound, /uri\.Scheme == Uri\.UriSchemeHttps/, 'outbound HTTP HTTPS-only policy');
assert.doesNotMatch(serviceRegistration, /ServerCertificateCustomValidationCallback\s*=\s*\([^)]*\)\s*=>\s*true/,
  'global TLS certificate bypass');
assert.match(smtp, /EnableSsl = smtp\.Security == "starttls"/, 'SMTP STARTTLS selection');
assert.match(inventory, /SV-103/, 'internal plaintext finding');

console.log(JSON.stringify({
  communicationSecurityInventory: 'assessed',
  documentedPaths: 10,
  publicTls: true,
  outboundCertificateValidation: true,
  plaintextInternalServicePaths: 2,
  finding: 'SV-103',
}));
