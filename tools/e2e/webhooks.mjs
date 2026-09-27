import assert from 'node:assert/strict';

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function testWebhookFailureIsolation({ platform, leader, unrelated, siteId, otherSiteId, taskId, suffix }) {
  const catalog = await platform.request('/api/platform/webhooks/catalog');
  assert.equal(catalog.status, 200);
  for (const type of ['task.created', 'task.completed', 'assignment.created', 'plan.approved', 'execution.started', 'decision.recorded']) {
    assert.ok(catalog.body.some(value => value.eventType === type && value.schemaVersion === 1),
      `Versioned event type missing: ${type}`);
  }
  const endpoint = `/api/platform/webhooks/sites/${siteId}`;
  const invalidUrl = await platform.post(endpoint, {
    name: 'Synthetic invalid HTTP webhook', endpointUrl: 'http://127.0.0.1:1/hooks', eventTypes: ['task.created'],
  });
  assert.equal(invalidUrl.status, 400, 'Non-HTTPS receiver accepted');
  const invalidType = await platform.post(endpoint, {
    name: 'Synthetic invalid type', endpointUrl: 'https://127.0.0.1:1/hooks', eventTypes: ['unknown.event'],
  });
  assert.equal(invalidType.status, 400, 'Unsupported event type accepted');
  const created = await platform.post(endpoint, {
    name: `Synthetic failed delivery ${suffix}`, endpointUrl: 'https://127.0.0.1:1/hooks',
    eventTypes: ['task.created', 'decision.recorded'],
  });
  assert.equal(created.status, 201, `Subscription: ${JSON.stringify(created.body)}`);
  const subscriptionId = created.body.id;
  assert.match(created.body.secret, /^[0-9a-f]{64}$/);
  const list = await platform.request(endpoint);
  assert.equal(list.status, 200);
  assert.ok(list.body.some(value => value.id === subscriptionId && value.isActive));
  assert.ok(!JSON.stringify(list.body).includes(created.body.secret), 'Signing secret leaked in subscription list');
  async function createTask(account, targetSiteId, label) {
    const response = await account.post(`/api/work/sites/${targetSiteId}/items`, {
      title: `Synthetic webhook ${label} ${suffix}`, description: 'Synthetic event isolation',
      recommendation: null, referenceUrl: null, dueAt: null, workItemTypeId: null,
      sourceTypeId: null, senderId: null, targetSiteId: null, targetUnitId: null, assignedUnitId: null,
    });
    assert.equal(response.status, 201, `${label}: ${JSON.stringify(response.body)}`);
    return response.body.id;
  }
  const sameSiteTaskId = await createTask(leader, siteId, 'same-site');
  await createTask(unrelated, otherSiteId, 'other-site');
  const decision = await leader.post(`/api/decisions/sites/${siteId}/tasks/${taskId}`, {
    title: `Synthetic webhook decision ${suffix}`, decision: 'Documented event decision',
    rationale: 'Synthetic webhook event test', status: 'recorded',
    decisionMakerIds: null, references: [],
  });
  assert.equal(decision.status, 201, `Decision event: ${JSON.stringify(decision.body)}`);
  let deliveries;
  for (let attempt = 0; attempt < 12; attempt++) {
    deliveries = await platform.request(`${endpoint}/deliveries?page=1`);
    assert.equal(deliveries.status, 200);
    const current = deliveries.body.items.filter(value => value.subscriptionId === subscriptionId);
    if (current.length >= 2 && current.every(value => value.attemptCount >= 1)) break;
    await delay(2500);
  }
  const own = deliveries.body.items.filter(value => value.subscriptionId === subscriptionId);
  assert.equal(own.length, 2, `Expected only own task and decision: ${JSON.stringify(own)}`);
  assert.deepEqual(new Set(own.map(value => value.eventType)), new Set(['task.created', 'decision.recorded']));
  assert.ok(own.some(value => value.attemptCount >= 1 && value.status === 'retry'),
    `Failed delivery has no visible retry state: ${JSON.stringify(own)}`);
  assert.ok(own.every(value => value.lastError && value.lastError.length > 0),
    'Failed delivery lacks a concrete reason');
  const otherDeliveries = await platform.request(`/api/platform/webhooks/sites/${otherSiteId}/deliveries?page=1`);
  assert.equal(otherDeliveries.status, 200);
  assert.equal(otherDeliveries.body.total, 0, 'Subscription leaked into unrelated site');
  const deactivated = await platform.request(`${endpoint}/${subscriptionId}`, { method: 'DELETE' });
  assert.equal(deactivated.status, 204);
  const afterDeactivate = await platform.request(endpoint);
  assert.equal(afterDeactivate.body.find(value => value.id === subscriptionId)?.isActive, false);
  await createTask(leader, siteId, 'after-deactivation');
  await delay(12000);
  const historical = await platform.request(`${endpoint}/deliveries?page=1`);
  assert.equal(historical.body.items.filter(value => value.subscriptionId === subscriptionId).length, 2,
    'Deactivated subscription created new deliveries or deleted historical ones');
  return { webhookSubscriptionId: subscriptionId, webhookEventTaskId: sameSiteTaskId, webhookDecisionId: decision.body.id };
}
