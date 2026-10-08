import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const compose = readFileSync('compose.yaml', 'utf8');
const gateway = readFileSync('apps/web/nginx.conf', 'utf8');
const outerProxy = readFileSync('tools/e2e/federation-pair.nginx.conf', 'utf8');
const apiRegistration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');

const apiBlock = /\n  api:\n([\s\S]*?)\n  postgres:/.exec(compose)?.[1];
assert.ok(apiBlock, 'Could not locate the API service in compose.yaml');
assert.doesNotMatch(apiBlock, /^\s+ports:/m, 'The API must not publish a host port');
assert.match(apiBlock, /^\s+expose:\n\s+- "8443"/m, 'The TLS API must remain private to the Compose network');

const proxiedLocations = [...gateway.matchAll(/location\s+[^\{]+\{([\s\S]*?)\n\s*\}/g)]
  .map(match => match[1])
  .filter(body => body.includes('proxy_pass'));
assert.equal(proxiedLocations.length, 5, 'Review every new gateway proxy location');
for (const body of proxiedLocations) {
  assert.match(body, /proxy_set_header Host \$http_host;/,
    'A proxied location did not replace the upstream Host value');
  assert.match(body, /proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto;/,
    'A proxied location did not pass the trusted outer-proxy scheme');
  assert.match(body, /proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;/,
    'A proxied location did not append its own forwarding hop');
}
for (const body of proxiedLocations.filter(body => !body.includes('proxy_pass https://api:8443/health'))) {
  assert.match(body, /proxy_set_header X-Forwarded-Host \$http_host;/,
    'An application proxy location did not replace X-Forwarded-Host');
}
const aiLocation = proxiedLocations.find(body => body.includes('proxy_read_timeout 330s'));
assert.ok(aiLocation, 'The reviewed long-running AI proxy location is missing');
assert.match(aiLocation, /proxy_buffering off;/,
  'The AI proxy must not buffer incremental assistant output');
const clientAddressLocations = proxiedLocations.filter(body =>
  body.includes('X-Fylkren-Gateway-Client-IP'));
assert.equal(clientAddressLocations.length, 3,
  'Review the client-address replacement on every API proxy location');
for (const body of clientAddressLocations) {
  assert.match(body, /proxy_set_header X-Fylkren-Gateway-Client-IP \$remote_addr;/,
    'An API proxy location did not replace the Fylkren client-address header');
}

assert.match(apiRegistration,
  /ForwardedHeaders = ForwardedHeaders\.XForwardedFor \| ForwardedHeaders\.XForwardedProto/,
  'The reviewed forwarded-header set changed');
assert.doesNotMatch(apiRegistration, /ForwardedHeaders\.XForwardedHost/,
  'Forwarded Host must not become authoritative without a separate review');
assert.match(apiRegistration, /ForwardLimit = forwardedHeaderLimit/,
  'The API forwarding-hop limit is missing');

const tlsApplicationServers = [...outerProxy.matchAll(/server\s*\{([\s\S]*?)\n\}/g)]
  .map(match => match[1])
  .filter(body => body.includes('proxy_pass http://web-'));
assert.equal(tlsApplicationServers.length, 2, 'Review every production-shaped outer proxy fixture');
for (const body of tlsApplicationServers) {
  assert.match(body, /proxy_set_header Host localhost:1844[34];/,
    'The outer proxy fixture did not replace Host');
  assert.match(body, /proxy_set_header X-Forwarded-Proto https;/,
    'The outer proxy fixture did not replace X-Forwarded-Proto');
  assert.match(body, /proxy_set_header X-Forwarded-For \$remote_addr;/,
    'The outer proxy fixture did not replace the caller-supplied forwarding chain');
  assert.doesNotMatch(body, /\$http_x_forwarded_|\$proxy_add_x_forwarded_for/,
    'The outer proxy fixture inherited a caller-supplied forwarding value');
}

process.stdout.write(`${JSON.stringify({ intermediaryHeaderInventory: 'passed',
  apiHostPorts: 0, gatewayProxyLocations: proxiedLocations.length,
  outerProxyApplications: tlsApplicationServers.length,
  forwardedHostTrustedByApi: false, forwardedHopLimit: 'configured:1-2' })}\n`);
