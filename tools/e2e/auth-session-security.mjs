import assert from 'node:assert/strict';

function cookieHeader(cookies) {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
}

function updateCookies(cookies, response) {
  for (const value of response.headers.getSetCookie()) {
    const [pair] = value.split(';');
    const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

async function request(base, cookies, path, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (cookies.size) headers.Cookie = cookieHeader(cookies);
  const response = await fetch(`${base}${path}`, { ...options, headers, redirect: 'manual' });
  const setCookies = response.headers.getSetCookie();
  updateCookies(cookies, response);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body, headers: response.headers, setCookies };
}

export async function testAuthSessionSecurity({ base, username, password }) {
  const cookies = new Map();
  const login = await request(base, cookies, '/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(login.status, 204, JSON.stringify(login.body));
  const sessionCookie = login.setCookies.find(value => /(?:^|;\s*)(?:Fylkren\.Session|__Host-Fylkren)=/.test(value));
  assert.ok(sessionCookie, 'Login must set the session cookie');
  assert.match(sessionCookie, /;\s*httponly(?:;|$)/i, 'Session cookie must be HttpOnly');
  assert.match(sessionCookie, /;\s*samesite=strict(?:;|$)/i, 'Session cookie must be SameSite=Strict');
  const stolenCookie = cookieHeader(cookies);

  const antiforgery = await request(base, cookies, '/api/security/antiforgery');
  assert.equal(antiforgery.status, 200, JSON.stringify(antiforgery.body));
  assert.equal(typeof antiforgery.body.token, 'string');

  const missingToken = await request(base, new Map(cookies), '/api/session', { method: 'DELETE' });
  assert.equal(missingToken.status, 400, 'Sign-out without CSRF token must be rejected');
  const wrongToken = await request(base, new Map(cookies), '/api/session', {
    method: 'DELETE', headers: { 'X-Fylkren-CSRF': 'invalid-token' },
  });
  assert.equal(wrongToken.status, 400, 'Sign-out with invalid CSRF token must be rejected');

  const logout = await request(base, cookies, '/api/session', {
    method: 'DELETE', headers: { 'X-Fylkren-CSRF': antiforgery.body.token },
  });
  assert.equal(logout.status, 204, JSON.stringify(logout.body));

  const replay = await fetch(`${base}/api/session`, { headers: { Cookie: stolenCookie }, redirect: 'manual' });
  assert.equal(replay.status, 200);
  const replayBody = await replay.json();
  assert.equal(replayBody.authenticated, false, 'A copied session cookie must fail immediately after sign-out');

  return { sessionCookieAttributes: 'passed', csrfSignOut: 'passed', signedOutCookieReplay: 'passed' };
}

export async function testAuthenticationBoundary({ base }) {
  async function login(username, password) {
    const response = await fetch(`${base}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      redirect: 'manual',
    });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { response, body };
  }

  const unknown = await login('security-test-user-that-does-not-exist', 'invalid-security-test-password');
  assert.equal(unknown.response.status, 401, JSON.stringify(unknown.body));
  assert.equal(unknown.body.title, 'Invalid username or password');
  assert.match(unknown.response.headers.get('cache-control') ?? '', /no-store/i);
  assert.doesNotMatch(JSON.stringify(unknown.body), /stack|exception|sql|password hash/i);

  const oversized = await login('u'.repeat(321), 'x');
  assert.equal(oversized.response.status, 401, JSON.stringify(oversized.body));
  assert.equal(oversized.body.title, unknown.body.title, 'Malformed and unknown identities must fail generically');

  let limited;
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await login(`security-rate-test-${attempt}`, 'invalid-security-test-password');
    if (result.response.status === 429) {
      limited = result;
      break;
    }
    assert.equal(result.response.status, 401, JSON.stringify(result.body));
  }
  assert.ok(limited, 'Authentication rate limit must reject repeated attempts');
  assert.match(limited.response.headers.get('cache-control') ?? '', /no-store/i);
  assert.match(limited.response.headers.get('retry-after') ?? '', /^\d+$/, '429 must provide a Retry-After delay');

  return { genericAuthenticationFailure: 'passed', authenticationRateLimit: 'passed' };
}
