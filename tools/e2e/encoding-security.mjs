import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

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

export async function testQueryInputValidation({ platform, leader, siteManager, siteId, unitId, workItemTypeId }) {
  const invalid = [
    [platform, '/api/platform-audit?sort=sideways'],
    [platform, `/api/platform-audit?eventType=${'x'.repeat(101)}`],
    [siteManager, `/api/site-audit/sites/${siteId}?area=unknown`],
    [siteManager, `/api/site-audit/sites/${siteId}?sort=sideways`],
    [siteManager, `/api/site-audit/sites/${siteId}?eventType=${'x'.repeat(101)}`],
    [siteManager, `/api/site-audit/sites/${siteId}?from=2026-10-02&to=2026-10-01`],
    [leader, '/api/work/learning?view=unknown'],
    [leader, '/api/work/learning?kind=unknown'],
    [leader, '/api/work/learning?priority=urgent'],
    [leader, '/api/work/learning?sort=sideways'],
    [leader, `/api/work/sites/${siteId}/items?filter=unknown`],
    [leader, `/api/work/sites/${siteId}/items?sort=sideways`],
    [leader, `/api/work/sites/${siteId}/reports?sort=sideways`],
    [leader, `/api/workflows/planning/sites/${siteId}?sort=sideways`],
    [leader, `/api/execution/sites/${siteId}?sort=sideways`],
    [platform, `/api/people?siteId=${siteId}&q=${'x'.repeat(201)}`],
    [platform, '/api/platform/operations/logs?level=Trace'],
    [platform, '/api/platform/operations/logs?limit=0'],
    [platform, '/api/platform/operations/logs?limit=301'],
  ];
  for (const [actor, path] of invalid)
    assert.equal((await actor.request(path)).status, 400, `Unsupported query input was accepted: ${path}`);

  const root = `/api/work/sites/${siteId}/items`;
  const task = await leader.post(root, { title: 'Synthetic query validation task', description: 'Synthetic',
    recommendation: null, referenceUrl: null, assignedUnitId: unitId, workItemTypeId, dueAt: null });
  assert.equal(task.status, 201, JSON.stringify(task.body));
  assert.equal((await leader.put(`${root}/${task.body.id}/status`, {
    status: 'under_review', assignedUnitId: unitId, decisionNote: null, priority: 'normal' })).status, 204);
  const oversizedDependencySearch = await leader.request(`${root}/${task.body.id}/dependency-candidates?search=${'x'.repeat(201)}`);
  assert.equal(oversizedDependencySearch.status, 400, 'Oversized dependency search was accepted');

  const valid = [
    [platform, '/api/platform-audit?sort=oldest'],
    [siteManager, `/api/site-audit/sites/${siteId}?area=tasks&sort=newest`],
    [leader, '/api/work/learning?view=active&sort=priority'],
    [leader, `/api/work/sites/${siteId}/items?filter=active&sort=reference-asc`],
    [leader, `/api/work/sites/${siteId}/reports?sort=name-desc`],
    [leader, `/api/workflows/planning/sites/${siteId}?sort=reference-desc`],
    [leader, `/api/execution/sites/${siteId}?sort=name-asc`],
    [platform, '/api/platform/operations/logs?level=Warning&limit=300'],
  ];
  for (const [actor, path] of valid)
    assert.equal((await actor.request(path)).status, 200, `Documented query input failed: ${path}`);

  return { queryInputValidation: 'passed', rejectedQueryCases: invalid.length + 1,
    acceptedQueryCases: valid.length, queryEndpoints: 10 };
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

export async function testContextualInputRules({ leader, personId, siteId, unitId, workItemTypeId }) {
  const root = `/api/work/sites/${siteId}/items`;
  const create = async label => {
    const response = await leader.post(root, { title: `Synthetic context ${label}`, description: 'Synthetic contextual validation',
      recommendation: null, referenceUrl: null, assignedUnitId: unitId, workItemTypeId, dueAt: null });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal((await leader.put(`${root}/${response.body.id}/status`, {
      status: 'under_review', assignedUnitId: unitId, decisionNote: null, priority: 'normal' })).status, 204);
    return response.body.id;
  };
  const first = await create('first');
  const second = await create('second');
  const unrelatedBefore = (await leader.request(`${root}/${first}/dependencies`)).body.length;
  assert.equal((await leader.post(`${root}/${first}/dependencies`, { predecessorWorkItemId: first })).status, 409);
  assert.equal((await leader.post(`${root}/${first}/dependencies`, { predecessorWorkItemId: second })).status, 201);
  assert.equal((await leader.post(`${root}/${first}/dependencies`, { predecessorWorkItemId: second })).status, 409);
  assert.equal((await leader.post(`${root}/${second}/dependencies`, { predecessorWorkItemId: first })).status, 409);
  assert.equal((await leader.request(`${root}/${first}/dependencies`)).body.length, unrelatedBefore + 1,
    'Rejected self/duplicate/cycle dependency changed the graph');

  const invalidRecipient = await leader.post(root, { title: 'Synthetic invalid recipient pair', description: 'Synthetic',
    recommendation: null, referenceUrl: null, assignedUnitId: unitId, workItemTypeId, dueAt: null,
    targetSiteId: siteId, targetUnitId: unitId });
  assert.equal(invalidRecipient.status, 400, 'Conflicting recipient fields were accepted');

  const riskPath = `/api/risks/sites/${siteId}/task/${first}`;
  const risk = { title: 'Synthetic contextual risk', description: 'Synthetic paired risk values', probability: 3,
    impact: 4, ownerPersonId: personId, status: 'identified', dueDate: null };
  for (const residual of [{ residualProbability: 2, residualImpact: null },
    { residualProbability: null, residualImpact: 2 }, { residualProbability: 0, residualImpact: 2 }])
    assert.equal((await leader.post(riskPath, { ...risk, ...residual })).status, 400);
  assert.equal((await leader.request(riskPath)).body.length, 0, 'Invalid residual pairs partially created risks');
  const validRisk = await leader.post(riskPath, { ...risk, residualProbability: 2, residualImpact: 2 });
  assert.equal(validRisk.status, 201);
  assert.equal((await leader.request(riskPath)).body[0].current.residualScore, 4);

  const decisionPath = `/api/decisions/sites/${siteId}/tasks/${first}`;
  const decision = { title: 'Synthetic contextual decision', decision: 'Proceed', rationale: 'Synthetic rationale',
    status: 'recorded', decisionMakerIds: [personId], references: [] };
  assert.equal((await leader.post(decisionPath, { ...decision, decisionMakerIds: [randomUUID()] })).status, 400);
  assert.equal((await leader.post(decisionPath, { ...decision,
    references: [{ objectType: 'work_item', objectId: randomUUID() }] })).status, 400);
  assert.equal((await leader.request(decisionPath)).body.length, 0, 'Invalid related decision fields partially created history');
  assert.equal((await leader.post(decisionPath, decision)).status, 201);
  assert.equal((await leader.request(decisionPath)).body.length, 1);

  return { contextualInputRules: 'passed', dependencyRelationshipRejections: 3,
    conflictingRecipientRejected: true, residualPairRejections: 3, decisionRelationshipRejections: 2,
    rejectedCommandsAtomic: true };
}

export async function testVersionMutationBoundaries({ platform, siteManager, leader, personId, siteId, unitId, workItemTypeId }) {
  assert.equal(process.env.FYLKREN_COMPOSE_PROJECT, 'fylkren-edition-e2e', 'Capacity seeding is restricted to the disposable API lab');
  const guid = value => { assert.match(value, /^[0-9a-f-]{36}$/i); return value; };
  const sql = query => execFileSync('docker', ['compose', '-p', 'fylkren-edition-e2e', 'exec', '-T', 'postgres',
    'psql', '-U', 'fylkren', '-d', 'fylkren', '-tA', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding: 'utf8' }).trim();
  const siteSnapshot = () => sql(`SELECT json_build_object('name',name,'version',version::text,'active',is_active,'design',overview_design) FROM sites WHERE id='${guid(siteId)}'`);
  const original = JSON.parse(siteSnapshot());
  for (const capacity of ['9223372036854775807', '9223372036854775806']) {
    sql(`UPDATE sites SET version=${capacity} WHERE id='${guid(siteId)}'`);
    const before = siteSnapshot();
    const response = await platform.put(`/api/sites/${siteId}`, { name: 'Synthetic refused capacity', parentOrganizationUnitId: null,
      isActive: true, overviewDesign: 'classic' });
    assert.equal(response.status, 409); assert.equal(response.body.code, 'numeric_capacity_exceeded');
    assert.equal(siteSnapshot(), before, 'Capacity refusal partially persisted the multi-mutation Site action');
  }
  assert.match(original.version, /^\d+$/);
  sql(`UPDATE sites SET version=${original.version} WHERE id='${guid(siteId)}'`);
  const oldOrder = sql(`SELECT sort_order FROM organization_units WHERE id='${guid(unitId)}'`);
  sql(`UPDATE organization_units SET sort_order=2147483647 WHERE id='${guid(unitId)}'`);
  const unitBody = { name: 'Synthetic capacity unit', parentId: null, isTemporary: false, worksAtParentLevel: false, isSiteLeadership: false };
  const unitsBefore = sql(`SELECT count(*) FROM organization_units WHERE site_id='${guid(siteId)}'`);
  const unitResponse = await siteManager.post(`/api/sites/${siteId}/organization-units`, unitBody);
  assert.equal(unitResponse.status, 409); assert.equal(unitResponse.body.code, 'numeric_capacity_exceeded');
  assert.equal(sql(`SELECT count(*) FROM organization_units WHERE site_id='${guid(siteId)}'`), unitsBefore);
  assert.match(oldOrder, /^\d+$/);
  sql(`UPDATE organization_units SET sort_order=${oldOrder} WHERE id='${guid(unitId)}'`);
  assert.equal((await siteManager.post(`/api/sites/${siteId}/organization-units`, unitBody)).status, 201);
  const root = `/api/work/sites/${siteId}/items`;
  const task = await leader.post(root, { title: 'Synthetic version context', description: 'Synthetic', recommendation: null,
    referenceUrl: null, assignedUnitId: unitId, workItemTypeId, dueAt: null });
  assert.equal(task.status, 201);
  const decisions = `/api/decisions/sites/${siteId}/tasks/${task.body.id}`;
  const decisionBody = { title: 'Synthetic version decision', decision: 'Synthetic decision', rationale: 'Synthetic rationale',
    status: 'recorded', decisionMakerIds: [personId], references: [] };
  const decision = await leader.post(decisions, decisionBody); assert.equal(decision.status, 201);
  assert.equal((await leader.put(`/api/decisions/${decision.body.id}`, { ...decisionBody, expectedRevision: 1 })).status, 200);
  const decisionResult = (await leader.request(decisions)).body.find(value => value.id === decision.body.id);
  assert.equal(decisionResult.current.revisionNumber, 2); assert.equal(decisionResult.revisions.length, 2);
  assert.equal((await platform.put(`/api/decisions/${decision.body.id}`, { ...decisionBody, expectedRevision: 2 })).status, 403);
  const risks = `/api/risks/sites/${siteId}/task/${task.body.id}`;
  const riskBody = { title: 'Synthetic version risk', description: 'Synthetic operational risk', probability: 4, impact: 5,
    ownerPersonId: personId, status: 'identified', dueDate: null, residualProbability: null, residualImpact: null };
  const risk = await leader.post(risks, riskBody); assert.equal(risk.status, 201);
  assert.equal((await leader.put(`/api/risks/${risk.body.id}`, { ...riskBody, expectedVersion: 1 })).status, 200);
  const measureBody = { action: 'Synthetic mitigation action', ownerPersonId: personId, status: 'planned', dueDate: null };
  const measure = await leader.post(`/api/risks/${risk.body.id}/mitigations`, measureBody); assert.equal(measure.status, 201);
  assert.equal((await leader.put(`/api/risks/mitigations/${measure.body.id}`, { ...measureBody, expectedVersion: 1 })).status, 200);
  for (const [table, column, id] of [['risk_revisions', 'risk_id', risk.body.id], ['risk_mitigation_revisions', 'mitigation_id', measure.body.id]]) {
    // Insert synthetic historical capacity rows; never rewrite a retained revision.
    sql(`BEGIN; SELECT set_config('fylkren.activity_writer','1',true);
      INSERT INTO ${table} SELECT (jsonb_populate_record(NULL::${table},to_jsonb(r)||jsonb_build_object('id',gen_random_uuid(),'version',2147483647))).*
      FROM ${table} r WHERE ${column}='${guid(id)}' AND version=2; COMMIT;`);
  }
  const before = (await leader.request(risks)).body;
  for (const [path, body] of [[`/api/risks/${risk.body.id}`, riskBody], [`/api/risks/mitigations/${measure.body.id}`, measureBody]]) {
    const response = await leader.put(path, { ...body, expectedVersion: 2147483647 });
    assert.equal(response.status, 409); assert.equal(response.body.code, 'numeric_capacity_exceeded');
  }
  assert.deepEqual((await leader.request(risks)).body, before, 'Capacity refusal changed risk/mitigation history');
  return { versionMutationBoundaries: 'passed', atomicSiteCapacityCases: 2, sortOrderCapacityRejected: true,
    decisionNormalRevisions: 2, decisionAuthorizationPreserved: true, riskAndMeasureNormalRevisions: 2, riskAndMeasureCapacityRejected: true };
}

export async function testSqlAuthenticationCounter({ actor, client, authenticationPost }) {
  assert.equal(process.env.FYLKREN_COMPOSE_PROJECT, 'fylkren-edition-e2e');
  assert.match(actor.personId, /^[0-9a-f-]{36}$/i);
  const sql = query => execFileSync('docker', ['compose', '-p', 'fylkren-edition-e2e', 'exec', '-T', 'postgres',
    'psql', '-U', 'fylkren', '-d', 'fylkren', '-tA', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding: 'utf8' }).trim();
  const row = `person_id='${actor.personId}'`;
  const snapshot = () => JSON.parse(sql(`SELECT json_build_object('count',failed_authentication_count,'locked',coalesce(authentication_locked_until > now(),false)) FROM login_identities WHERE ${row}`));
  sql(`UPDATE login_identities SET failed_authentication_count=2147483647,authentication_locked_until=NULL WHERE ${row}`);
  const exhausted = await authenticationPost(client(), '/api/session',
    { username: actor.username, password: 'Synthetic deliberately invalid password' });
  assert.equal(exhausted.status, 401, 'Exhausted counter must fail generically without SQL overflow');
  assert.deepEqual(snapshot(), {count:20,locked:true});
  const correctWhileLocked = await authenticationPost(client(), '/api/session',
    { username: actor.username, password: actor.password });
  assert.equal(correctWhileLocked.status, 401, 'Correct password must still respect the account lock');
  sql(`UPDATE login_identities SET failed_authentication_count=18,authentication_locked_until=NULL WHERE ${row}`);
  const failures = await Promise.all(Array.from({ length: 3 }, () => authenticationPost(client(), '/api/session',
    {username: actor.username, password: 'Synthetic deliberately invalid password'})));
  assert.deepEqual(failures.map(x => x.status), [401,401,401]);
  assert.deepEqual(snapshot(), {count:20,locked:true}, 'Concurrent failures must saturate atomically');
  sql(`UPDATE login_identities SET authentication_locked_until=now()-interval '1 minute' WHERE ${row}`);
  assert.equal((await authenticationPost(client(), '/api/session', { username: actor.username, password: actor.password })).status, 204);
  assert.equal(snapshot().count, 0, 'Successful post-lock login clears the failure count');
  return {sqlAuthenticationCounter:'passed', exhaustedCounterSaturated:true, concurrentFailures:3,
    activeLockRespected:true, postExpiryLoginAccepted:true};
}
