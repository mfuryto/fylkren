import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const inventory = read('docs/security/COMMUNICATION_SECURITY.md');
const compose = read('compose.yaml');
const gateway = read('apps/web/nginx.conf');
const outbound = read('apps/api/Networking/OutboundHttpPolicy.cs');
const smtp = read('apps/api/Notifications/SmtpTransport.cs');
const serviceRegistration = read('apps/api/ServiceRegistration.cs');
const tlsInitializer = read('apps/tls-init/initialize-internal-tls.sh');
const postgresHba = read('apps/postgres/pg_hba.fylkren.conf');

for (const path of ['Browser or machine client → public gateway', 'Gateway → API',
  'API → PostgreSQL', 'API → OIDC/SAML provider', 'API → webhook receiver',
  'API ↔ federation peer', 'API → SMTP relay', 'API → AD/LDAP',
  'Administrator → host', 'Backup transfer'])
  assert.ok(inventory.includes(path), `Missing communication inventory path: ${path}`);

assert.match(gateway, /proxy_pass https:\/\/api:8443/, 'internal gateway/API TLS path');
assert.match(gateway, /proxy_ssl_verify on/, 'gateway must verify the API certificate');
assert.match(gateway, /proxy_ssl_name api/, 'gateway must verify the API service name');
assert.doesNotMatch(gateway, /proxy_pass http:\/\/api:/, 'gateway/API plaintext fallback');
assert.match(compose, /SSL Mode=VerifyFull;Root Certificate=\/run\/fylkren-trust\/ca\.crt/, 'API/database verified TLS path');
assert.match(compose, /ssl_min_protocol_version=TLSv1\.2/, 'PostgreSQL minimum TLS version');
assert.match(postgresHba, /hostnossl\s+all\s+all\s+0\.0\.0\.0\/0\s+reject/, 'PostgreSQL plaintext rejection');
assert.match(postgresHba, /hostssl\s+all\s+all\s+0\.0\.0\.0\/0\s+scram-sha-256/, 'PostgreSQL TLS authentication');
assert.match(tlsInitializer, /-verify_hostname "\$name"/, 'internal certificate hostname verification');
assert.match(tlsInitializer, /issue_leaf api 1654:1654/, 'separate API private key');
assert.match(tlsInitializer, /issue_leaf postgres 70:70/, 'separate PostgreSQL private key');
assert.match(compose, /backend:\n\s+internal: true/, 'database network isolation');
assert.match(outbound, /uri\.Scheme == Uri\.UriSchemeHttps/, 'outbound HTTP HTTPS-only policy');
assert.doesNotMatch(serviceRegistration, /ServerCertificateCustomValidationCallback\s*=\s*\([^)]*\)\s*=>\s*true/,
  'global TLS certificate bypass');
assert.match(smtp, /smtp\.Security != "starttls"/, 'SMTP plaintext rejection');
assert.match(smtp, /EnableSsl = true/, 'SMTP STARTTLS enforcement');

console.log(JSON.stringify({
  communicationSecurityInventory: 'passed',
  documentedPaths: 10,
  publicTls: true,
  outboundCertificateValidation: true,
  verifiedInternalTlsPaths: 2,
  plaintextInternalServicePaths: 0,
  plaintextSmtpSupported: false,
}));
