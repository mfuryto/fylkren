import assert from 'node:assert/strict';

export async function testCustomCssEncoding({ platform }) {
  const initial = await platform.request('/api/branding');
  assert.equal(initial.status, 200);
  const update = async customCss => platform.put('/api/platform/branding/', { ...initial.body, customCss });
  try {
    assert.equal((await update('.panel { border-radius: 7px; }')).status, 204);
    const unsafe = [
      '.panel { background: url("https://example.invalid/probe"); }',
      '@import "https://example.invalid/probe.css";',
      String.raw`.panel { background: u\72l("https://example.invalid/probe"); }`,
      String.raw`@\69mport "https://example.invalid/probe.css";`,
      '.panel { background: image-set("https://example.invalid/probe" 1x); }',
      '.panel { background: -webkit-image-set("https://example.invalid/probe" 1x); }',
      '.panel { background: u/**/rl("https://example.invalid/probe"); }',
      '.before::before { content: "/*"; } .panel { background: url("https://example.invalid/probe"); } .after::after { content: "*/"; }',
      '</style><script>globalThis.syntheticInjected = true</script>',
    ];
    for (const [index, customCss] of unsafe.entries()) {
      const response = await update(customCss);
      assert.equal(response.status, 400, `ASVS 1.1.1/1.3.5: unsafe CSS case ${index} returned ${response.status}`);
      const current = await platform.request('/api/branding');
      assert.equal(current.body.customCss, '.panel { border-radius: 7px; }', 'Rejected CSS must not mutate branding');
    }
    assert.equal((await update('a'.repeat(20_001))).status, 400);
    assert.equal((await update('/* internal theme */ @media (min-width: 500px) { .panel { color: #123456; } }')).status, 204);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>synthetic()</script><foreignObject>synthetic</foreignObject></svg>';
    for (const [type, name] of [['image/svg+xml', 'probe.svg'], ['image/png', 'probe.png'], ['image/jpeg', 'probe.jpg'], ['image/webp', 'probe.webp']]) {
      const form = new FormData(); form.append('logo', new Blob([svg], { type }), name);
      assert.equal((await platform.request('/api/platform/branding/logo', { method: 'PUT', body: form })).status, 400,
        'SVG/script content must be rejected even with an allowed declared type');
    }
    return { customCssEncoding: 'passed', unsafeCssRejected: unsafe.length, rejectedCssUnchanged: true };
  } finally { assert.equal((await update(initial.body.customCss)).status, 204); }
}

