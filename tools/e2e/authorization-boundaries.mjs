import assert from 'node:assert/strict';

export async function testAuthorizationBoundaries({
  platform, siteManager, leader, sectionLeader, sectionTwoLeader, teamLeader, unrelatedLeader,
  siteId, otherSiteId, foreignAdministrationSiteId, sectionTaskId, teamTaskId, otherSiteTaskId, topReportTaskId,
  planningRunId, executionRunId,
}) {
  const payload = {
    title: 'Unauthorized synthetic task', description: 'Must not be created', recommendation: null,
    referenceUrl: null, dueAt: null, workItemTypeId: null, sourceTypeId: null, senderId: null,
    targetSiteId: null, targetUnitId: null, assignedUnitId: null,
  };
  async function forbidden(account, method, url, body, label) {
    const result = method === 'post' ? await account.post(url, body) :
      method === 'put' ? await account.put(url, body) : await account.request(url);
    assert.equal(result.status, 403, `${label}: ${JSON.stringify(result.body)}`);
  }
  async function concealedOrForbidden(account, url, label) {
    const result = await account.request(url);
    assert.ok([403, 404].includes(result.status), `${label}: ${JSON.stringify(result.body)}`);
  }
  await forbidden(platform, 'get', `/api/work/sites/${siteId}/items/overview`, null, 'Platform work overview');
  await forbidden(platform, 'post', `/api/work/sites/${siteId}/items`, payload, 'Platform task creation');
  await forbidden(siteManager, 'post', `/api/work/sites/${siteId}/items`, payload, 'Site Manager task creation');
  await forbidden(siteManager, 'get', `/api/work/sites/${siteId}/items`, null, 'Site Manager task list');
  await forbidden(siteManager, 'get', `/api/work/sites/${siteId}/items/overview`, null, 'Site Manager task overview');
  await forbidden(siteManager, 'get', `/api/work/sites/${siteId}/items/${topReportTaskId}/details`, null, 'Site Manager task details');
  await forbidden(siteManager, 'get', `/api/workflows/planning/sites/${siteId}`, null, 'Site Manager planning queue');
  await forbidden(siteManager, 'get', `/api/execution/sites/${siteId}`, null, 'Site Manager execution queue');
  await forbidden(siteManager, 'get', `/api/work/sites/${siteId}/reports`, null, 'Site Manager report archive');
  await forbidden(siteManager, 'put', `/api/work/sites/${siteId}/items/${topReportTaskId}/final-report`, {
    content: 'Site Manager must not write an operational report.', classification: null,
  }, 'Site Manager final report');
  await forbidden(sectionTwoLeader, 'get', `/api/work/sites/${siteId}/items/${sectionTaskId}/details`, null, 'Sibling section details');
  await forbidden(sectionTwoLeader, 'put', `/api/work/sites/${siteId}/items/${sectionTaskId}/status`, {
    status: 'in_progress', assignedUnitId: null, decisionNote: null, priority: null,
  }, 'Sibling section status change');
  await forbidden(teamLeader, 'put', `/api/work/sites/${siteId}/items/${sectionTaskId}/status`, {
    status: 'in_progress', assignedUnitId: null, decisionNote: null, priority: null,
  }, 'Team leader edits parent section');
  await forbidden(leader, 'put', `/api/work/sites/${siteId}/items/${teamTaskId}/final-report`, {
    content: 'Superior must not write team report.', classification: null,
  }, 'Superior writes team report');
  await forbidden(unrelatedLeader, 'get', `/api/work/sites/${siteId}/items/overview`, null, 'Unrelated site overview');
  await forbidden(unrelatedLeader, 'get', `/api/work/sites/${siteId}/items`, null, 'Unrelated site task list');
  await forbidden(unrelatedLeader, 'get', `/api/work/sites/${siteId}/items/${sectionTaskId}/details`, null, 'Unrelated site task details');
  await forbidden(unrelatedLeader, 'get', `/api/work/sites/${siteId}/reports`, null, 'Unrelated site report archive');
  await forbidden(unrelatedLeader, 'get', `/api/work/sites/${siteId}/workload-history`, null, 'Unrelated site workload history');
  await forbidden(unrelatedLeader, 'get', `/api/work/sites/${siteId}/descendant-workload`, null, 'Unrelated site descendant workload');
  await forbidden(unrelatedLeader, 'get', `/api/workflows/planning/sites/${siteId}`, null, 'Unrelated site planning queue');
  await forbidden(unrelatedLeader, 'get', `/api/execution/sites/${siteId}`, null, 'Unrelated site execution queue');
  await forbidden(unrelatedLeader, 'get', `/api/workflows/sites/${siteId}`, null, 'Unrelated site workflow definitions');
  await forbidden(unrelatedLeader, 'get', `/api/templates/sites/${siteId}`, null, 'Unrelated site templates');
  await forbidden(siteManager, 'get', `/api/sites/${foreignAdministrationSiteId}/organization-units`, null, 'Foreign organization through Site Manager');
  await forbidden(siteManager, 'get', `/api/sites/${foreignAdministrationSiteId}/access/`, null, 'Foreign personnel access through Site Manager');

  await concealedOrForbidden(leader,
    `/api/work/sites/${siteId}/items/${otherSiteTaskId}/details`,
    'Foreign object under authorized site route');
  await concealedOrForbidden(leader,
    `/api/work/sites/${otherSiteId}/items/${sectionTaskId}/details`,
    'Authorized object under foreign site route');
  await concealedOrForbidden(unrelatedLeader,
    `/api/execution/items/${sectionTaskId}/history`,
    'Foreign execution history by direct item ID');
  await concealedOrForbidden(sectionTwoLeader,
    `/api/workflows/planning/${planningRunId}/candidates`,
    'Sibling planning run by direct ID');
  await concealedOrForbidden(sectionTwoLeader,
    `/api/workflows/planning/${planningRunId}/rfi`,
    'Sibling planning RFI by direct ID');
  await concealedOrForbidden(sectionTwoLeader,
    `/api/execution/${executionRunId}/candidates`,
    'Sibling execution run by direct ID');

  return { authorizationBoundaries: 'passed', crossSiteGuidSubstitution: 'passed' };
}
