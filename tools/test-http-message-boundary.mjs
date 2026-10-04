import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
const gateway = readFileSync('apps/web/nginx.conf', 'utf8');
const outerProxy = readFileSync('tools/e2e/federation-pair.nginx.conf', 'utf8');

assert.match(api, /endpoint\.Protocols = HttpProtocols\.Http1/,
  'The private Kestrel endpoint is not explicitly restricted to the tested HTTP/1 parser');
assert.doesNotMatch(gateway, /\bhttp2\b|\bhttp3\b|\bquic\b/i,
  'The built gateway enabled an untested HTTP protocol');
assert.doesNotMatch(outerProxy, /\bhttp2\b|\bhttp3\b|\bquic\b/i,
  'The production-shaped outer proxy enabled an untested HTTP protocol');

const upstreamVersions = [...gateway.matchAll(/proxy_http_version\s+([^;]+);/g)]
  .map(match => match[1]);
assert.deepEqual([...new Set(upstreamVersions)], ['1.1'],
  'Explicit gateway upstream protocols must remain HTTP/1.1');
assert.equal(upstreamVersions.length, 2,
  'Review the protocol declaration when adding an explicit upstream version');

process.stdout.write(`${JSON.stringify({ httpMessageProtocolInventory: 'passed',
  externalProtocols: ['HTTP/1.0', 'HTTP/1.1'], gatewayExplicitUpstreams: upstreamVersions.length,
  apiProtocol: 'HTTP/1', http2AndHttp3Exposed: false })}\n`);