export async function testStoredEncoding({ leader, siteId, unitId, workItemTypeId }) {
  const root = `/api/work/sites/${siteId}/items`;
  const payloads = ['<script>synthetic()</script>', '&lt;script&gt;synthetic()&lt;/script&gt;',
    '%3Cscript%3Esynthetic()%3C/script%3E', '%253Cscript%253Esynthetic()%253C/script%253E',
    "' OR 1=1 --", "'; SELECT pg_sleep(5); --", '</script>\u2028<script>synthetic()</script>'];
  for (const payload of payloads) {
    const response = await leader.post(root, { title: `Encoding ${payload}`, description: payload,
      recommendation: payload, referenceUrl: 'https://example.invalid/document?x=%253Cscript%253E&y=%26lt%3B',
      assignedUnitId: unitId, workItemTypeId, dueAt: null });
    assert.equal(response.status, 201, `Synthetic input case returned ${response.status}`);
    const detail = await leader.request(`${root}/${response.body.id}/details`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.task.title, `Encoding ${payload}`);
    assert.equal(detail.body.task.description, payload);
    assert.equal(detail.body.task.recommendation, payload);
    assert.equal(detail.body.task.referenceUrl, 'https://example.invalid/document?x=%253Cscript%253E&y=%26lt%3B');
    const search = await leader.request(`${root}?filter=all&search=${encodeURIComponent(payload)}`);
    assert.equal(search.status, 200);
    assert.ok(search.body.items.some(value => value.id === response.body.id), 'Query decoding lost the literal search payload');
    assert.ok(search.body.items.every(value => value.title.includes(payload)), 'Search payload changed predicate meaning');
  }
  for (const literal of [String.raw`"\u003cscript\u003e"`, String.raw`"\\u003cscript\\u003e"`]) {
    const body = JSON.stringify({ title: 'SYNTHETIC_JSON_MARKER', description: '', assignedUnitId: unitId, workItemTypeId })
      .replace('"SYNTHETIC_JSON_MARKER"', literal);
    const response = await leader.request(root, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, 201);
    const detail = await leader.request(`${root}/${response.body.id}/details`);
    assert.equal(detail.body.task.title, JSON.parse(literal), 'JSON escape was decoded more than once');
  }
  const unsafeLinks = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>synthetic()</script>',
    'vbscript:synthetic()', '//example.invalid/path', 'https://name:password@example.invalid/',
    'https://example.invalid/\npath', 'java%73cript:synthetic()', 'javascript&#58;synthetic()'];
  for (const [index, referenceUrl] of unsafeLinks.entries()) {
    assert.equal((await leader.post(root, { title: 'Rejected synthetic link', description: '',
      referenceUrl, assignedUnitId: unitId, workItemTypeId })).status, 400, `Unsafe URL case ${index} must be rejected`);
  }
  for (const referenceUrl of ['https://example.invalid/path', 'http://example.invalid/path',
    'file:///synthetic/document.txt', 'smb://synthetic.invalid/share/document.txt']) {
    const response = await leader.post(root, { title: 'Accepted synthetic link', description: '',
      referenceUrl, assignedUnitId: unitId, workItemTypeId });
    assert.equal(response.status, 201);
  }
  return { storedEncoding: 'passed', literalPayloads: payloads.length, singleJsonDecodingCases: 2, unsafeLinksRejected: unsafeLinks.length, allowedSchemes: 4 };
}

export async function testNumericInputBoundaries({ platform, leader, siteManager, siteId }) {
  const routes = [[leader, `/api/work/sites/${siteId}/items`], [leader, `/api/work/sites/${siteId}/reports`],
    [leader, `/api/workflows/planning/sites/${siteId}`], [leader, `/api/execution/sites/${siteId}`],
    [siteManager, `/api/site-audit/sites/${siteId}`], [platform, '/api/platform-audit'], [platform, '/api/platform/smtp/deliveries'],
    [platform, `/api/platform/webhooks/sites/${siteId}/deliveries`], [platform, '/api/platform/identity/users'], [leader, '/api/work/learning']];
  for (const [actor, path] of routes) {
    for (const page of ['1', '1000000']) assert.equal((await actor.request(`${path}?page=${page}`)).status, 200, `Valid numeric boundary ${path}`);
    for (const page of ['2147483647', '2147483648', '0', '-1', '1000001']) {
      assert.equal((await actor.request(`${path}?page=${page}`)).status, 400, `Invalid/overflow page ${path}: ${page}`);
    }
  }
  for (const pageSize of ['0', '-1', '101', '2147483648']) {
    assert.equal((await platform.request(`/api/platform/smtp/deliveries?pageSize=${pageSize}`)).status, 400);
  }
  const original = await platform.request('/api/references/platform');
  assert.equal(original.status, 200);
  for (const nextNumber of ['-1', '9223372036854775807', '9223372036854775808']) {
    const body = `{"minimumDigits":${original.body.minimumDigits},"nextNumber":${nextNumber}}`;
    assert.equal((await platform.request('/api/references/platform', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body })).status, 400);
  }
  assert.equal((await platform.request('/api/references/platform')).body.nextNumber, original.body.nextNumber);
  return { numericInputBoundaries: 'passed', pagedEndpoints: routes.length, rejectedNumericCases: routes.length * 5 + 7 };
}

