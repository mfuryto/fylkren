import assert from 'node:assert/strict';
import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';
const endpoint = process.env.FYLKREN_BROWSER_CDP_URL ?? 'http://127.0.0.1:19224';
const base = process.env.FYLKREN_BROWSER_TARGET_URL ?? 'http://localhost:18082/';
const target = await (await fetch(`${endpoint}/json/new?${encodeURIComponent(base)}`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0; const pending = new Map();
socket.addEventListener('message', event => { const value = JSON.parse(event.data); if (!pending.has(value.id)) return; const waiter = pending.get(value.id); pending.delete(value.id); value.error ? waiter.reject(new Error(JSON.stringify(value.error))) : waiter.resolve(value.result); });
const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
async function evaluate(expression) { const value = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (value.exceptionDetails) throw new Error(JSON.stringify(value.exceptionDetails)); return value.result.value; }
async function request(path, body, method = 'POST') { return evaluate(`(async () => { const response = await fetch(${JSON.stringify(path)}, { method: ${JSON.stringify(method)}, headers: { 'Content-Type': 'application/json', ...(globalThis.labCsrf && { 'X-Fylkren-CSRF': labCsrf }) }, ${body !== undefined ? `body: JSON.stringify(${JSON.stringify(body)}),` : ''} }); const text = await response.text(); let body; try { body = JSON.parse(text); } catch { body = text; } return { status: response.status, body }; })()`); }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function credential(options, operation) {
  await evaluate(`globalThis.labOptions = ${JSON.stringify(options)}`);
  return evaluate(`(async () => {
    const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
    const publicKey = { ...labOptions, challenge: decode(labOptions.challenge),
      ...(labOptions.user && { user: { ...labOptions.user, id: decode(labOptions.user.id) } }),
      ...(labOptions.excludeCredentials && { excludeCredentials: labOptions.excludeCredentials.map(value => ({ ...value, id: decode(value.id) })) }),
      ...(labOptions.allowCredentials && { allowCredentials: labOptions.allowCredentials.map(value => ({ ...value, id: decode(value.id) })) }),
    };
    const value = await navigator.credentials.${operation}({ publicKey }); return value.toJSON();
  })()`);
}
try {
  await call('Runtime.enable'); await call('Page.enable');
  for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate('location.origin === ' + JSON.stringify(new URL(base).origin))) break; await pause(100); }
  // Keep React's background requests from racing laboratory cookie transitions.
  await call('Page.stopLoading');
  await call('Page.navigate', { url: new URL('/api/configuration/public', base).href });
  for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate('document.readyState === "complete" && location.pathname === "/api/configuration/public"')) break; await pause(100); }
  await call('WebAuthn.enable'); const authenticator = await call('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'usb', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  const username = `passkey-${randomBytes(6).toString('hex')}`, password = `V8!${randomBytes(24).toString('base64url')}#z`;
  assert.equal((await request('/api/bootstrap/platform-manager', { username, password, displayName: 'Synthetic Passkey Manager', email: `${username}@example.invalid` })).status, 201);
  await evaluate("fetch('/api/security/antiforgery').then(r => r.json()).then(value => globalThis.labCsrf = value.token)");
  assert.equal((await request('/api/webauthn/register/options', { name: 'Synthetic passkey', currentPassword: 'incorrect-synthetic-password' })).status, 400);
  const registration = await request('/api/webauthn/register/options', { name: 'Synthetic passkey', currentPassword: password }); assert.equal(registration.status, 200);
  const attestation = await credential(registration.body.options, 'create');
  const registerBody = { token: registration.body.token, credential: attestation };
  assert.equal((await request('/api/session', undefined, 'DELETE')).status, 204);
  assert.equal((await request('/api/session', { username, password })).status, 204);
  await evaluate("fetch('/api/security/antiforgery').then(r => r.json()).then(value => globalThis.labCsrf = value.token)");
  assert.equal((await request('/api/webauthn/register/complete', registerBody)).status, 400,
    'Registration proof issued before session revocation must not enroll a new credential');
  await pause(61_000);
  const freshRegistration = await request('/api/webauthn/register/options', { name: 'Synthetic passkey', currentPassword: password }); assert.equal(freshRegistration.status, 200);
  const freshRegisterBody = { token: freshRegistration.body.token, credential: await credential(freshRegistration.body.options, 'create') };
  // Use independent cookie jars: a rejected request may renew the old cookie,
  // and must not overwrite the successful enrollment's renewed browser session.
  const initialCookies = (await call('Network.getCookies', { urls: [base] })).cookies;
  const registrationCsrf = await evaluate('labCsrf');
  async function registerInSeparateSession() {
    const response = await fetch(new URL('/api/webauthn/register/complete', base), { method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Fylkren-CSRF': registrationCsrf,
      Cookie: initialCookies.map(value => `${value.name}=${value.value}`).join('; '),
    }, body: JSON.stringify(freshRegisterBody) });
    return { status: response.status, cookies: response.headers.getSetCookie() };
  }
  const parallelRegistration = await Promise.all([registerInSeparateSession(), registerInSeparateSession()]);
  assert.deepEqual(parallelRegistration.map(value => value.status).sort(), [204, 400]);
  for (const header of parallelRegistration.find(value => value.status === 204).cookies) {
    const pair = header.split(';')[0], separator = pair.indexOf('=');
    await call('Network.setCookie', { name: pair.slice(0, separator), value: pair.slice(separator + 1), url: base });
  }
  const replayRegistration = await request('/api/webauthn/register/complete', freshRegisterBody); assert.equal(replayRegistration.status, 400);
  const listed = await request('/api/webauthn/credentials', undefined, 'GET'); assert.equal(listed.status, 200); assert.equal(listed.body.length, 1);
  assert.equal((await request('/api/session', undefined, 'DELETE')).status, 204);
  await pause(61_000);
  const login = await request('/api/webauthn/login/options', { name: username }); assert.equal(login.status, 200);
  const assertion = await credential(login.body.options, 'get');
  const loginBody = { token: login.body.token, credential: assertion };
  const parallelLogin = await Promise.all([request('/api/webauthn/login/complete', loginBody), request('/api/webauthn/login/complete', loginBody)]);
  assert.deepEqual(parallelLogin.map(value => value.status).sort(), [204, 401]);
  assert.equal((await request('/api/session', undefined, 'DELETE')).status, 204);
  const replay = await request('/api/webauthn/login/complete', loginBody); assert.equal(replay.status, 401);
  assert.equal((await request('/api/session', undefined, 'GET')).body.authenticated, false);
  await pause(61_000);
  const mismatch = await request('/api/webauthn/login/options', { name: username }); assert.equal(mismatch.status, 200);
  const wrongOrigin = await credential(mismatch.body.options, 'get');
  const data = JSON.parse(Buffer.from(wrongOrigin.response.clientDataJSON, 'base64url')); data.origin = 'https://wrong.example.invalid';
  wrongOrigin.response.clientDataJSON = Buffer.from(JSON.stringify(data)).toString('base64url');
  const credentials = (await call('WebAuthn.getCredentials', { authenticatorId: authenticator.authenticatorId })).credentials;
  const registeredCredential = credentials.find(value => Buffer.from(value.credentialId, 'base64').toString('base64url') === freshRegisterBody.credential.id);
  assert.ok(registeredCredential, 'Registered virtual credential must be available');
  const privateKey = createPrivateKey({ key: Buffer.from(registeredCredential.privateKey, 'base64'), format: 'der', type: 'pkcs8' });
  const signatureAlgorithm = privateKey.asymmetricKeyType === 'ed25519' ? null : 'sha256';
  const signedBytes = Buffer.concat([Buffer.from(wrongOrigin.response.authenticatorData, 'base64url'), createHash('sha256').update(Buffer.from(wrongOrigin.response.clientDataJSON, 'base64url')).digest()]);
  wrongOrigin.response.signature = sign(signatureAlgorithm, signedBytes, privateKey).toString('base64url');
  assert.equal((await request('/api/webauthn/login/complete', { token: mismatch.body.token, credential: wrongOrigin })).status, 401);
  assert.equal((await request('/api/session', undefined, 'GET')).body.authenticated, false);
  const wrongRp = await credential(mismatch.body.options, 'get');
  const authenticatorData = Buffer.from(wrongRp.response.authenticatorData, 'base64url');
  createHash('sha256').update('wrong.example.invalid').digest().copy(authenticatorData, 0);
  wrongRp.response.authenticatorData = authenticatorData.toString('base64url');
  wrongRp.response.signature = sign(signatureAlgorithm, Buffer.concat([authenticatorData,
    createHash('sha256').update(Buffer.from(wrongRp.response.clientDataJSON, 'base64url')).digest()]), privateKey).toString('base64url');
  assert.equal((await request('/api/webauthn/login/complete', { token: mismatch.body.token, credential: wrongRp })).status, 401);
  await call('WebAuthn.removeCredential', { authenticatorId: authenticator.authenticatorId, credentialId: registeredCredential.credentialId });
  await call('WebAuthn.addCredential', { authenticatorId: authenticator.authenticatorId, credential: { ...registeredCredential, signCount: 0 } });
  const counter = await request('/api/webauthn/login/options', { name: username }); assert.equal(counter.status, 200);
  const regressed = await credential(counter.body.options, 'get');
  assert.equal((await request('/api/webauthn/login/complete', { token: counter.body.token, credential: regressed })).status, 401);
  assert.equal((await request('/api/session', undefined, 'GET')).body.authenticated, false);
  await pause(61_000);
  await call('WebAuthn.removeCredential', { authenticatorId: authenticator.authenticatorId, credentialId: registeredCredential.credentialId });
  await call('WebAuthn.addCredential', { authenticatorId: authenticator.authenticatorId, credential: { ...registeredCredential, signCount: 100 } });
  const session = await request('/api/webauthn/login/options', { name: username }); assert.equal(session.status, 200);
  assert.equal((await request('/api/webauthn/login/complete', { token: session.body.token, credential: await credential(session.body.options, 'get') })).status, 204);
  await evaluate("fetch('/api/security/antiforgery').then(r => r.json()).then(value => globalThis.labCsrf = value.token)");
  const revoked = await request('/api/webauthn/login/options', { name: username }); assert.equal(revoked.status, 200);
  const revokedBody = { token: revoked.body.token, credential: await credential(revoked.body.options, 'get') };
  assert.equal((await request('/api/session', undefined, 'DELETE')).status, 204);
  assert.equal((await request('/api/webauthn/login/complete', revokedBody)).status, 401);
  const renewed = await request('/api/webauthn/login/options', { name: username }); assert.equal(renewed.status, 200);
  assert.equal((await request('/api/webauthn/login/complete', { token: renewed.body.token, credential: await credential(renewed.body.options, 'get') })).status, 204);
  await pause(61_000);
  await evaluate("fetch('/api/security/antiforgery').then(r => r.json()).then(value => globalThis.labCsrf = value.token)");
  const deleted = await request('/api/webauthn/login/options', { name: username }); assert.equal(deleted.status, 200);
  const deletedBody = { token: deleted.body.token, credential: await credential(deleted.body.options, 'get') };
  assert.equal((await request(`/api/webauthn/credentials/${listed.body[0].id}`, { currentPassword: 'incorrect-synthetic-password' }, 'DELETE')).status, 400);
  assert.equal((await request(`/api/webauthn/credentials/${listed.body[0].id}`, { currentPassword: password }, 'DELETE')).status, 204);
  assert.equal((await request('/api/webauthn/credentials', undefined, 'GET')).body.length, 0);
  assert.equal((await request('/api/session', undefined, 'DELETE')).status, 204);
  assert.equal((await request('/api/webauthn/login/complete', deletedBody)).status, 401);
  assert.equal((await request('/api/webauthn/login/options', { name: username })).status, 401);
  assert.equal((await request('/api/session', undefined, 'GET')).body.authenticated, false);
  await call('WebAuthn.removeVirtualAuthenticator', { authenticatorId: authenticator.authenticatorId });
  console.log(JSON.stringify({ webAuthnSecurity: 'passed', virtualCtap2Authenticator: true, passwordReauthentication: true, staleRegistrationAfterSignOutRejected: true, parallelRegistrationSingleUse: true, parallelLoginSingleUse: true, registrationReplayRejected: true, signIn: true, assertionReplayRejected: true, wrongOriginRejected: true, wrongRpIdRejected: true, regressedCounterRejected: true, staleLoginAfterSignOutRejected: true, deletionReauthentication: true, deletedCredentialPendingLoginRejected: true, failedFlowsLeaveNoSession: true }));
} finally { await call('Target.closeTarget', { targetId: target.id }); socket.close(); }
