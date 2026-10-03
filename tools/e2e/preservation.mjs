import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export async function testPreservation({ platform, unauthorized, siteId }) {
  const path = `/api/information/preservation/site/${siteId}`;
  const read = async () => { const r = await platform.request(path); assert.equal(r.status, 200); return r.body; };
  assert.equal((await unauthorized.request(path)).status, 403);
  assert.equal((await unauthorized.post(`${path}/holds`, { expectedVersion: 0, reason: 'Unauthorized preservation' })).status, 403);
  let state = await read();
  assert.equal(state.automaticRetentionEnabled, false); assert.equal(state.irreversibleEnabled, false);
  const add = async reason => { const r = await platform.post(`${path}/holds`, { expectedVersion: state.version, reason }); assert.equal(r.status, 200, JSON.stringify(r.body)); state = await read(); return r.body.id; };
  const first = await add('Preserve original customer evidence');
  const second = await add('Independent preservation responsibility');
  const stale = await platform.post(`${path}/holds/${first}/release`, { expectedVersion: state.version - 1, reason: 'Stale writer' }); assert.equal(stale.status, 409);
  let r = await platform.post(`${path}/holds/${first}/release`, { expectedVersion: state.version, reason: 'First review completed' }); assert.equal(r.status, 200); state = await read(); assert.equal(state.held, true, 'Release cleared another active hold');
  const blocked = await platform.post(`/api/information/governance/site/${siteId}/transitions`, { stage: 'closed', expectedVersion: state.version, reason: 'Held closure' }); assert.equal(blocked.status, 409);
  r = await platform.post(`${path}/holds/${second}/release`, { expectedVersion: state.version, reason: 'Second review completed' }); assert.equal(r.status, 200); state = await read(); assert.equal(state.held, false);
  const policy = await platform.post('/api/information/preservation/policies', { expectedVersion: 0, name: 'Synthetic explicit review', category: 'content', reviewAfterDays: null, reason: 'Configurable metadata without retention execution' }); assert.equal(policy.status, 200, JSON.stringify(policy.body)); assert.equal(policy.body.reviewAfterDays, null);
  r = await platform.post('/api/information/preservation/policies', { policyId: policy.body.policyId, expectedVersion: 1, name: 'Synthetic revised review', category: 'content', reviewAfterDays: 90, reason: 'Customer configured review, not disposal' }); assert.equal(r.status, 200); assert.equal(r.body.version, 2);
  const invalid = await platform.post('/api/information/preservation/policies', { policyId: policy.body.policyId, expectedVersion: 1, name: 'Stale policy', category: 'content', reviewAfterDays: 1, reason: 'Stale version' }); assert.equal(invalid.status, 409);
  const changedCategory = await platform.post('/api/information/preservation/policies', { policyId: policy.body.policyId, expectedVersion: 2, name: 'Wrong category', category: 'security_audit', reviewAfterDays: 1, reason: 'Wrong category' }); assert.equal(changedCategory.status, 409);
  const badDays = await platform.post('/api/information/preservation/policies', { expectedVersion: 0, name: 'Invalid duration', category: 'content', reviewAfterDays: 0, reason: 'Invalid duration' }); assert.equal(badDays.status, 400);
  r = await platform.post(`${path}/policy`, { policyId: policy.body.policyId, policyVersion: 1, expectedVersion: state.version, reason: 'Bind original immutable policy version' }); assert.equal(r.status, 200); state = await read(); assert.equal(state.policyVersion, 1);
  const exit = await platform.request(`/api/portability/sites/${siteId}/exit`); assert.equal(exit.status, 200); assert.equal(exit.body.irreversibleEnabled, false); assert.equal(exit.body.restorationSupported, false);
  return { preservationHolds: 'passed', immutablePolicyVersions: 'passed', retentionExecutionDisabled: 'passed' };
}

export async function testExportAcknowledgement({ account, unauthorized, siteId, bytes }) {
  const root = `/api/portability/sites/${siteId}/exports`;
  const receipts = await account.request(root); assert.equal(receipts.status, 200);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const receipt = receipts.body.find(r => r.packageSha256 === digest); assert.ok(receipt); assert.equal(receipt.packageBytes, bytes.length);
  assert.equal((await unauthorized.request(root)).status, 403);
  const path = `${root}/${receipt.id}/acknowledge`;
  let r = await account.post(path, { expectedVersion: receipt.version, packageSha256: '0'.repeat(64), reason: 'Wrong saved file' }); assert.equal(r.status, 409);
  r = await account.post(path, { expectedVersion: 0, packageSha256: digest, reason: 'Stale handoff' }); assert.equal(r.status, 409);
  r = await account.post(path, { expectedVersion: receipt.version, packageSha256: digest, reason: 'Synthetic customer verified saved package' }); assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await account.post(path, { expectedVersion: r.body.version, packageSha256: digest, reason: 'Repeat acknowledgement' }); assert.equal(r.status, 409);
  const exit = await account.request(`/api/portability/sites/${siteId}/exit`); assert.equal(exit.status, 200); assert.equal(exit.body.irreversibleEnabled, false); assert.equal(exit.body.handoffAcknowledged, true);
  return { verifiedExportCustody: 'passed' };
}
