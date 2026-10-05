import { createServer } from 'node:https';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const issuer = 'https://oidc-invalid.test:18445';
const clientId = 'fylkren-negative-oidc';
const clientSecret = process.env.OIDC_NEGATIVE_CLIENT_SECRET;
if (!clientSecret) throw new Error('OIDC_NEGATIVE_CLIENT_SECRET is required.');
const subject = '44444444-4444-4444-8444-444444444444';
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: 'jwk' });
const { publicKey: attackerPublicKey, privateKey: attackerPrivateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const attackerPublicJwk = attackerPublicKey.export({ format: 'jwk' });
const codes = new Map();
let mode = 'nonce';
let xmlCanaryRequests = 0;
let runtimeXmlMode = 'valid';
let runtimeOidcMode = 'valid';
let redirectCanaryRequests = 0;
let tokenHeaderKeyRequests = 0;
let runtimeMetadataBody = '';

const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(payload, algorithm = 'RS256', signingKey = privateKey, header = {}) {
  const unsigned = `${encoded({ alg: algorithm, typ: 'JWT', kid: 'negative-lab-key', ...header })}.${encoded(payload)}`;
  const signingAlgorithm = algorithm === 'RS512' ? 'RSA-SHA512' : 'RSA-SHA256';
  return `${unsigned}.${sign(signingAlgorithm, Buffer.from(unsigned), signingKey).toString('base64url')}`;
}
function corruptSignature(value) {
  const parts = value.split('.');
  parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`;
  return parts.join('.');
}
function json(response, status, body) {
  const value = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(value), 'Cache-Control': 'no-store' });
  response.end(value);
}
async function body(request) {
  const values = [];
  for await (const value of request) values.push(value);
  return Buffer.concat(values).toString('utf8');
}

createServer({
  key: readFileSync('/run/fylkren-identity-lab/oidc-negative.key'),
  cert: readFileSync('/run/fylkren-identity-lab/oidc-negative.crt'),
}, async (request, response) => {
  const url = new URL(request.url, issuer);
  try {
  if (url.pathname === '/xml-probes') return json(response, 200, { xmlCanaryRequests, redirectCanaryRequests });
  if (url.pathname === '/oidc-metadata-mode' && request.method === 'POST') {
    runtimeOidcMode = new URLSearchParams(await body(request)).get('value');
    return json(response, 200, { mode: runtimeOidcMode });
  }
  const oidcCase = url.pathname.match(/^\/metadata-case\/([a-z-]+)\/\.well-known\/openid-configuration$/);
  if (oidcCase) {
    const configuredIssuer = `${issuer}/metadata-case/${oidcCase[1]}`;
    if (runtimeOidcMode === 'redirect') {
      response.writeHead(302, { Location: `${issuer}/redirect-canary` });
      return response.end();
    }
    if (runtimeOidcMode === 'oversized') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': 2_000_001 });
      return response.end('x'.repeat(2_000_001));
    }
    if (runtimeOidcMode === 'chunked') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      for (let i = 0; i < 125; i++) response.write('x'.repeat(16_384));
      return response.end();
    }
    if (runtimeOidcMode === 'array') return json(response, 200, []);
    return json(response, 200, {
      issuer: configuredIssuer,
      authorization_endpoint: runtimeOidcMode === 'foreign-authorization'
        ? 'https://keycloak.test:18443/unapproved-authorization'
        : `${issuer}/authorize`,
      token_endpoint: runtimeOidcMode === 'typed' ? 123 : `${issuer}/token`,
      jwks_uri: runtimeOidcMode === 'foreign-keys' ? 'https://keycloak.test:18443/unapproved-jwks' : `${issuer}/jwks`,
      response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'],
    });
  }
  if (url.pathname === '/metadata-body' && request.method === 'POST') {
    runtimeMetadataBody = await body(request);
    return json(response, 200, { ready: true });
  }
  if (url.pathname === '/xml-mode' && request.method === 'POST') {
    const value = new URLSearchParams(await body(request)).get('value');
    if (!['valid', 'external', 'internal', 'oversized', 'chunked', 'redirect', 'expired', 'foreign-sso'].includes(value)) return json(response, 400, {});
    runtimeXmlMode = value;
    return json(response, 200, { mode: value });
  }
  if (url.pathname === '/metadata-runtime') {
    const original = runtimeMetadataBody;
    let xml = original;
    if (runtimeXmlMode === 'redirect') {
      response.writeHead(302, { Location: `${issuer}/redirect-canary` });
      return response.end();
    }
    if (runtimeXmlMode === 'oversized') xml = 'x'.repeat(2_000_001);
    if (runtimeXmlMode === 'chunked') {
      response.writeHead(200, { 'Content-Type': 'application/xml' });
      for (let i = 0; i < 125; i++) response.write('x'.repeat(16_384));
      return response.end();
    }
    if (runtimeXmlMode === 'expired') xml = original.replace(/(<[\w:]*EntityDescriptor\b)/, '$1 validUntil="2000-01-01T00:00:00Z"');
    if (runtimeXmlMode === 'foreign-sso')
      xml = original.replace(/(<[\w:]*SingleSignOnService\b[^>]*\bLocation=")[^"]+/, `$1https://metadata.test:18444/unapproved-sso`);
    if (['external', 'internal'].includes(runtimeXmlMode)) {
      const declaration = original.match(/^\s*<\?xml[^?]*\?>/)?.[0] ?? '';
      const document = original.slice(declaration.length);
      const rootName = document.match(/^\s*<([\w:]+)/)?.[1];
      const idp = 'https://keycloak.test:18443/realms/fylkren-lab';
      const definition = runtimeXmlMode === 'external' ? `SYSTEM "${issuer}/xml-canary"` : `"${idp}"`;
      const changed = runtimeXmlMode === 'external'
        ? document.replace(/(<\/[\w:]+>\s*)$/, '<synthetic>&synthetic;</synthetic>$1')
        : document.replace(idp, '&synthetic;');
      xml = `${declaration}<!DOCTYPE ${rootName} [<!ENTITY synthetic ${definition}>]>${changed}`;
    }
    response.writeHead(200, { 'Content-Type': 'application/xml', 'Content-Length': Buffer.byteLength(xml) });
    return response.end(xml);
  }
  if (url.pathname === '/redirect-canary') {
    redirectCanaryRequests++;
    return json(response, 200, { fetched: true });
  }
  if (url.pathname === '/xml-canary') {
    xmlCanaryRequests++;
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    return response.end('SYNTHETIC_XML_CANARY');
  }
  if (url.pathname === '/metadata-xml') {
    const variant = url.searchParams.get('variant');
    const descriptor = `<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${issuer}"><synthetic>TEXT</synthetic></EntityDescriptor>`;
    let xml = descriptor;
    if (variant === 'external') xml = `<!DOCTYPE EntityDescriptor [<!ENTITY probe SYSTEM "${issuer}/xml-canary">]>` + descriptor.replace('TEXT', '&probe;');
    if (variant === 'internal') xml = '<!DOCTYPE EntityDescriptor [<!ENTITY a "synthetic"><!ENTITY b "&a;&a;&a;&a;">]>' + descriptor.replace('TEXT', '&b;');
    if (variant === 'oversized') xml = 'x'.repeat(2_000_001);
    response.writeHead(200, { 'Content-Type': 'application/xml', 'Content-Length': Buffer.byteLength(xml) });
    return response.end(xml);
  }
  if (url.pathname === '/.well-known/openid-configuration') return json(response, 200, {
    issuer,
    authorization_endpoint: runtimeOidcMode === 'foreign-authorization' ? 'https://keycloak.test:18443/unapproved-authorization' : `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/jwks`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256', 'RS512'],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    scopes_supported: ['openid', 'profile', 'email'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'nonce', 'name', 'email'],
  });
  if (url.pathname === '/jwks') return json(response, 200, { keys: [{ ...publicJwk, kid: 'negative-lab-key', use: 'sig' }] });
  if (url.pathname === '/header-jwks') {
    tokenHeaderKeyRequests += 1;
    return json(response, 200, { keys: [{ ...attackerPublicJwk, kid: 'attacker-header-key', use: 'sig', alg: 'RS256' }] });
  }
  if (url.pathname === '/token-key-probes') return json(response, 200, { tokenHeaderKeyRequests });
  if (url.pathname === '/mode' && request.method === 'POST') {
    const requested = new URLSearchParams(await body(request)).get('value');
    if (!['nonce', 'audience', 'signature', 'algorithm', 'header-key', 'expired', 'not-yet-valid'].includes(requested)) return json(response, 400, { error: 'invalid_mode' });
    mode = requested;
    return json(response, 200, { mode });
  }
  if (url.pathname === '/authorize') {
    const code = randomBytes(24).toString('base64url');
    codes.set(code, { nonce: url.searchParams.get('nonce'), redirectUri: url.searchParams.get('redirect_uri') });
    const redirect = new URL(url.searchParams.get('redirect_uri'));
    redirect.searchParams.set('code', code);
    redirect.searchParams.set('state', url.searchParams.get('state'));
    response.writeHead(302, { Location: redirect.toString(), 'Cache-Control': 'no-store' });
    return response.end();
  }
  if (url.pathname === '/token' && request.method === 'POST') {
    const form = new URLSearchParams(await body(request));
    const record = codes.get(form.get('code'));
    codes.delete(form.get('code'));
    if (!record || form.get('client_id') !== clientId || form.get('client_secret') !== clientSecret ||
        form.get('redirect_uri') !== record.redirectUri)
      return json(response, 400, { error: 'invalid_grant' });
    const now = Math.floor(Date.now() / 1000);
    const idToken = jwt({
      iss: issuer,
      aud: mode === 'audience' ? 'wrong-audience' : clientId,
      sub: subject,
      iat: now,
      exp: mode === 'expired' ? now - 600 : now + 300,
      ...(mode === 'not-yet-valid' && { nbf: now + 600 }),
      nonce: mode === 'nonce' ? 'wrong-nonce' : record.nonce,
      name: 'Negative OIDC Fixture',
      email: 'negative-oidc@example.invalid',
    }, mode === 'algorithm' ? 'RS512' : 'RS256', mode === 'header-key' ? attackerPrivateKey : privateKey,
    mode === 'header-key' ? {
      kid: 'attacker-header-key',
      jku: `${issuer}/header-jwks`,
      jwk: { ...attackerPublicJwk, kid: 'attacker-header-key', use: 'sig', alg: 'RS256' },
    } : {});
    return json(response, 200, {
      token_type: 'Bearer', expires_in: 300, access_token: randomBytes(24).toString('base64url'),
      id_token: mode === 'signature' ? corruptSignature(idToken) : idToken,
    });
  }
  if (url.pathname === '/userinfo') return json(response, 200, { sub: subject, name: 'Negative OIDC Fixture', email: 'negative-oidc@example.invalid' });
  if (url.pathname === '/health') return json(response, 200, { status: 'ok' });
    return json(response, 404, { error: 'not_found' });
  } catch (error) {
    console.error(`Negative OIDC fixture failed for ${request.method} ${url.pathname}: ${error.message}`);
    if (!response.headersSent) return json(response, 500, { error: 'fixture_failure' });
    response.destroy();
  }
}).listen(18445, '0.0.0.0');
