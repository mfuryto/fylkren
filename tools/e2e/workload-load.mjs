import assert from 'node:assert/strict';

// Invoked only after functional assertions, before disposal of the synthetic edition topology.
export async function measureWorkload({ leader, platform, siteId, unitId, workItemTypeId }) {
  const count = 1000; let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < count) {
      const index = next++;
      const created = await leader.post(`/api/work/sites/${siteId}/items`, {
        title: `Synthetic load item ${String(index).padStart(4, '0')}`, description: 'Disposable performance fixture',
        recommendation: null, referenceUrl: null, dueAt: null, workItemTypeId,
        sourceTypeId: null, senderId: null, targetSiteId: null, targetUnitId: null, assignedUnitId: unitId,
      });
      assert.equal(created.status, 201, 'Creating the controlled workload failed');
    }
  }));
  const queue = await leader.request(`/api/work/sites/${siteId}/items?search=Synthetic%20load%20item&filter=all`);
  assert.equal(queue.status, 200); assert.equal(queue.body.total, count); assert.ok(queue.body.items.length <= queue.body.pageSize);
  const paths = [`/api/work/sites/${siteId}/items?filter=active`, `/api/work/navigation-counts`,
    `/api/work/learning?siteId=${siteId}&view=all`, `/api/work/sites/${siteId}/reports`,
    `/api/work/sites/${siteId}/workload-history`];
  const metrics = [];
  for (const concurrency of [1, 10, 25]) {
    let index = 0; const elapsed = []; const byPath = new Map();
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (index < 100) {
        const path = paths[index++ % paths.length], start = performance.now();
        const value = await leader.request(path); const duration = performance.now() - start; elapsed.push(duration);
        const samples = byPath.get(path) ?? []; samples.push(duration); byPath.set(path, samples);
        assert.equal(value.status, 200, `Load read failed at concurrency ${concurrency}`);
        const denied = await platform.request(`/api/work/sites/${siteId}/items`);
        assert.equal(denied.status, 403, 'Administrative identity gained operational access under load');
      }
    }));
    elapsed.sort((a, b) => a - b);
    metrics.push({ concurrency, authorizedRequests: elapsed.length, unauthorizedRequestsRejected: elapsed.length,
      p50Ms: Math.round(elapsed[49]), p95Ms: Math.round(elapsed[94]), p99Ms: Math.round(elapsed[98]), maxMs: Math.round(elapsed.at(-1)),
      byEndpoint: [...byPath].map(([path, samples]) => { samples.sort((a, b) => a - b); return { endpoint: path.replace(siteId, '{siteId}'), p95Ms: Math.round(samples[Math.ceil(samples.length * .95) - 1]), maxMs: Math.round(samples.at(-1)) }; }) });
  }
  return { workloadLoad: 'passed', createdTasks: count, metrics };
}
