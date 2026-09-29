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
const codes = new Map();
let mode = 'nonce';

const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(payload) {
  const unsigned = `${encoded({ alg: 'RS256', typ: 'JWT', kid: 'negative-lab-key' })}.${encoded(payload)}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
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
  if (url.pathname === '/.well-known/openid-configuration') return json(response, 200, {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/jwks`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    scopes_supported: ['openid', 'profile', 'email'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'nonce', 'name', 'email'],
  });
  if (url.pathname === '/jwks') return json(response, 200, { keys: [{ ...publicJwk, kid: 'negative-lab-key', use: 'sig', alg: 'RS256' }] });
  if (url.pathname === '/mode' && request.method === 'POST') {
    const requested = new URLSearchParams(await body(request)).get('value');
    if (requested !== 'nonce' && requested !== 'audience') return json(response, 400, { error: 'invalid_mode' });
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
    return json(response, 200, {
      token_type: 'Bearer', expires_in: 300, access_token: randomBytes(24).toString('base64url'),
      id_token: jwt({
        iss: issuer,
        aud: mode === 'audience' ? 'wrong-audience' : clientId,
        sub: subject,
        iat: now,
        exp: now + 300,
        nonce: mode === 'nonce' ? 'wrong-nonce' : record.nonce,
        name: 'Negative OIDC Fixture',
        email: 'negative-oidc@example.invalid',
      }),
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
