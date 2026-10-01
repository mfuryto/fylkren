import assert from 'node:assert/strict';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18080';

async function machineRequest(token, path, { method = 'GET', body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  });
  const raw = await response.text();
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = raw; }
  return { status: response.status, body: parsed, etag: response.headers.get('etag') };
}

export async function testAdministrationReportApis({ platform, leader, siteId, childSiteId, sectionId, teamId, topReportId, sectionReportId, teamReportId, incompleteReportId, suffix, executeDefault }) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  async function createClient(name, scopes) {
    const result = await platform.post('/api/platform/api-clients/', { name, scopes, expiresAt });
    assert.equal(result.status, 201, `${name} client creation failed`);
    assert.ok(result.body.id && result.body.token, `${name} client has no ID or one-time token`);
    return { id: result.body.id, token: result.body.token };
  }
  const full = await createClient(`Synthetic API ${suffix}`, [
    'sites:read', 'sites:write', 'sites:move', 'sites:deactivate',
    'users:read', 'users:assign', 'users:move', 'users:deactivate',
    'classifications:read', 'classifications:write', 'reports:read',
  ]);
  const limited = await createClient(`Synthetic limited API ${suffix}`, ['sites:read']);
  const admin = '/api/v1/administration';
  const reports = '/api/v1/reports';
  assert.equal((await machineRequest(null, `${admin}/sites`)).status, 401, 'Unauthenticated administration read succeeded');
  assert.equal((await machineRequest(limited.token, `${admin}/sites`)).status, 200, 'sites:read client denied');
  assert.equal((await machineRequest(limited.token, `${reports}?siteId=${siteId}`)).status, 403, 'Missing reports:read scope accepted');
  assert.equal((await machineRequest(full.token, `${reports}?siteId=${siteId}`)).status, 403, 'Report access without a grant succeeded');

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
  assert.equal((await machineRequest(expiring.body.token, `${admin}/sites`)).status, 401,
    'Expired machine credential remained valid');

  const disabled = await platform.request(`/api/platform/api-clients/${full.id}`, { method: 'DELETE' });
  assert.equal(disabled.status, 204, `Machine client deactivation: ${JSON.stringify(disabled.body)}`);
  assert.equal((await machineRequest(full.token, `${admin}/sites`)).status, 401, 'Disabled client retained administration access');
  assert.equal((await machineRequest(full.token, `${reports}?siteId=${siteId}`)).status, 401, 'Disabled client retained report access');

  return { apiSiteId, classifiedReportId: classifiedTask.body.id, machineClientId: full.id,
    movedUserId: movingUser.id, assignedUserId: assigningUser.id, deactivatedUserId: deactivatingUser.id };
}