export async function testDerivedArithmeticBoundaries({ platform, siteManager, leader, siteId, unitId, workItemTypeId }) {
  const path = `/api/site-audit/sites/${siteId}`;
  const original = await siteManager.request(path);
  assert.equal(original.status, 200);
  for (const query of ['to=9999-12-31', 'from=0001-01-01&to=9999-12-31', 'to=9999-12-30']) {
    const response = await siteManager.request(`${path}?${query}`);
    process.stdout.write(`${JSON.stringify({ auditDateBoundary: query, status: response.status })}\n`);
    assert.equal(response.status, 200, 'Representable inclusive audit date caused an arithmetic error');
    assert.equal(response.body.total, original.body.total);
  }
  for (const query of ['to=10000-01-01', 'from=0000-01-01', 'to=-0001-01-01'])
    assert.equal((await siteManager.request(`${path}?${query}`)).status, 400);
  for (const year of [1900, 9998, 9999]) {
    const response = await leader.request(`/api/work/sites/${siteId}/reports?year=${year}`);
    process.stdout.write(`${JSON.stringify({ reportYearBoundary: year, status: response.status })}\n`);
    assert.equal(response.status, 200, 'Representable report year caused date arithmetic failure');
    assert.equal(response.body.total, 0);
  }
  for (const year of [1899, 10000, -1, 2147483648])
    assert.equal((await leader.request(`/api/work/sites/${siteId}/reports?year=${year}`)).status, 400);
  const machine = await platform.post('/api/platform/api-clients/', { name: 'Synthetic arithmetic machine',
    scopes: ['sites:write'], expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
  assert.equal(machine.status, 201);
  const created = await fetch(`${process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18080'}/api/v1/administration/sites`, {
    method: 'POST', headers: { Authorization: `Bearer ${machine.body.token}`, 'Content-Type': 'application/json',
      'Idempotency-Key': 'synthetic-arithmetic-site' }, body: JSON.stringify({ name: 'Synthetic arithmetic machine Site', overviewDesign: 'classic' }),
  });
  assert.equal(created.status, 201);
  const audit = await platform.request('/api/platform-audit?eventType=site.created');
  assert.equal(audit.status, 200);
  assert.ok(audit.body.total > 0 && audit.body.total <= audit.body.pageSize);
  assert.equal(audit.body.total, audit.body.events.length, 'Combined audit total disagrees with the fixture rows');
  assert.ok(audit.body.events.some(value => value.actor.startsWith('API:')) &&
    audit.body.events.some(value => !value.actor.startsWith('API:')), 'Mixed person/machine audit sources were not exercised');
  assert.equal(audit.body.totalPages, 1);
  const root = `/api/work/sites/${siteId}/items`;
  const task = await leader.post(root, { title: 'Synthetic arithmetic comments', description: 'Synthetic',
    recommendation: null, referenceUrl: null, assignedUnitId: unitId, workItemTypeId, dueAt: null });
  assert.equal(task.status, 201);
  const comments = `${root}/${task.body.id}/comments`;
  for (let index = 1; index <= 21; index++)
    assert.equal((await leader.post(comments, { text: `Synthetic comment ${index}` })).status, 201);
  const first = await leader.request(`${comments}?page=1`);
  const second = await leader.request(`${comments}?page=2`);
  assert.equal(first.status, 200); assert.equal(second.status, 200);
  assert.equal(first.body.total, 21); assert.equal(second.body.total, 21);
  assert.equal(first.body.items.length, 20); assert.equal(second.body.items.length, 1);
  assert.equal(new Set([...first.body.items, ...second.body.items].map(value => value.id)).size, 21);
  assert.equal((await leader.request(`${comments}?page=1000000`)).body.page, 2, 'Valid large page lost last-page clamping');
  for (const page of ['0', '-1', '1000001', '2147483647', '2147483648'])
    assert.equal((await leader.request(`${comments}?page=${page}`)).status, 400);
  assert.equal((await platform.request(`${comments}?page=2147483647`)).status, 403);
  return { derivedArithmeticBoundaries: 'passed', inclusiveDateCases: 3, rejectedDateCases: 3,
    reportYearCases: 3, rejectedReportYears: 4, platformAuditCount: audit.body.total,
    commentPageBoundaryRows: 21, rejectedCommentPages: 5, commentAuthorizationPreserved: true };
}
