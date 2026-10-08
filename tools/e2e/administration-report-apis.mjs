import assert from 'node:assert/strict';
import { machineCredential, signedMachineRequest } from './machine-auth.mjs';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18080';

async function machineRequest(credential, path, options = {}) {
  const response = credential
    ? await signedMachineRequest(base, credential, path, options)
    : await fetch(`${base}${path}`, { ...options, body: options.body === undefined ? undefined : JSON.stringify(options.body), redirect: 'manual' });
  const raw = await response.text();
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = raw; }
  return { status: response.status, body: parsed, etag: response.headers.get('etag') };
}

export async function testAdministrationReportApis({ platform, leader, leaderPersonId, siteId, childSiteId, sectionId, teamId, topReportId, sectionReportId, teamReportId, incompleteReportId, suffix, executeDefault }) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  async function createClient(name, scopes) {
    const result = await platform.post('/api/platform/api-clients/', { name, scopes, expiresAt });
    assert.equal(result.status, 201, `${name} client creation failed`);
    assert.ok(result.body.id && result.body.privateKey && result.body.keyId, `${name} client has no ID or one-time signing key`);
    return { id: result.body.id, token: machineCredential(result.body) };
  }
  const full = await createClient(`Synthetic API ${suffix}`, [
    'sites:read', 'sites:write', 'sites:move', 'sites:deactivate',
    'users:read', 'users:assign', 'users:move', 'users:deactivate',
    'classifications:read', 'classifications:write', 'reports:read',
    'work:read', 'work:write', 'work:transition', 'activity:read',
    'decisions:write', 'risks:write', 'planning:write', 'execution:write',
  ]);
  const limited = await createClient(`Synthetic limited API ${suffix}`, ['sites:read']);
  const admin = '/api/v1/administration';
  const reports = '/api/v1/reports';
  const work = '/api/v1/work';
  assert.equal((await machineRequest(null, `${admin}/sites`)).status, 401, 'Unauthenticated administration read succeeded');
  assert.equal((await machineRequest(limited.token, `${admin}/sites`)).status, 200, 'sites:read client denied');
  assert.equal((await machineRequest(limited.token, `${reports}?siteId=${siteId}`)).status, 403, 'Missing reports:read scope accepted');
  assert.equal((await machineRequest(full.token, `${reports}?siteId=${siteId}`)).status, 403, 'Report access without a grant succeeded');
  assert.equal((await machineRequest(full.token, `${work}/items?siteId=${siteId}`)).status, 403, 'Work access without a grant succeeded');
  const openapi = await machineRequest(full.token, '/api/v1/openapi.json');
  assert.equal(openapi.status, 200, `OpenAPI document: ${JSON.stringify(openapi.body)}`);
  assert.equal(openapi.body.openapi, '3.1.0');
  assert.ok(openapi.body.paths['/api/v1/work/items/{itemId}'], 'OpenAPI omitted the work-item contract');

  const siteName = `Synthetic API-managed ${suffix}`;
  const key = `site-create-${suffix}`;
  const siteBody = { name: siteName, overviewDesign: 'classic' };
  const created = await machineRequest(full.token, `${admin}/sites`, {
    method: 'POST', body: siteBody, headers: { 'Idempotency-Key': key },
  });
  assert.equal(created.status, 201, `API site create: ${JSON.stringify(created.body)}`);
  assert.ok(created.body.id && created.etag, 'Created site lacks ID or ETag');
  const apiSiteId = created.body.id;
  const replay = await machineRequest(full.token, `${admin}/sites`, {
    method: 'POST', body: siteBody, headers: { 'Idempotency-Key': key },
  });
  assert.equal(replay.status, 201, `Idempotent replay: ${JSON.stringify(replay.body)}`);
  assert.equal(replay.body.id, apiSiteId, 'Idempotent replay created a second site');
  const changedReplay = await machineRequest(full.token, `${admin}/sites`, {
    method: 'POST', body: { ...siteBody, name: `${siteName} changed` }, headers: { 'Idempotency-Key': key },
  });
  assert.equal(changedReplay.status, 409, 'Reused key with changed body was accepted');
  const siteList = await machineRequest(full.token, `${admin}/sites?search=${encodeURIComponent(siteName)}`);
  assert.equal(siteList.status, 200);
  assert.equal(siteList.body.items.filter(value => value.id === apiSiteId).length, 1, 'Created site absent or duplicated in search');
  const siteRead = await machineRequest(full.token, `${admin}/sites/${apiSiteId}`);
  assert.equal(siteRead.status, 200);
  assert.equal(siteRead.etag, created.etag);
  const editBody = { name: `${siteName} edited`, overviewDesign: 'minimal' };
  const missingEtag = await machineRequest(full.token, `${admin}/sites/${apiSiteId}`, { method: 'PUT', body: editBody });
  assert.equal(missingEtag.status, 428, 'Site edit without If-Match was accepted');
  const staleEtag = await machineRequest(full.token, `${admin}/sites/${apiSiteId}`, {
    method: 'PUT', body: editBody, headers: { 'If-Match': '"-1"' },
  });
  assert.equal(staleEtag.status, 409, 'Stale If-Match was accepted');
  const edited = await machineRequest(full.token, `${admin}/sites/${apiSiteId}`, {
    method: 'PUT', body: editBody, headers: { 'If-Match': siteRead.etag },
  });
  assert.equal(edited.status, 200, `Site edit: ${JSON.stringify(edited.body)}`);
  assert.equal(edited.body.name, editBody.name);
  assert.equal(edited.body.overviewDesign, 'minimal');
  assert.notEqual(edited.etag, siteRead.etag, 'Site ETag did not change after edit');
  const placements = await machineRequest(full.token, `${admin}/site-placement-options`);
  assert.equal(placements.status, 200);
  const ownRoot = placements.body.items.find(value => value.siteId === apiSiteId && value.isSiteRoot);
  const parentRoot = placements.body.items.find(value => value.siteId === siteId && value.isSiteRoot);
  assert.ok(ownRoot && parentRoot, 'Site root placement options missing');
  const selfMove = await machineRequest(full.token, `${admin}/sites/${apiSiteId}/move`, {
    method: 'POST', body: { parentOrganizationUnitId: ownRoot.id }, headers: { 'If-Match': edited.etag },
  });
  assert.equal(selfMove.status, 400, 'Self-placement was accepted');
  const moved = await machineRequest(full.token, `${admin}/sites/${apiSiteId}/move`, {
    method: 'POST', body: { parentOrganizationUnitId: parentRoot.id }, headers: { 'If-Match': edited.etag },
  });
  assert.equal(moved.status, 200, `Site move: ${JSON.stringify(moved.body)}`);
  assert.equal(moved.body.parentSiteId, siteId);
  const detached = await machineRequest(full.token, `${admin}/sites/${apiSiteId}/move`, {
    method: 'POST', body: { parentOrganizationUnitId: null }, headers: { 'If-Match': moved.etag },
  });
  assert.equal(detached.status, 200, `Site detach: ${JSON.stringify(detached.body)}`);
  assert.equal(detached.body.parentSiteId, null);
  async function createSyntheticUser(label) {
    const result = await platform.post(`/api/sites/${apiSiteId}/access/local-users`, {
      displayName: `Synthetic ${label} ${suffix}`,
      email: `${label}-${suffix}@example.invalid`, username: `${label}-${suffix}`,
      organizationUnitId: null,
    });
    assert.equal(result.status, 201, `${label} fixture user creation failed`);
    return { id: result.body.member.id, email: `${label}-${suffix}@example.invalid` };
  }
  const movingUser = await createSyntheticUser('api-moving');
  const assigningUser = await createSyntheticUser('api-assigning');
  const deactivatingUser = await createSyntheticUser('api-deactivating');
  const userSearch = await machineRequest(full.token, `${admin}/users?search=${encodeURIComponent(movingUser.email)}`);
  assert.equal(userSearch.status, 200, `User search: ${JSON.stringify(userSearch.body)}`);
  assert.equal(userSearch.body.items.length, 1, 'Global user search did not identify one matching email');
  assert.equal(userSearch.body.items[0].id, movingUser.id);
  const userBeforeMove = await machineRequest(full.token, `${admin}/users/${movingUser.id}`);
  assert.equal(userBeforeMove.status, 200);
  assert.ok(userBeforeMove.body.siteMemberships.some(value => value.siteId === apiSiteId));
  const moveBody = { sourceSiteId: apiSiteId, targetSiteId: siteId };
  const moveKey = `user-move-${suffix}`;
  const movedUser = await machineRequest(full.token, `${admin}/users/${movingUser.id}/move`, {
    method: 'POST', body: moveBody, headers: { 'Idempotency-Key': moveKey },
  });
  assert.equal(movedUser.status, 200, `User move: ${JSON.stringify(movedUser.body)}`);
  const moveReplay = await machineRequest(full.token, `${admin}/users/${movingUser.id}/move`, {
    method: 'POST', body: moveBody, headers: { 'Idempotency-Key': moveKey },
  });
  assert.equal(moveReplay.status, 200);
  assert.equal(moveReplay.body.replayed, true, 'User move idempotency replay was not recognized');
  const userAfterMove = await machineRequest(full.token, `${admin}/users/${movingUser.id}`);
  assert.equal(userAfterMove.status, 200);
  assert.ok(userAfterMove.body.siteMemberships.some(value => value.siteId === siteId));
  assert.ok(!userAfterMove.body.siteMemberships.some(value => value.siteId === apiSiteId));
  const activeDeactivate = await machineRequest(full.token, `${admin}/users/${movingUser.id}/deactivate`, {
    method: 'POST', headers: { 'Idempotency-Key': `active-deactivate-${suffix}` },
  });
  assert.equal(activeDeactivate.status, 409, 'Active site user was deactivated');
  const deactivated = await machineRequest(full.token, `${admin}/sites/${apiSiteId}/deactivate`, {
    method: 'POST', headers: { 'If-Match': detached.etag },
  });
  assert.equal(deactivated.status, 204, `Site deactivate: ${JSON.stringify(deactivated.body)}`);
  assert.equal((await machineRequest(full.token, `${admin}/sites/${apiSiteId}`)).body.isActive, false);
  const unassigned = await machineRequest(full.token, `${admin}/users/${assigningUser.id}`);
  assert.equal(unassigned.status, 200);
  assert.equal(unassigned.body.siteMemberships.length, 0, 'Deactivated site retained an active user assignment');
  const assignBody = { siteId };
  const assignKey = `user-assign-${suffix}`;
  const assignedUser = await machineRequest(full.token, `${admin}/users/${assigningUser.id}/assign`, {
    method: 'POST', body: assignBody, headers: { 'Idempotency-Key': assignKey },
  });
  assert.equal(assignedUser.status, 200, `User assignment: ${JSON.stringify(assignedUser.body)}`);
  const assignReplay = await machineRequest(full.token, `${admin}/users/${assigningUser.id}/assign`, {
    method: 'POST', body: assignBody, headers: { 'Idempotency-Key': assignKey },
  });
  assert.equal(assignReplay.status, 200);
  assert.equal(assignReplay.body.replayed, true, 'User assignment idempotency replay was not recognized');
  const userAfterAssign = await machineRequest(full.token, `${admin}/users/${assigningUser.id}`);
  assert.ok(userAfterAssign.body.siteMemberships.some(value => value.siteId === siteId));
  const deactivatedUser = await machineRequest(full.token, `${admin}/users/${deactivatingUser.id}/deactivate`, {
    method: 'POST', headers: { 'Idempotency-Key': `user-deactivate-${suffix}` },
  });
  assert.equal(deactivatedUser.status, 200, `Unassigned user deactivation: ${JSON.stringify(deactivatedUser.body)}`);
  assert.equal((await machineRequest(full.token, `${admin}/users/${deactivatingUser.id}`)).status, 404,
    'Deactivated user remained in global user API');

  const classifications = await machineRequest(full.token, `${admin}/classifications`);
  assert.equal(classifications.status, 200);
  const enabled = await machineRequest(full.token, `${admin}/classifications/settings`, {
    method: 'PUT', body: { enabled: true },
  });
  assert.equal(enabled.status, 204, `Classification settings: ${JSON.stringify(enabled.body)}`);
  const abbreviation = `E${suffix.slice(0, 7)}`.toUpperCase();
  const classification = await machineRequest(full.token, `${admin}/classifications`, {
    method: 'POST', body: { name: `Synthetic classification ${suffix}`, abbreviation, sortOrder: 900, isActive: true },
  });
  assert.equal(classification.status, 201, `Classification creation: ${JSON.stringify(classification.body)}`);
  const renamedClassification = await machineRequest(full.token, `${admin}/classifications/${classification.body.id}`, {
    method: 'PUT', body: { name: `Synthetic revised classification ${suffix}`, abbreviation, sortOrder: 901, isActive: true },
  });
  assert.equal(renamedClassification.status, 200, `Classification update: ${JSON.stringify(renamedClassification.body)}`);
  assert.equal(renamedClassification.body.sortOrder, 901);

  const classifiedTask = await leader.post(`/api/work/sites/${siteId}/items`, {
    title: `Synthetic classified report ${suffix}`, description: 'Machine report API classification boundary',
    recommendation: null, referenceUrl: null, dueAt: null, workItemTypeId: null, sourceTypeId: null,
    senderId: null, targetSiteId: null, targetUnitId: null, assignedUnitId: null,
  });
  assert.equal(classifiedTask.status, 201, `Classified task: ${JSON.stringify(classifiedTask.body)}`);
  const taskPath = `/api/work/sites/${siteId}/items/${classifiedTask.body.id}`;
  const assess = await leader.put(`${taskPath}/status`, {
    status: 'under_review', assignedUnitId: null, decisionNote: null, priority: 'normal',
  });
  assert.equal(assess.status, 204, `Classified task assessment: ${JSON.stringify(assess.body)}`);
  await executeDefault(leader, classifiedTask.body.id, siteId);
  const reportWrite = await leader.put(`${taskPath}/final-report`, {
    content: '# Summary\n\nSynthetic classified API test report.', classification: abbreviation,
  });
  assert.equal(reportWrite.status, 204, `Classified report write: ${JSON.stringify(reportWrite.body)}`);
  const reportApproval = await leader.post(`${taskPath}/final-report/approve`, {});
  assert.equal(reportApproval.status, 204, `Classified report approval: ${JSON.stringify(reportApproval.body)}`);
  const reportComplete = await leader.put(`${taskPath}/status`, {
    status: 'completed', assignedUnitId: null, decisionNote: null, priority: null,
  });
  assert.equal(reportComplete.status, 204, `Classified report completion: ${JSON.stringify(reportComplete.body)}`);

  const topGrant = await platform.put(`/api/report-api/sites/${siteId}/grants`, {
    machineIdentityId: full.id, organizationUnitId: null, includeClassified: false,
  });
  assert.equal(topGrant.status, 200, `Top report grant: ${JSON.stringify(topGrant.body)}`);
  const topReports = await machineRequest(full.token, `${reports}?siteId=${siteId}&page=1&pageSize=100`);
  assert.equal(topReports.status, 200, `Top reports: ${JSON.stringify(topReports.body)}`);
  assert.ok(topReports.body.items.some(value => value.id === topReportId), 'Approved top-level report absent');
  assert.ok(!topReports.body.items.some(value => value.id === classifiedTask.body.id), 'Classified report leaked without grant');
  const topDetail = await machineRequest(full.token, `${reports}/${topReportId}`);
  assert.equal(topDetail.status, 200, `Top report detail: ${JSON.stringify(topDetail.body)}`);
  assert.ok(topDetail.body.referenceCode, 'Final-report detail omitted its local reference');
  assert.ok(Object.hasOwn(topDetail.body, 'originReference'), 'Final-report detail omitted its external reference field');
  assert.deepEqual(topDetail.body.organizationPath, []);
  assert.equal((await machineRequest(full.token, `${reports}/${classifiedTask.body.id}`)).status, 404,
    'Classified report detail leaked without classified permission');
  assert.equal((await machineRequest(full.token, `${reports}/${incompleteReportId}`)).status, 404,
    'Incomplete report was visible');
  assert.equal((await machineRequest(full.token, `${reports}?siteId=${siteId}&unitId=${sectionId}`)).status, 403,
    'Top-level grant inherited to Section 1');
  assert.equal((await machineRequest(full.token, `${reports}?siteId=${childSiteId}`)).status, 403,
    'Top-level grant crossed a site boundary');
  assert.equal((await machineRequest(full.token, `${reports}/${teamReportId}`)).status, 404,
    'Team report detail visible without an exact level grant');
  assert.equal((await machineRequest(null, `${reports}?siteId=${siteId}`)).status, 401,
    'Report list accepted missing credentials');

  const sectionGrant = await platform.put(`/api/report-api/sites/${siteId}/grants`, {
    machineIdentityId: full.id, organizationUnitId: sectionId, includeClassified: false,
  });
  assert.equal(sectionGrant.status, 200, `Section report grant: ${JSON.stringify(sectionGrant.body)}`);
  const sectionReports = await machineRequest(full.token, `${reports}?siteId=${siteId}&unitId=${sectionId}`);
  assert.equal(sectionReports.status, 200, `Section reports: ${JSON.stringify(sectionReports.body)}`);
  assert.ok(sectionReports.body.items.some(value => value.id === sectionReportId), 'Section 1 report absent from exact grant');
  assert.deepEqual(sectionReports.body.items.find(value => value.id === sectionReportId).organizationPath, ['Section 1']);
  assert.equal((await machineRequest(full.token, `${reports}?siteId=${siteId}&unitId=${teamId}`)).status, 403,
    'Section 1 grant inherited to Team Alpha');

  const workGrant = await platform.put(`/api/work-api/sites/${siteId}/grants`, {
    machineIdentityId: full.id, organizationUnitId: null,
  });
  assert.equal(workGrant.status, 200, `Top work grant: ${JSON.stringify(workGrant.body)}`);
  const catalog = await machineRequest(full.token, `${work}/catalog?siteId=${siteId}`);
  assert.equal(catalog.status, 200, `Work catalog: ${JSON.stringify(catalog.body)}`);
  assert.equal(catalog.body.siteId, siteId);
  const workList = await machineRequest(full.token, `${work}/items?siteId=${siteId}&page=1&pageSize=100`);
  assert.equal(workList.status, 200, `Work list: ${JSON.stringify(workList.body)}`);
  assert.ok(workList.body.items.some(value => value.id === topReportId), 'Granted top-level work item absent');
  const workDetail = await machineRequest(full.token, `${work}/items/${topReportId}`);
  assert.equal(workDetail.status, 200, `Work detail: ${JSON.stringify(workDetail.body)}`);
  assert.equal(workDetail.body.id, topReportId);
  assert.ok(workDetail.body.version > 0, 'Work detail omitted its concurrency version');
  assert.equal((await machineRequest(full.token, `${work}/items/${sectionReportId}`)).status, 404,
    'Top-level work grant exposed a Section work item');
  assert.equal((await machineRequest(full.token, `${work}/items?siteId=${siteId}&unitId=${sectionId}`)).status, 403,
    'Top-level work grant inherited to Section 1');
  assert.equal((await machineRequest(full.token, `${work}/items/${topReportId}/decisions`)).status, 200);
  assert.equal((await machineRequest(full.token, `${work}/items/${topReportId}/risks`)).status, 200);
  assert.equal((await machineRequest(full.token, `${work}/items/${topReportId}/activity`)).status, 200);
  const apiWorkBody = {
    siteId, organizationUnitId: null, workItemTypeId: null, sourceTypeId: null, senderId: null,
    title: `Synthetic API work ${suffix}`, description: 'Created through the versioned Work API.',
    recommendation: 'Verify the operational API.', referenceUrl: null, priority: 'normal', dueAt: null,
  };
  const workKey = `work-create-${suffix}`;
  const apiWork = await machineRequest(full.token, `${work}/items`, {
    method: 'POST', body: apiWorkBody, headers: { 'Idempotency-Key': workKey },
  });
  assert.equal(apiWork.status, 201, `API work create: ${JSON.stringify(apiWork.body)}`);
  assert.ok(apiWork.body.id && apiWork.body.referenceCode && apiWork.etag, 'Created API work lacks identity, reference, or ETag');
  const workReplay = await machineRequest(full.token, `${work}/items`, {
    method: 'POST', body: apiWorkBody, headers: { 'Idempotency-Key': workKey },
  });
  assert.equal(workReplay.status, 200);
  assert.equal(workReplay.body.id, apiWork.body.id, 'Work creation replay changed the resource');
  assert.equal(workReplay.body.replayed, true);
  const apiWorkRead = await machineRequest(full.token, `${work}/items/${apiWork.body.id}`);
  assert.equal(apiWorkRead.status, 200);
  assert.equal(apiWorkRead.etag, apiWork.etag);
  const updatedWorkBody = { title: `${apiWorkBody.title} updated`, description: apiWorkBody.description,
    recommendation: apiWorkBody.recommendation, referenceUrl: null, priority: 'high', dueAt: null };
  assert.equal((await machineRequest(full.token, `${work}/items/${apiWork.body.id}`, {
    method: 'PUT', body: updatedWorkBody,
  })).status, 428, 'Work update without If-Match was accepted');
  assert.equal((await machineRequest(full.token, `${work}/items/${apiWork.body.id}`, {
    method: 'PUT', body: updatedWorkBody, headers: { 'If-Match': '"0"' },
  })).status, 409, 'Stale work update was accepted');
  const updatedWork = await machineRequest(full.token, `${work}/items/${apiWork.body.id}`, {
    method: 'PUT', body: updatedWorkBody, headers: { 'If-Match': apiWorkRead.etag },
  });
  assert.equal(updatedWork.status, 200, `API work update: ${JSON.stringify(updatedWork.body)}`);
  assert.notEqual(updatedWork.etag, apiWorkRead.etag, 'Work ETag did not change');
  const commentKey = `work-comment-${suffix}`;
  const comment = await machineRequest(full.token, `${work}/items/${apiWork.body.id}/comments`, {
    method: 'POST', body: { text: 'Synthetic machine comment.' }, headers: { 'Idempotency-Key': commentKey },
  });
  assert.equal(comment.status, 201, `API comment: ${JSON.stringify(comment.body)}`);
  const comments = await machineRequest(full.token, `${work}/items/${apiWork.body.id}/comments`);
  assert.equal(comments.status, 200);
  assert.ok(comments.body.items.some(value => value.id === comment.body.id && value.authorMachineId === full.id),
    'Machine comment lost its actor identity');
  const accepted = await machineRequest(full.token, `${work}/items/${apiWork.body.id}/transitions`, {
    method: 'POST', body: { status: 'under_review', decisionNote: null, priority: 'high' },
    headers: { 'If-Match': updatedWork.etag, 'Idempotency-Key': `work-transition-${suffix}` },
  });
  assert.equal(accepted.status, 200, `API transition: ${JSON.stringify(accepted.body)}`);
  assert.equal(accepted.body.status, 'under_review');
  const decisionBody = { title: 'Synthetic API decision', decision: 'Prepare the governed integration.',
    rationale: 'Exercise machine authorship without granting formal approval.', decidedAt: null,
    decisionMakerIds: [leaderPersonId] };
  const decision = await machineRequest(full.token, `${work}/items/${apiWork.body.id}/decisions`, {
    method: 'POST', body: decisionBody, headers: { 'Idempotency-Key': `decision-create-${suffix}` },
  });
  assert.equal(decision.status, 201, `API decision: ${JSON.stringify(decision.body)}`);
  const revisedDecision = await machineRequest(full.token, `${work}/items/${apiWork.body.id}/decisions/${decision.body.id}`, {
    method: 'PUT', body: { ...decisionBody, rationale: 'Revised synthetic rationale.', expectedRevision: 1 },
    headers: { 'Idempotency-Key': `decision-revise-${suffix}` },
  });
  assert.equal(revisedDecision.status, 200, `API decision revision: ${JSON.stringify(revisedDecision.body)}`);
  assert.equal(revisedDecision.body.revision, 2);
  const decisions = await machineRequest(full.token, `${work}/items/${apiWork.body.id}/decisions`);
  assert.ok(decisions.body.items.some(value => value.decisionId === decision.body.id &&
    value.recordedByMachineId === full.id && value.status === 'draft'), 'Decision draft lost machine authorship');

  const riskBody = { title: 'Synthetic API risk', description: 'Integration delivery can be delayed.',
    probability: 3, impact: 4, ownerPersonId: leaderPersonId, status: 'active', dueDate: null,
    residualProbability: 2, residualImpact: 2 };
  const risk = await machineRequest(full.token, `${work}/items/${apiWork.body.id}/risks`, {
    method: 'POST', body: riskBody, headers: { 'Idempotency-Key': `risk-create-${suffix}` },
  });
  assert.equal(risk.status, 201, `API risk: ${JSON.stringify(risk.body)}`);
  const measure = await machineRequest(full.token, `${work}/items/${apiWork.body.id}/risks/${risk.body.id}/measures`, {
    method: 'POST', body: { action: 'Use a staged integration.', ownerPersonId: leaderPersonId,
      status: 'planned', dueDate: null }, headers: { 'Idempotency-Key': `measure-create-${suffix}` },
  });
  assert.equal(measure.status, 201, `API measure: ${JSON.stringify(measure.body)}`);
  const revisedMeasure = await machineRequest(full.token,
    `${work}/items/${apiWork.body.id}/risks/${risk.body.id}/measures/${measure.body.id}`, {
      method: 'PUT', body: { action: 'Use a staged and monitored integration.', ownerPersonId: leaderPersonId,
        status: 'in_progress', dueDate: null, expectedVersion: 1 },
      headers: { 'Idempotency-Key': `measure-revise-${suffix}` },
    });
  assert.equal(revisedMeasure.status, 200, `API measure revision: ${JSON.stringify(revisedMeasure.body)}`);
  const risks = await machineRequest(full.token, `${work}/items/${apiWork.body.id}/risks`);
  assert.ok(risks.body.items.some(value => value.id === risk.body.id && value.current.recordedByMachineId === full.id &&
    value.mitigations.some(entry => entry.id === measure.body.id && entry.current.recordedByMachineId === full.id)),
  'Risk or measure lost machine authorship');

  async function createAcceptedApiWork(label) {
    const slug = label.toLowerCase().replaceAll(' ', '-');
    const createdWork = await machineRequest(full.token, `${work}/items`, { method: 'POST',
      body: { ...apiWorkBody, title: `${label} ${suffix}` },
      headers: { 'Idempotency-Key': `${slug}-${suffix}` } });
    assert.equal(createdWork.status, 201, `${label} creation: ${JSON.stringify(createdWork.body)}`);
    const transitioned = await machineRequest(full.token, `${work}/items/${createdWork.body.id}/transitions`, {
      method: 'POST', body: { status: 'under_review', decisionNote: null, priority: 'normal' },
      headers: { 'If-Match': createdWork.etag, 'Idempotency-Key': `${slug}-accept-${suffix}` },
    });
    assert.equal(transitioned.status, 200, `${label} acceptance: ${JSON.stringify(transitioned.body)}`);
    return createdWork.body.id;
  }
  const planningItemId = await createAcceptedApiWork('API planning');
  assert.equal((await leader.put(`/api/work/sites/${siteId}/items/${planningItemId}/status`, {
    status: 'planning', assignedUnitId: null, decisionNote: null, priority: null })).status, 204);
  const planningQueue = await leader.request(`/api/workflows/planning/sites/${siteId}`);
  const planningRun = planningQueue.body.items.find(value => value.item.id === planningItemId);
  assert.ok(planningRun?.id && planningRun.steps.length > 0, 'API planning fixture has no run or steps');
  assert.equal((await leader.post(`/api/workflows/planning/${planningRun.id}/claim`, {})).status, 204);
  const planningRead = await machineRequest(full.token, `${work}/items/${planningItemId}/planning`);
  assert.equal(planningRead.status, 200); assert.ok(planningRead.etag);
  const planningDocument = await machineRequest(full.token,
    `${work}/items/${planningItemId}/planning/steps/${planningRead.body.steps[0].id}`, {
      method: 'PUT', body: { content: 'Synthetic machine planning documentation.', links: [], timelineEvents: [] },
      headers: { 'If-Match': planningRead.etag },
    });
  assert.equal(planningDocument.status, 200, `API planning document: ${JSON.stringify(planningDocument.body)}`);

  const executionItemId = await createAcceptedApiWork('API execution');
  assert.equal((await leader.put(`/api/work/sites/${siteId}/items/${executionItemId}/status`, {
    status: 'execution', assignedUnitId: null, decisionNote: null, priority: null })).status, 204);
  const executionQueue = await leader.request(`/api/execution/sites/${siteId}`);
  const definition = executionQueue.body.definitions.find(value => value.name === 'Standard');
  assert.ok(definition, 'API execution fixture has no Standard workflow');
  assert.equal((await leader.post(`/api/execution/items/${executionItemId}/claim`, {})).status, 204);
  const claimedExecution = await leader.request(`/api/execution/sites/${siteId}`);
  const executionRun = claimedExecution.body.items.find(value => value.id === executionItemId)?.run;
  assert.ok(executionRun?.id, 'API execution fixture has no run');
  assert.equal((await leader.post(`/api/execution/${executionRun.id}/start`, { definitionId: definition.id })).status, 204);
  const executionRead = await machineRequest(full.token, `${work}/items/${executionItemId}/execution`);
  assert.equal(executionRead.status, 200); assert.ok(executionRead.etag && executionRead.body.steps.length > 0);
  const executionDocument = await machineRequest(full.token,
    `${work}/items/${executionItemId}/execution/steps/${executionRead.body.steps[0].id}`, {
      method: 'PUT', body: { content: 'Synthetic machine execution documentation.', timelineEvents: [] },
      headers: { 'If-Match': executionRead.etag },
    });
  assert.equal(executionDocument.status, 200, `API execution document: ${JSON.stringify(executionDocument.body)}`);
  const apiActivity = await machineRequest(full.token, `${work}/items/${apiWork.body.id}/activity`);
  assert.equal(apiActivity.status, 200);
  assert.ok(apiActivity.body.items.some(value => value.eventType === 'assignment.accepted' && value.actorMachineId === full.id),
    'Machine transition lost common activity attribution');
  const removedWorkGrant = await platform.request(`/api/work-api/sites/${siteId}/grants/${workGrant.body.id}`, { method: 'DELETE' });
  assert.equal(removedWorkGrant.status, 204);
  assert.equal((await machineRequest(full.token, `${work}/items/${topReportId}`)).status, 404,
    'Work detail remained visible after grant removal');

  const classifiedGrant = await platform.put(`/api/report-api/sites/${siteId}/grants`, {
    machineIdentityId: full.id, organizationUnitId: null, includeClassified: true,
  });
  assert.equal(classifiedGrant.status, 200, `Classified grant: ${JSON.stringify(classifiedGrant.body)}`);
  const classifiedDetail = await machineRequest(full.token, `${reports}/${classifiedTask.body.id}`);
  assert.equal(classifiedDetail.status, 200, `Classified report detail: ${JSON.stringify(classifiedDetail.body)}`);
  assert.equal(classifiedDetail.body.finalReportClassification, abbreviation);
  const classifiedList = await machineRequest(full.token, `${reports}?siteId=${siteId}`);
  assert.ok(classifiedList.body.items.some(value => value.id === classifiedTask.body.id), 'Classified report absent after grant');
  const firstPage = await machineRequest(full.token, `${reports}?siteId=${siteId}&page=1&pageSize=1`);
  assert.equal(firstPage.status, 200);
  assert.equal(firstPage.body.items.length, 1, 'Report page-size limit was ignored');
  assert.ok(firstPage.body.total >= 2, 'Report pagination total omitted completed reports');
  const removedTopGrant = await platform.request(`/api/report-api/sites/${siteId}/grants/${classifiedGrant.body.id}`, { method: 'DELETE' });
  assert.equal(removedTopGrant.status, 204);
  assert.equal((await machineRequest(full.token, `${reports}?siteId=${siteId}`)).status, 403,
    'Report list remained accessible after exact top-level grant removal');
  assert.equal((await machineRequest(full.token, `${reports}/${classifiedTask.body.id}`)).status, 404,
    'Classified report detail remained accessible after grant removal');
  assert.equal((await machineRequest(full.token, `${reports}?siteId=${siteId}&unitId=${sectionId}`)).status, 200,
    'Removing top-level grant also removed the independent Section 1 grant');
  const removedSectionGrant = await platform.request(`/api/report-api/sites/${siteId}/grants/${sectionGrant.body.id}`, { method: 'DELETE' });
  assert.equal(removedSectionGrant.status, 204);
  assert.equal((await machineRequest(full.token, `${reports}?siteId=${siteId}&unitId=${sectionId}`)).status, 403,
    'Section report access survived exact grant removal');
  const deletedClassification = await machineRequest(full.token,
    `${admin}/classifications/${classification.body.id}`, { method: 'DELETE' });
  assert.equal(deletedClassification.status, 204,
    `Classification deletion: ${JSON.stringify(deletedClassification.body)}`);
  const classificationsAfterDelete = await machineRequest(full.token, `${admin}/classifications`);
  assert.ok(!classificationsAfterDelete.body.items.some(value => value.id === classification.body.id),
    'Deleted classification remained in the register');

  const expiring = await platform.post('/api/platform/api-clients/', {
    name: `Synthetic expiring API ${suffix}`, scopes: ['sites:read'],
    expiresAt: new Date(Date.now() + 2500).toISOString(),
  });
  assert.equal(expiring.status, 201);
  await new Promise(resolve => setTimeout(resolve, 3000));
  assert.equal((await machineRequest(machineCredential(expiring.body), `${admin}/sites`)).status, 401,
    'Expired machine credential remained valid');

  const disabled = await platform.request(`/api/platform/api-clients/${full.id}`, { method: 'DELETE' });
  assert.equal(disabled.status, 204, `Machine client deactivation: ${JSON.stringify(disabled.body)}`);
  assert.equal((await machineRequest(full.token, `${admin}/sites`)).status, 401, 'Disabled client retained administration access');
  assert.equal((await machineRequest(full.token, `${reports}?siteId=${siteId}`)).status, 401, 'Disabled client retained report access');

  return { apiSiteId, classifiedReportId: classifiedTask.body.id, machineClientId: full.id,
    movedUserId: movingUser.id, assignedUserId: assigningUser.id, deactivatedUserId: deactivatingUser.id };
}
