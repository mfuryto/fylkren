import { createHash, randomBytes, sign } from 'node:crypto';

export function machineCredential(body) {
  if (!body?.keyId || !body?.privateKey) throw new Error('Signed machine credential is incomplete');
  return { keyId: body.keyId, privateKey: body.privateKey };
}

export async function signedMachineRequest(base, credential, path, { method = 'GET', body, headers = {} } = {}) {
  const rawBody = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString('base64url');
  const bodyHash = createHash('sha256').update(rawBody ?? '').digest('hex');
  const canonical = `FYLKREN-MACHINE-V2\n${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`;
  const signature = sign('sha256', Buffer.from(canonical), {
    key: credential.privateKey, dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  return fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Fylkren-Signature ${credential.keyId}`,
      'X-Fylkren-Timestamp': timestamp,
      'X-Fylkren-Nonce': nonce,
      'X-Fylkren-Content-SHA256': bodyHash,
      'X-Fylkren-Signature': signature,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: rawBody,
    redirect: 'manual',
  });
}
