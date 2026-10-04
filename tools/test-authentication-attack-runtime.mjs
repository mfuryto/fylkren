import assert from 'node:assert/strict';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18081';
async function attempt(path, body, index) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Fylkren-Gateway-Client-IP': `192.0.2.${index + 1}`,
      'X-Forwarded-For': `198.51.100.${index + 1}`,
    },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await response.text(); let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: response.status, body: parsed, retryAfter: response.headers.get('retry-after'), cacheControl: response.headers.get('cache-control') };
}

async function exhaust(path, body) {
  const allowed = [];
  for (let index = 0; index < 8; index++) allowed.push(await attempt(path, body, index));
  for (const result of allowed) {
    assert.equal(result.status, 401, JSON.stringify(result.body));
    assert.match(result.cacheControl ?? '', /no-store/i);
  }
  const limited = await attempt(path, body, 8);
  assert.equal(limited.status, 429, JSON.stringify(limited.body));
  assert.match(limited.retryAfter ?? '', /^\d+$/);
  assert.match(limited.cacheControl ?? '', /no-store/i);
  return limited;
}

const local = await exhaust('/api/session', { username: 'unknown-local-identity', password: 'invalid synthetic password' });
await new Promise(resolve => setTimeout(resolve, (Number(local.retryAfter) + 1) * 1000));
const directory = await exhaust('/api/session/directory', { provider: 'ldap', username: 'unknown-directory-identity', password: 'invalid synthetic password' });

process.stdout.write(`${JSON.stringify({ authenticationAttackBoundary: 'passed',
  permitLimit: 8, localSignInLimited: true, directorySignInLimited: true,
  spoofedClientAddressHeadersIgnored: true, numericRetryAfter: true,
  genericNonCacheableFailures: true })}\n`);
