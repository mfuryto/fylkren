import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function testFederationCandidates({ platform, siteManager, rootSiteId }) {
  const identity = await platform.request('/api/platform/federation/identity');
  assert.equal(identity.status, 200, JSON.stringify(identity.body));
  assert.equal(identity.body.keyConfigured, false);
  assert.equal((await siteManager.request('/api/platform/federation/identity')).status, 403);

  const createdIdentity = await platform.post('/api/platform/federation/identity', {});
  assert.equal(createdIdentity.status, 200, JSON.stringify(createdIdentity.body));
  assert.equal(createdIdentity.body.instanceId, identity.body.instanceId);
  assert.ok(createdIdentity.body.publicKeySpki);
  assert.equal((await platform.post('/api/platform/federation/identity', {})).status, 409);

  const peerId = randomUUID();
  const ownPeer = await platform.post('/api/platform/federation/peers', {
    instanceId: identity.body.instanceId, name: 'Self',
    baseUrl: 'https://self.example.invalid', fingerprint: '0'.repeat(64),
  });
  assert.equal(ownPeer.status, 400, JSON.stringify(ownPeer.body));
  const invalidDiscovery = await platform.post('/api/platform/federation/peers/discover', {
    baseUrl: 'http://peer.example.invalid',
  });
  assert.equal(invalidDiscovery.status, 400, JSON.stringify(invalidDiscovery.body));
  const listed = await platform.request('/api/platform/federation/peers');
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  assert.equal(listed.body.length, 0);

  return { peerId, rootSiteId };
}
