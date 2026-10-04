import { testGovernanceLifecycle } from './e2e/governance-lifecycle.mjs';
import { testActivityLifecycle } from './e2e/activity-lifecycle.mjs';
import { measureWorkload } from './e2e/workload-load.mjs';
import { testLearning } from "./e2e/learning.mjs";
import { testTaskComments } from './e2e/task-comments.mjs';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { testCrossSiteRequests } from './e2e/cross-site-requests.mjs';
import { testCombinedBranches } from './e2e/combined-branches.mjs';
import { testTransitionChains } from './e2e/transition-chains.mjs';
import { testAuthorizationBoundaries } from './e2e/authorization-boundaries.mjs';
import { testAdministrationReportApis } from './e2e/administration-report-apis.mjs';
import { testDependencies } from './e2e/dependencies.mjs';
import { testDecisionsRisksVersions } from './e2e/decisions-risks-versions.mjs';
import { testWebhookFailureIsolation } from './e2e/webhooks.mjs';
import { testPortability, testPortableParserBoundaries } from './e2e/portability.mjs';
import { testLookupSorting } from './e2e/lookup-sorting.mjs';
import { testFederationCandidates } from './e2e/federation-candidates.mjs';
import { testAuthenticationBoundary, testAuthSessionSecurity } from './e2e/auth-session-security.mjs';
import { testIdentitySessionLifecycle } from './e2e/identity-session-lifecycle.mjs';
import { testCustomCssEncoding, testStoredEncoding, testNumericInputBoundaries, testDerivedArithmeticBoundaries } from './e2e/encoding-security.mjs';

const base = process.env.FYLKREN_E2E_BASE_URL ?? 'http://localhost:18080';
function client() {
  const cookies = new Map();
  let csrfToken;
  async function request(path, options = {}) {
    const { binary = false, ...fetchOptions } = options;
    const headers = { ...(options.headers ?? {}) };
    if (cookies.size) headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    if (csrfToken && options.method && options.method !== 'GET') headers['X-Fylkren-CSRF'] = csrfToken;
    const response = await fetch(`${base}${path}`, { ...fetchOptions, headers, redirect: 'manual' });
    for (const value of response.headers.getSetCookie()) {
      const [pair] = value.split(';');
      const separator = pair.indexOf('=');
      if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    if (binary) return { status: response.status, body: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') };
    const body = await response.text();
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = body; }
    return { status: response.status, body: parsed };
  }
  return {
    request,
    cookieHeader() { return [...cookies].map(([name, value]) => `${name}=${value}`).join('; '); },
    async csrf() {
      const result = await request('/api/security/antiforgery');
      assert.equal(result.status, 200, JSON.stringify(result.body));
      csrfToken = result.body.token;
    },
    post(path, body) { return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); },
    put(path, body) { return request(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); },
  };
}

const platform = client();

const configuration = await platform.request('/api/configuration/public');
assert.equal(configuration.status, 200, JSON.stringify(configuration.body));
assert.equal(configuration.body.setupRequired, true, 'Expected a fresh isolated test database');
assert.equal(configuration.body.version, undefined, 'Public login configuration must not disclose the version');
assert.equal(configuration.body.edition, undefined, 'Public login configuration must not disclose license state');
assert.equal(configuration.body.entitlements, undefined, 'Public login configuration must not disclose entitlements');
assert.equal(configuration.body.classificationMarkings, undefined, 'Public login configuration must not disclose classifications');
assert.deepEqual({
  defaultLanguage: configuration.body.defaultLanguage,
  timeZone: configuration.body.timeZone,
  clockFormat: configuration.body.clockFormat,
  measurementSystem: configuration.body.measurementSystem,
}, { defaultLanguage: 'en-US', timeZone: 'UTC', clockFormat: '24-hour', measurementSystem: 'metric' });
const unauthenticatedDetails = await platform.request('/api/configuration');
assert.equal(unauthenticatedDetails.status, 401, 'Detailed configuration requires a session');

const suffix = randomBytes(6).toString('hex');
const managerUsername = `e2e-${suffix}`;
const managerPassword = `V7!${randomBytes(22).toString('base64url')}#z`;
const manager = await platform.post('/api/bootstrap/platform-manager', {
    username: managerUsername,
    displayName: 'Synthetic Test Manager',
    email: `e2e-${suffix}@example.invalid`,
    password: managerPassword,
});
assert.equal(manager.status, 201, JSON.stringify(manager.body));

const authSessionSecurity = await testAuthSessionSecurity({
  base, username: managerUsername, password: managerPassword,
});
const refreshedManagerSession = await platform.post('/api/session', {
  username: managerUsername, password: managerPassword,
});
assert.equal(refreshedManagerSession.status, 204, JSON.stringify(refreshedManagerSession.body));

const session = await platform.request('/api/session');
assert.equal(session.status, 200, JSON.stringify(session.body));
assert.equal(session.body.authenticated, true);
assert.equal(session.body.isPlatformManager, true);

await platform.csrf();
const customCssEncoding = await testCustomCssEncoding({ platform });

const licenseFixture = JSON.parse(readFileSync(new URL('./e2e/license-fixture.json', import.meta.url), 'utf8'));
const initialLicense = await platform.request('/api/platform/license');
assert.equal(initialLicense.status, 200, JSON.stringify(initialLicense.body));
assert.equal(initialLicense.body.status.instanceId, licenseFixture.instanceId, 'Run only against the disposable fixture instance');
assert.equal(initialLicense.body.status.edition, 'community');
assert.equal(initialLicense.body.status.state, 'none');
assert.equal(initialLicense.body.trustedIssuerConfigured, true);
const communityConfig = await platform.request('/api/configuration');
assert.equal(communityConfig.body.edition, 'community');
assert.deepEqual(communityConfig.body.entitlements, []);
const initialBranding = await platform.request('/api/branding');
assert.equal(initialBranding.status, 200);
assert.equal(initialBranding.body.customCss, '');
const initialRegional = await platform.request('/api/platform/regional-settings');
assert.equal(initialRegional.status, 200, JSON.stringify(initialRegional.body));
assert.equal((await platform.put('/api/platform/regional-settings', {
  ...initialRegional.body, timeZone: 'Invalid/Zone',
})).status, 400, 'Invalid time zones must not replace regional settings');
const changedRegional = await platform.put('/api/platform/regional-settings', {
  defaultLanguage: 'nb-NO', timeZone: 'Europe/Oslo',
  clockFormat: '12-hour', measurementSystem: 'imperial',
});
assert.equal(changedRegional.status, 200, JSON.stringify(changedRegional.body));
assert.deepEqual(changedRegional.body, {
  defaultLanguage: 'nb-NO', timeZone: 'Europe/Oslo',
  clockFormat: '12-hour', measurementSystem: 'imperial',
});
const changedPublicRegional = await platform.request('/api/configuration/public');
assert.equal(changedPublicRegional.body.defaultLanguage, 'nb-NO');
assert.equal(changedPublicRegional.body.clockFormat, '12-hour');
assert.equal((await platform.put('/api/platform/regional-settings', {
  defaultLanguage: 'en-US', timeZone: 'UTC',
  clockFormat: '24-hour', measurementSystem: 'metric',
})).status, 200);
if (!process.argv.includes('--asvs-arithmetic-only')) {
const platformOperations = await platform.request('/api/platform/operations');
assert.equal(platformOperations.status, 200, JSON.stringify(platformOperations.body));
assert.equal(platformOperations.body.hostIntegration.available, true, 'Host status snapshot must be available');
assert.equal(platformOperations.body.hostIntegration.stale, false, 'Fresh host status must not be stale');
assert.ok(platformOperations.body.hostIntegration.disk.availableBytes > 0, 'Host disk capacity must be reported');
assert.ok(!Number.isNaN(Date.parse(platformOperations.body.hostIntegration.backup.lastCompletedAt)), 'Completed backup time must be reported');
assert.equal(platformOperations.body.hostIntegration.backupWarningHours, 36, 'Backup warning threshold must be explicit');
const backupService = platformOperations.body.services.find(value => value.key === 'host-backup');
assert.equal(backupService.status, 'healthy', JSON.stringify(backupService));
assert.match(backupService.detail, /36 hours.*does not monitor off-host copying/i, 'Backup status scope must be explicit');
for (const service of ['host-web', 'host-api', 'host-postgres']) {
  const observed = platformOperations.body.services.find(value => value.key === service);
  assert.ok(observed, `Missing ${service} status`);
  assert.equal(observed.status, 'healthy', `${service}: ${JSON.stringify(observed)}`);
  assert.ok(Number.isInteger(observed.restartCount) && observed.restartCount >= 0, `${service} restart count`);
}
const hostStatusPath = 'runtime/host-status.json';
const validHostStatus = readFileSync(hostStatusPath);
try {
  const staleHostStatus = JSON.parse(validHostStatus.toString('utf8'));
  staleHostStatus.collectedAt = '2000-01-01T00:00:00Z';
  writeFileSync(hostStatusPath, JSON.stringify(staleHostStatus));
  const staleOperations = await platform.request('/api/platform/operations');
  assert.equal(staleOperations.body.hostIntegration.available, true);
  assert.equal(staleOperations.body.hostIntegration.stale, true, 'Old host snapshots must be marked stale');
  assert.ok(staleOperations.body.services.filter(value => value.key.startsWith('host-')).every(value => value.status === 'unknown'));

  writeFileSync(hostStatusPath, Buffer.alloc(65 * 1024, 0x78));
  const oversizedOperations = await platform.request('/api/platform/operations');
  assert.equal(oversizedOperations.body.hostIntegration.available, false, 'Oversized host snapshot must be rejected');
  assert.equal(oversizedOperations.body.hostIntegration.problem, 'invalid-file');

  const invalidHostStatus = { ...JSON.parse(validHostStatus.toString('utf8')), disk: { name: 'Fylkren-disk', totalBytes: 1, availableBytes: 2 } };
  writeFileSync(hostStatusPath, JSON.stringify(invalidHostStatus));
  const invalidOperations = await platform.request('/api/platform/operations');
  assert.equal(invalidOperations.body.hostIntegration.available, false, 'Invalid host snapshot must be rejected');
  assert.equal(invalidOperations.body.hostIntegration.problem, 'invalid-content');
} finally {
  writeFileSync(hostStatusPath, validHostStatus);
}
}
const customCss = '.e2e-css-marker { border-radius: 7px; }';
const branded = await platform.put('/api/platform/branding/', {
  ...initialBranding.body, customCss,
});
assert.equal(branded.status, 204, `Custom CSS update: ${JSON.stringify(branded.body)}`);
assert.equal((await platform.request('/api/branding')).body.customCss, customCss);
const unsafeCss = await platform.put('/api/platform/branding/', {
  ...initialBranding.body, customCss: '.e2e-css-marker { background: url(https://example.invalid/a); }',
});
assert.equal(unsafeCss.status, 400, 'Custom CSS must not load external resources');
const blockedClient = await platform.post('/api/platform/api-clients/', { name: 'Blocked synthetic client', scopes: ['sites:read'], expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
assert.equal(blockedClient.status, 403, 'Community must reject Enterprise API-client creation');
const blockedExternalLink = await platform.post('/api/platform/identity/oidc-links', { username: 'missing-user', subjectId: 'synthetic-subject' });
assert.equal(blockedExternalLink.status, 403, 'Community must reject new external identity links');
const localIdentitySettings = await platform.request('/api/platform/identity/local');
assert.equal(localIdentitySettings.status, 200, JSON.stringify(localIdentitySettings.body));
assert.equal(localIdentitySettings.body.enabled, true);
const unsafeLocalDisable = await platform.put('/api/platform/identity/local', {
  enabled: false, clearSecret: false, configuration: localIdentitySettings.body.configuration,
});
assert.equal(unsafeLocalDisable.status, 409, 'Local login cannot be disabled without a tested external Platform Manager path');
const blockedProviderConfiguration = await platform.put('/api/platform/identity/providers/oidc', {
  enabled: false, clearSecret: false, configuration: localIdentitySettings.body.configuration,
});
assert.equal(blockedProviderConfiguration.status, 403, 'Community must reject external provider configuration');
const blockedWebhook = await platform.post(`/api/platform/webhooks/sites/${randomUUID()}`, { name: 'Blocked synthetic hook', endpointUrl: 'https://example.invalid/hook', eventTypes: ['task.created'] });
assert.equal(blockedWebhook.status, 403, 'Community must reject new webhook subscriptions');
const blockedFederation = await platform.post('/api/platform/federation/peers', {
  instanceId: randomUUID(), name: 'Blocked synthetic peer', baseUrl: 'https://peer.example.invalid',
});
assert.equal(blockedFederation.status, 403, 'Community must reject federation peer creation');

const validLicense = licenseFixture.valid;
const tampered = await platform.post('/api/platform/license', { ...validLicense, payload: Buffer.from(JSON.stringify({ invalid: true })).toString('base64') });
assert.equal(tampered.status, 400, 'Tampered license must be rejected');
const wrongInstance = await platform.post('/api/platform/license', licenseFixture.wrongInstance);
assert.equal(wrongInstance.status, 400, 'A license for another instance must be rejected');
const expiredImport = await platform.post('/api/platform/license', licenseFixture.expired);
assert.equal(expiredImport.status, 400, 'Expired license must not replace the active license');
const communityAfterInvalid = await platform.request('/api/configuration');
assert.equal(communityAfterInvalid.body.edition, 'community');
const enabledLicense = await platform.post('/api/platform/license', validLicense);
assert.equal(enabledLicense.status, 200, JSON.stringify(enabledLicense.body));
assert.equal(enabledLicense.body.status.edition, 'enterprise');
const enterpriseConfig = await platform.request('/api/configuration');
assert.equal(enterpriseConfig.body.edition, 'enterprise');
assert.ok(enterpriseConfig.body.entitlements.includes('external-identity'));
const oidcSettings = await platform.request('/api/platform/identity/providers/oidc');
assert.equal(oidcSettings.status, 200, JSON.stringify(oidcSettings.body));
const savedOidcSettings = await platform.put('/api/platform/identity/providers/oidc', {
  enabled: false,
  clearSecret: false,
  configuration: {
    ...oidcSettings.body.configuration,
    authority: 'https://identity.example.invalid',
    clientId: 'synthetic-client',
    secret: 'synthetic-e2e-secret',
  },
});
assert.equal(savedOidcSettings.status, 204, JSON.stringify(savedOidcSettings.body));
const protectedOidcSettings = await platform.request('/api/platform/identity/providers/oidc');
assert.equal(protectedOidcSettings.body.hasSecret, true);
assert.equal(protectedOidcSettings.body.configuration.secret, null, 'Stored client secret must never be returned');
assert.equal(JSON.stringify(protectedOidcSettings.body).includes('synthetic-e2e-secret'), false);
const untestedOidcActivation = await platform.put('/api/platform/identity/providers/oidc', {
  enabled: true,
  clearSecret: false,
  configuration: protectedOidcSettings.body.configuration,
});
assert.equal(untestedOidcActivation.status, 409, 'An external provider cannot be activated before its saved configuration passes a connection test');
const enabledExternalLink = await platform.post('/api/platform/identity/oidc-links', { username: 'missing-user', subjectId: 'synthetic-subject' });
assert.equal(enabledExternalLink.status, 404, 'Entitled identity endpoint must proceed to ordinary user validation');

const site = await platform.post('/api/sites/', { name: `Synthetic E2E Site ${suffix}`, overviewDesign: 'classic' });
assert.equal(site.status, 201, JSON.stringify(site.body));
assert.ok(site.body.id);
const siteId = site.body.id;

async function authenticationPost(account, path, body) {
  let result = await account.post(path, body);
  for (let attempt = 0; result.status === 429 && attempt < 2; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 61_000));
    result = await account.post(path, body);
  }
  return result;
}

async function makeUser(label, userSiteId = siteId, organizationUnitId = null) {
  const username = `${label}-${suffix}`;
  const password = `V8!${randomBytes(22).toString('base64url')}#x`;
  const created = await platform.post(`/api/sites/${userSiteId}/access/local-users`, {
    displayName: `Synthetic ${label}`,
    email: `${username}@example.invalid`,
    username,
    organizationUnitId,
  });
  assert.equal(created.status, 201, `${label} create: ${JSON.stringify(created.body)}`);
  const account = client();
  const reset = await authenticationPost(account, '/api/password-reset/complete', { resetCode: created.body.resetCode, newPassword: password });
  assert.equal(reset.status, 204, `${label} reset: ${JSON.stringify(reset.body)}`);
  const login = await authenticationPost(account, '/api/session', { username, password });
  assert.equal(login.status, 204, `${label} login: ${JSON.stringify(login.body)}`);
  await account.csrf();
  return { account, personId: created.body.member.id, username, password };
}

const siteManager = await makeUser('manager');
const assignedManager = await platform.post(`/api/sites/${siteId}/site-managers`, { personId: siteManager.personId });
assert.equal(assignedManager.status, 201, JSON.stringify(assignedManager.body));
const defaultReportTemplate = await siteManager.account.request(`/api/templates/sites/${siteId}/final-report`);
assert.equal(defaultReportTemplate.status, 200, JSON.stringify(defaultReportTemplate.body));
assert.equal(defaultReportTemplate.body.content, '# Summary\n\n# Execution\n\n# Conclusion',
  'A new Site must own a correctly formatted copy of the English report default');
assert.equal(defaultReportTemplate.body.content.includes('\\n'), false,
  'The final-report template contains literal newline escape sequences');
const defaultWorkflows = await siteManager.account.request(`/api/workflows/sites/${siteId}`);
assert.equal(defaultWorkflows.status, 200, JSON.stringify(defaultWorkflows.body));
assert.deepEqual(defaultWorkflows.body.find(value => value.kind === 'planning')?.steps.map(value => value.name),
  ['Analysis', 'Task', 'Intent', 'Plan']);
assert.deepEqual(defaultWorkflows.body.find(value => value.kind === 'execution')?.steps.map(value => value.name),
  ['Preparation', 'Execution', 'Closure and follow-up']);

const leadership = await siteManager.account.post(`/api/sites/${siteId}/organization-units`, {
  name: 'Leadership', parentId: null, isTemporary: false, worksAtParentLevel: false, isSiteLeadership: true,
});
assert.equal(leadership.status, 201, JSON.stringify(leadership.body));
const access = await siteManager.account.request(`/api/sites/${siteId}/access/`);
assert.equal(access.status, 200, JSON.stringify(access.body));
const leadershipRole = access.body.roles.find(role => role.organizationUnitId === leadership.body.id && role.isLeader);
assert.ok(leadershipRole, 'Default leadership role missing');

const leader = await makeUser('leader');
const assignment = await siteManager.account.post(`/api/sites/${siteId}/access/role-assignments`, {
  roleId: leadershipRole.id, personId: leader.personId, validFrom: new Date(Date.now() - 60_000).toISOString(), validTo: null, canLeadParentLevel: false,
});
assert.equal(assignment.status, 201, JSON.stringify(assignment.body));

const { taskTypeId } = await testLookupSorting({ manager: siteManager.account, reader: leader.account, siteId });
if (process.argv.includes('--asvs-arithmetic-only')) {
  console.log(JSON.stringify(await testDerivedArithmeticBoundaries({ platform, siteManager: siteManager.account,
    leader: leader.account, siteId, unitId: leadership.body.id, workItemTypeId: taskTypeId })));
  process.exit(0);
}
if (process.argv.includes('--workload-only')) {
  console.log(JSON.stringify(await measureWorkload({ leader: leader.account, platform, siteId, unitId: leadership.body.id, workItemTypeId: taskTypeId })));
  process.exit(0);
}
const numericInput = await testNumericInputBoundaries({ platform, leader: leader.account, siteManager: siteManager.account, siteId });
if (process.argv.includes('--asvs-input-only')) {
  const storedEncoding = await testStoredEncoding({ leader: leader.account, siteId, unitId: leadership.body.id, workItemTypeId: taskTypeId });
  const portableParser = await testPortableParserBoundaries({ platform, siteManager: siteManager.account, siteId });
  console.log(JSON.stringify({ asvsEncoding: 'passed', ...customCssEncoding, ...storedEncoding, ...portableParser, ...numericInput }));
  process.exit(0);
}

const referenceSettings = await platform.request('/api/references/platform');
assert.equal(referenceSettings.status, 200, JSON.stringify(referenceSettings.body));
assert.ok(referenceSettings.body.nextNumber >= 1, 'Global task-reference sequence is missing');
const managedReferenceSites = await siteManager.account.request('/api/references/sites');
assert.equal(managedReferenceSites.status, 200, JSON.stringify(managedReferenceSites.body));
assert.ok(managedReferenceSites.body.sites.some(value => value.siteId === siteId), 'Site reference configuration is missing');

const task = await leader.account.post(`/api/work/sites/${siteId}/items`, {
  title: 'Synthetic E2E task', description: 'Verify initial task transition', recommendation: 'Assess locally',
  referenceUrl: null, dueAt: null, workItemTypeId: taskTypeId, sourceTypeId: null, senderId: null,
  targetSiteId: null, targetUnitId: null, assignedUnitId: leadership.body.id,
});
assert.equal(task.status, 201, JSON.stringify(task.body));
assert.match(task.body.referenceCode, /^EXE0-\d{6,10}$/, 'Root reference must use the task-type abbreviation');
const taskReference = task.body.referenceCode;
async function navigationCounts(account = leader.account) {
  const result = await account.request('/api/work/navigation-counts');
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}
assert.deepEqual(await navigationCounts(), { tasks: 1, planning: 0, execution: 0, learning: 0 });
assert.deepEqual(await navigationCounts(siteManager.account), { tasks: 0, planning: 0, execution: 0, learning: 0 }, 'Administration must not imply operational counts');
assert.deepEqual(await navigationCounts(platform), { tasks: 0, planning: 0, execution: 0, learning: 0 }, 'Platform Manager must not receive operational counts');
const platformWorkView = await platform.request(`/api/work/sites/${siteId}/items/overview`);
assert.equal(platformWorkView.status, 403, 'Platform Manager must not see operational tasks');
const underReview = await leader.account.put(`/api/work/sites/${siteId}/items/${task.body.id}/status`, {
  status: 'under_review', assignedUnitId: null, decisionNote: 'Synthetic test assessment', priority: 'normal',
});
assert.equal(underReview.status, 204, JSON.stringify(underReview.body));

const toPlanning = await leader.account.put(`/api/work/sites/${siteId}/items/${task.body.id}/status`, {
  status: 'planning', assignedUnitId: null, decisionNote: null, priority: null,
});
assert.equal(toPlanning.status, 204, `planning: ${JSON.stringify(toPlanning.body)}`);
const queue = await leader.account.request(`/api/workflows/planning/sites/${siteId}`);
assert.equal(queue.status, 200, `queue: ${JSON.stringify(queue.body)}`);
const run = queue.body.items.find(item => item.item.id === task.body.id);
assert.ok(run, `Planning run not visible: ${JSON.stringify(queue.body)}`);
assert.equal(run.item.referenceCode, taskReference, 'Planning changed the task reference');
assert.deepEqual(await navigationCounts(), { tasks: 0, planning: 1, execution: 0, learning: 0 });
const claim = await leader.account.post(`/api/workflows/planning/${run.id}/claim`, {});
assert.equal(claim.status, 204, `claim: ${JSON.stringify(claim.body)}`);
assert.deepEqual(await navigationCounts(), { tasks: 0, planning: 0, execution: 0, learning: 0 }, 'Claimed planning is no longer waiting');
const submit = await leader.account.post(`/api/workflows/planning/${run.id}/submit`, {
  priority: 'normal', dueAt: null, allocations: [],
});
assert.equal(submit.status, 204, `submit: ${JSON.stringify(submit.body)}`);
const managerApproval = await siteManager.account.post(`/api/workflows/planning/${run.id}/decision`, { action: 'approve', note: null });
assert.equal(managerApproval.status, 403, 'Site Manager must not approve an operational plan');
const approval = await leader.account.post(`/api/workflows/planning/${run.id}/decision`, { action: 'approve', note: null });
assert.equal(approval.status, 204, `approve: ${JSON.stringify(approval.body)}`);
async function taskStatus() {
  const overview = await leader.account.request(`/api/work/sites/${siteId}/items/overview`);
  assert.equal(overview.status, 200, JSON.stringify(overview.body));
  const entry = overview.body.find(item => item.id === task.body.id);
  assert.ok(entry, 'Task missing from overview');
  return entry.status;
}
assert.equal(await taskStatus(), 'planning_approved', 'Approval must not release plan');
const release = await leader.account.post(`/api/workflows/planning/${run.id}/decision`, { action: 'release', note: null });
assert.equal(release.status, 204, `release: ${JSON.stringify(release.body)}`);
assert.equal(await taskStatus(), 'in_progress', 'Release must transition task to in_progress');

const toExecution = await leader.account.put(`/api/work/sites/${siteId}/items/${task.body.id}/status`, {
  status: 'execution', assignedUnitId: null, decisionNote: null, priority: null,
});
assert.equal(toExecution.status, 204, `execution: ${JSON.stringify(toExecution.body)}`);
const executionQueue = await leader.account.request(`/api/execution/sites/${siteId}`);
assert.equal(executionQueue.status, 200, `execution queue: ${JSON.stringify(executionQueue.body)}`);
assert.ok(executionQueue.body.items.some(item => item.id === task.body.id), 'Task missing from execution queue');
assert.equal(executionQueue.body.items.find(item => item.id === task.body.id).referenceCode, taskReference, 'Execution changed the task reference');
const definition = executionQueue.body.definitions.find(value => value.name === 'Standard');
assert.ok(definition, 'Default execution workflow missing');
assert.deepEqual(await navigationCounts(), { tasks: 0, planning: 0, execution: 1, learning: 0 });
const claimExecution = await leader.account.post(`/api/execution/items/${task.body.id}/claim`, {});
assert.equal(claimExecution.status, 204, `claim execution: ${JSON.stringify(claimExecution.body)}`);
assert.deepEqual(await navigationCounts(), { tasks: 0, planning: 0, execution: 0, learning: 0 }, 'Claimed execution is no longer waiting');
const claimedExecutionQueue = await leader.account.request(`/api/execution/sites/${siteId}`);
const executionRun = claimedExecutionQueue.body.items.find(item => item.id === task.body.id)?.run;
assert.ok(executionRun?.id, 'Execution run missing after claim');
const startExecution = await leader.account.post(`/api/execution/${executionRun.id}/start`, { definitionId: definition.id });
assert.equal(startExecution.status, 204, `start execution: ${JSON.stringify(startExecution.body)}`);
const activeExecutionQueue = await leader.account.request(`/api/execution/sites/${siteId}`);
const activeRun = activeExecutionQueue.body.items.find(item => item.id === task.body.id)?.run;
assert.ok(activeRun?.steps?.length > 0, 'Execution steps missing');
const documentExecution = await leader.account.put(`/api/execution/${executionRun.id}/steps/${activeRun.steps[0].id}`, {
  content: '# Forberedelser\n\n- Synthetic step completed', timelineEvents: [],
});
assert.equal(documentExecution.status, 204, `document execution: ${JSON.stringify(documentExecution.body)}`);
const submitExecution = await leader.account.post(`/api/execution/${executionRun.id}/submit`, {});
assert.equal(submitExecution.status, 204, `submit execution: ${JSON.stringify(submitExecution.body)}`);
assert.equal(await taskStatus(), 'in_review');
const auditByReference = await siteManager.account.request(`/api/site-audit/sites/${siteId}?search=${encodeURIComponent(taskReference)}`);
assert.equal(auditByReference.status, 200, JSON.stringify(auditByReference.body));
for (const eventType of ['work-item.registered', 'workflow.claimed', 'execution.claimed', 'execution.step-documented']) {
  const event = auditByReference.body.events.find(value => value.eventType === eventType);
  assert.ok(event, `Audit reference search missing ${eventType}`);
  assert.equal(event.workReference, taskReference);
  assert.equal(event.workTitle, 'Synthetic E2E task');
}


const prematureComplete = await leader.account.put(`/api/work/sites/${siteId}/items/${task.body.id}/status`, {
  status: 'completed', assignedUnitId: null, decisionNote: null, priority: null,
});
assert.equal(prematureComplete.status, 409, 'Completion without final report must be rejected');
const learningDrafts = [
  { id: randomUUID(), kind: 'positive', text: 'INTERNAL_LEARNING_POSITIVE_SENTINEL: collaboration worked well' },
  { id: randomUUID(), kind: 'improvement', text: 'INTERNAL_LEARNING_IMPROVEMENT_SENTINEL: handover needs improvement' },
];
const invalidLearningReport = await leader.account.put(`/api/work/sites/${siteId}/items/${task.body.id}/final-report`, {
  content: 'This draft must not be saved', classification: null, lessons: [{ ...learningDrafts[0], text: ' ' }],
});
assert.equal(invalidLearningReport.status, 400);
const unsavedLearning = await leader.account.request(`/api/work/learning?workItemId=${task.body.id}&view=all`);
assert.equal(unsavedLearning.status, 200, JSON.stringify(unsavedLearning.body));
assert.equal(unsavedLearning.body.total, 0, 'Invalid report saved a partial learning point');
const beforeValidReport = await leader.account.request(`/api/work/sites/${siteId}/items/overview`);
assert.equal(beforeValidReport.body.find(value => value.id === task.body.id).finalReport, null, 'Invalid learning point changed the report');
const report = await leader.account.put(`/api/work/sites/${siteId}/items/${task.body.id}/final-report`, {
  content: '# Summary\n\nSynthetic task completed.\n\n# Execution\n\nThe test execution was documented.\n\n# Conclusion\n\nCompleted.',
  classification: null, lessons: learningDrafts,
});
assert.equal(report.status, 204, `write report: ${JSON.stringify(report.body)}`);
const retryLearningReport = await leader.account.put(`/api/work/sites/${siteId}/items/${task.body.id}/final-report`, {
  content: '# Summary\n\nSynthetic task completed.\n\n# Execution\n\nThe test execution was documented.\n\n# Conclusion\n\nCompleted.', classification: null, lessons: learningDrafts,
});
assert.equal(retryLearningReport.status, 204);
assert.equal((await leader.account.request(`/api/work/learning?workItemId=${task.body.id}&view=all`)).body.total, 2, 'Report retry duplicated learning points');

const approveReport = await leader.account.post(`/api/work/sites/${siteId}/items/${task.body.id}/final-report/approve`, {});
assert.equal(approveReport.status, 204, `approve report: ${JSON.stringify(approveReport.body)}`);
const complete = await leader.account.put(`/api/work/sites/${siteId}/items/${task.body.id}/status`, {
  status: 'completed', assignedUnitId: null, decisionNote: null, priority: null,
});
assert.equal(complete.status, 204, `complete task: ${JSON.stringify(complete.body)}`);
assert.equal(await taskStatus(), 'completed');
const reports = await leader.account.request(`/api/work/sites/${siteId}/reports?unitId=${leadership.body.id}`);
assert.equal(reports.status, 200, `report archive: ${JSON.stringify(reports.body)}`);
assert.ok(reports.body.reports.some(item => item.id === task.body.id), `Completed report missing from archive: ${JSON.stringify(reports.body)}`);
assert.equal(reports.body.reports.find(item => item.id === task.body.id).referenceCode, taskReference, 'Final report changed the task reference');
const reportByReference = await leader.account.request(`/api/work/sites/${siteId}/reports?unitId=${leadership.body.id}&search=${encodeURIComponent(taskReference)}`);
assert.equal(reportByReference.status, 200, JSON.stringify(reportByReference.body));
assert.ok(reportByReference.body.reports.some(item => item.id === task.body.id), 'Task reference search did not find the final report');

const concurrentReferences = await Promise.all(Array.from({ length: 4 }, async (_, index) => {
  const created = await leader.account.post(`/api/work/sites/${siteId}/items`, {
    title: `Concurrent reference ${index + 1}`, description: 'Verify serialized global reference allocation', recommendation: null,
    referenceUrl: null, dueAt: null, workItemTypeId: taskTypeId, sourceTypeId: null, senderId: null,
    targetSiteId: null, targetUnitId: null, assignedUnitId: leadership.body.id,
  });
  assert.equal(created.status, 201, `concurrent reference ${index + 1}: ${JSON.stringify(created.body)}`);
  return created.body;
}));
assert.equal(new Set(concurrentReferences.map(value => value.referenceCode)).size, concurrentReferences.length,
  'Concurrent root creation issued duplicate references');
assert.ok(concurrentReferences.every(value => /^EXE0-\d{6,10}$/.test(value.referenceCode)),
  `Concurrent roots used an unexpected reference prefix: ${JSON.stringify(concurrentReferences)}`);
const referenceSortedTasks = await leader.account.request(`/api/work/sites/${siteId}/items?filter=all&sort=reference-asc&page=1`);
assert.equal(referenceSortedTasks.status, 200, JSON.stringify(referenceSortedTasks.body));
const sortedReferenceCodes = referenceSortedTasks.body.items.map(value => value.referenceCode);
assert.deepEqual(sortedReferenceCodes, [...sortedReferenceCodes].sort((left, right) => left.localeCompare(right, 'en-US', { numeric: true })),
  'Task reference sorting did not apply to the complete page');
for (const created of concurrentReferences) {
  const cancelled = await leader.account.post(`/api/work/sites/${siteId}/items/${created.id}/cancel`, {
    decisionNote: 'Synthetic concurrency cleanup',
  });
  assert.equal(cancelled.status, 200, `concurrent cleanup: ${JSON.stringify(cancelled.body)}`);
}

async function createUnit(name, parentId, worksAtParentLevel = false) {
  const result = await siteManager.account.post(`/api/sites/${siteId}/organization-units`, {
    name, parentId, isTemporary: false, worksAtParentLevel, isSiteLeadership: false,
  });
  assert.equal(result.status, 201, `${name}: ${JSON.stringify(result.body)}`);
  return result.body.id;
}

async function appointLeader(label, unitId, roleSiteId = siteId) {
  const person = await makeUser(label, roleSiteId);
  const currentAccess = await siteManager.account.request(`/api/sites/${roleSiteId}/access/`);
  assert.equal(currentAccess.status, 200, JSON.stringify(currentAccess.body));
  const role = currentAccess.body.roles.find(value => value.organizationUnitId === unitId && value.isLeader);
  assert.ok(role, `Leader role missing for ${label}`);
  const result = await siteManager.account.post(`/api/sites/${roleSiteId}/access/role-assignments`, {
    roleId: role.id, personId: person.personId, validFrom: new Date(Date.now() - 60_000).toISOString(), validTo: null, canLeadParentLevel: false,
  });
  assert.equal(result.status, 201, `${label} role: ${JSON.stringify(result.body)}`);
  return person.account;
}

async function updateStatus(account, itemId, status, assignedUnitId = null, priority = null, workSiteId = siteId) {
  const result = await account.put(`/api/work/sites/${workSiteId}/items/${itemId}/status`, {
    status, assignedUnitId, decisionNote: null, priority,
  });
  assert.equal(result.status, 204, `${status} ${itemId}: ${JSON.stringify(result.body)}`);
}

async function childOf(account, parentId) {
  const overview = await account.request(`/api/work/sites/${siteId}/items/overview`);
  assert.equal(overview.status, 200, JSON.stringify(overview.body));
  const children = overview.body.filter(item => item.parentWorkItemId === parentId);
  assert.equal(children.length, 1, `Expected one visible child of ${parentId}: ${JSON.stringify(children)}`);
  return children[0];
}

async function finishAndArchive(account, itemId, unitId, label, reportSiteId = siteId) {
  const overview = await account.request(`/api/work/sites/${reportSiteId}/items/overview`);
  assert.equal(overview.status, 200, `${label} overview: ${JSON.stringify(overview.body)}`);
  const current = overview.body.find(item => item.id === itemId);
  assert.ok(current, `${label} task missing before report`);
  if (current.status !== 'in_review') await updateStatus(account, itemId, 'in_review', null, null, reportSiteId);
  const reportContent = `# Summary\n\n${label} completed its work.\n\n# Execution\n\nSynthetic execution.\n\n# Conclusion\n\nCompleted.`;
  const written = await account.put(`/api/work/sites/${reportSiteId}/items/${itemId}/final-report`, {
    content: reportContent, classification: null,
  });
  assert.equal(written.status, 204, `${label} report: ${JSON.stringify(written.body)}`);
  const approved = await account.post(`/api/work/sites/${reportSiteId}/items/${itemId}/final-report/approve`, {});
  assert.equal(approved.status, 204, `${label} approval: ${JSON.stringify(approved.body)}`);
  await updateStatus(account, itemId, 'completed', null, null, reportSiteId);
  const levelQuery = unitId ? `?unitId=${unitId}` : '';
  const archive = await account.request(`/api/work/sites/${reportSiteId}/reports${levelQuery}`);
  assert.equal(archive.status, 200, `${label} archive: ${JSON.stringify(archive.body)}`);
  assert.ok(archive.body.reports.some(entry => entry.id === itemId), `${label} report missing from its archive`);
}

async function executeDefault(account, itemId, workSiteId = siteId) {
  await updateStatus(account, itemId, 'execution', null, null, workSiteId);
  const queue = await account.request(`/api/execution/sites/${workSiteId}`);
  assert.equal(queue.status, 200, `execution queue: ${JSON.stringify(queue.body)}`);
  const definition = queue.body.definitions.find(value => value.name === 'Standard');
  assert.ok(definition, 'Default execution workflow missing');
  const claim = await account.post(`/api/execution/items/${itemId}/claim`, {});
  assert.equal(claim.status, 204, `execution claim: ${JSON.stringify(claim.body)}`);
  const claimedQueue = await account.request(`/api/execution/sites/${workSiteId}`);
  const run = claimedQueue.body.items.find(item => item.id === itemId)?.run;
  assert.ok(run?.id, 'Execution run missing after claim');
  const started = await account.post(`/api/execution/${run.id}/start`, { definitionId: definition.id });
  assert.equal(started.status, 204, `execution start: ${JSON.stringify(started.body)}`);
  const submitted = await account.post(`/api/execution/${run.id}/submit`, {});
  assert.equal(submitted.status, 204, `execution submit: ${JSON.stringify(submitted.body)}`);
}

const sectionId = await createUnit('Section 1', null);
const teamId = await createUnit('Team Alpha', sectionId);
const staffId = await createUnit('Staff', null, true);
const sectionTwoId = await createUnit('Section 2', null);
const sectionLeader = await appointLeader('section-leader', sectionId);
const teamLeader = await appointLeader('team-leader', teamId);
const staffLeader = await appointLeader('staff-leader', staffId);
const sectionTwoLeader = await appointLeader('section-two-leader', sectionTwoId);
const mainTask = await leader.account.post(`/api/work/sites/${siteId}/items`, {
  title: 'Synthetic three-level task', description: 'Top-to-section-to-team reporting', recommendation: null,
  referenceUrl: null, dueAt: null, workItemTypeId: null, sourceTypeId: null, senderId: null,
  targetSiteId: null, targetUnitId: null, assignedUnitId: null,
});
assert.equal(mainTask.status, 201, `three-level task: ${JSON.stringify(mainTask.body)}`);
await updateStatus(leader.account, mainTask.body.id, 'under_review', null, 'normal');
await updateStatus(leader.account, mainTask.body.id, 'assigned', sectionId);
const sectionTask = await childOf(sectionLeader, mainTask.body.id);
assert.equal(sectionTask.assignedUnitId, sectionId);
assert.equal(sectionTask.referenceCode, `${mainTask.body.referenceCode}-1`, 'Delegation did not extend the parent reference');

await updateStatus(sectionLeader, sectionTask.id, 'planning');
const sectionQueue = await sectionLeader.request(`/api/workflows/planning/sites/${siteId}`);
assert.equal(sectionQueue.status, 200, JSON.stringify(sectionQueue.body));
const sectionPlan = sectionQueue.body.items.find(item => item.item.id === sectionTask.id);
assert.ok(sectionPlan, 'Section planning run missing');
const allocationStep = sectionPlan.steps.find(step => step.allowsTaskAllocation);
assert.ok(allocationStep, 'Default planning workflow has no allocation step');
const sectionClaim = await sectionLeader.post(`/api/workflows/planning/${sectionPlan.id}/claim`, {});
assert.equal(sectionClaim.status, 204);
const sectionSubmit = await sectionLeader.post(`/api/workflows/planning/${sectionPlan.id}/submit`, {
  priority: 'normal', dueAt: null,
  allocations: [{ stepId: allocationStep.id, unitId: teamId, instruction: 'Team Alpha: execute the assigned part.' }],
});
assert.equal(sectionSubmit.status, 204, `section plan: ${JSON.stringify(sectionSubmit.body)}`);
const sectionApprove = await sectionLeader.post(`/api/workflows/planning/${sectionPlan.id}/decision`, { action: 'approve', note: null });
assert.equal(sectionApprove.status, 204, `section approval: ${JSON.stringify(sectionApprove.body)}`);
const beforeRelease = await teamLeader.request(`/api/work/sites/${siteId}/items/overview`);
assert.equal(beforeRelease.status, 200);
assert.equal(beforeRelease.body.filter(item => item.parentWorkItemId === sectionTask.id).length, 0, 'Approval dispatched work before release');
const sectionRelease = await sectionLeader.post(`/api/workflows/planning/${sectionPlan.id}/decision`, { action: 'release', note: null });
assert.equal(sectionRelease.status, 204, `section release: ${JSON.stringify(sectionRelease.body)}`);
const teamTask = await childOf(teamLeader, sectionTask.id);
assert.equal(teamTask.description, 'Team Alpha: execute the assigned part.');
assert.equal(teamTask.referenceCode, `${mainTask.body.referenceCode}-1-1`, 'Deeper delegation did not preserve the reference path');

await executeDefault(teamLeader, teamTask.id);
const superiorReportAttempt = await leader.account.put(`/api/work/sites/${siteId}/items/${teamTask.id}/final-report`, {
  content: 'Superior must not write team report', classification: null,
});
assert.equal(superiorReportAttempt.status, 403, 'Top-level leader must not write a team final report');
await finishAndArchive(teamLeader, teamTask.id, teamId, 'Team Alpha');
await finishAndArchive(sectionLeader, sectionTask.id, sectionId, 'Section 1');
await finishAndArchive(leader.account, mainTask.body.id, null, 'Top level');

const childSiteName = `Synthetic Child ${suffix}`;
const childSite = await platform.post('/api/sites/', { name: childSiteName, overviewDesign: 'classic' });
assert.equal(childSite.status, 201, `child site: ${JSON.stringify(childSite.body)}`);
const childSiteId = childSite.body.id;
const attached = await platform.put(`/api/sites/${childSiteId}`, {
  name: childSiteName, parentOrganizationUnitId: leadership.body.id, isActive: true, overviewDesign: 'classic',
});
assert.equal(attached.status, 200, `attach child site: ${JSON.stringify(attached.body)}`);
const childManager = await platform.post(`/api/sites/${childSiteId}/site-managers`, { personId: siteManager.personId });
assert.equal(childManager.status, 201, `child manager: ${JSON.stringify(childManager.body)}`);
const childLeadership = await siteManager.account.post(`/api/sites/${childSiteId}/organization-units`, {
  name: 'Leadership', parentId: null, isTemporary: false, worksAtParentLevel: false, isSiteLeadership: true,
});
assert.equal(childLeadership.status, 201, `child leadership: ${JSON.stringify(childLeadership.body)}`);
const childLeader = await appointLeader('child-leader', childLeadership.body.id, childSiteId);

const selfPlacement = await platform.put(`/api/sites/${childSiteId}`, {
  name: childSiteName, parentOrganizationUnitId: childLeadership.body.id, isActive: true, overviewDesign: 'classic',
});
assert.equal(selfPlacement.status, 400, `site placed inside itself: ${JSON.stringify(selfPlacement.body)}`);
const cyclePlacement = await platform.put(`/api/sites/${siteId}`, {
  name: `Synthetic E2E Site ${suffix}`, parentOrganizationUnitId: childLeadership.body.id,
  isActive: true, overviewDesign: 'classic',
});
assert.equal(cyclePlacement.status, 400, `site hierarchy cycle accepted: ${JSON.stringify(cyclePlacement.body)}`);
const missingPlacement = await platform.put(`/api/sites/${childSiteId}`, {
  name: childSiteName, parentOrganizationUnitId: '00000000-0000-0000-0000-000000000001',
  isActive: true, overviewDesign: 'classic',
});
assert.equal(missingPlacement.status, 400, `missing placement accepted: ${JSON.stringify(missingPlacement.body)}`);

const parentTask = await leader.account.post(`/api/work/sites/${siteId}/items`, {
  title: 'Synthetic parent-to-child task', description: 'Cross-site official reporting', recommendation: null,
  referenceUrl: null, dueAt: null, workItemTypeId: null, sourceTypeId: null, senderId: null,
  targetSiteId: null, targetUnitId: null, assignedUnitId: null,
});
assert.equal(parentTask.status, 201, `parent task: ${JSON.stringify(parentTask.body)}`);
await updateStatus(leader.account, parentTask.body.id, 'under_review', null, 'normal');
await updateStatus(leader.account, parentTask.body.id, 'assigned', childLeadership.body.id);
const receivedTasks = await childLeader.request(`/api/work/sites/${childSiteId}/items/overview`);
assert.equal(receivedTasks.status, 200, `child received tasks: ${JSON.stringify(receivedTasks.body)}`);
const received = receivedTasks.body.find(item => item.title === 'Synthetic parent-to-child task');
assert.ok(received, 'Transferred task missing in child site');
assert.equal(received.status, 'registered');

await updateStatus(childLeader, received.id, 'under_review', null, 'normal', childSiteId);
await updateStatus(childLeader, received.id, 'planning', null, null, childSiteId);
const childQueue = await childLeader.request(`/api/workflows/planning/sites/${childSiteId}`);
assert.equal(childQueue.status, 200, `child planning queue: ${JSON.stringify(childQueue.body)}`);
const childPlan = childQueue.body.items.find(item => item.item.id === received.id);
assert.ok(childPlan, 'Child planning run missing');
const parentPlanAccess = await leader.account.request(`/api/workflows/planning/sites/${childSiteId}`);
assert.equal(parentPlanAccess.status, 403, 'Parent leader must not inspect child planning queue');
const childClaim = await childLeader.post(`/api/workflows/planning/${childPlan.id}/claim`, {});
assert.equal(childClaim.status, 204);
const childSubmit = await childLeader.post(`/api/workflows/planning/${childPlan.id}/submit`, {
  priority: 'normal', dueAt: null, allocations: [],
});
assert.equal(childSubmit.status, 204, `child plan submission: ${JSON.stringify(childSubmit.body)}`);
const childApprove = await childLeader.post(`/api/workflows/planning/${childPlan.id}/decision`, { action: 'approve', note: null });
assert.equal(childApprove.status, 204, `child plan approval: ${JSON.stringify(childApprove.body)}`);
const childRelease = await childLeader.post(`/api/workflows/planning/${childPlan.id}/decision`, { action: 'release', note: null });
assert.equal(childRelease.status, 204, `child plan release: ${JSON.stringify(childRelease.body)}`);
const parentExecutionAccess = await leader.account.request(`/api/execution/sites/${childSiteId}`);
assert.equal(parentExecutionAccess.status, 403, 'Parent leader must not inspect child execution queue');
await executeDefault(childLeader, received.id, childSiteId);
await finishAndArchive(childLeader, received.id, null, 'Child site', childSiteId);

const officialResponse = await leader.account.request(`/api/work/sites/${siteId}/items/${received.id}/details`);
assert.equal(officialResponse.status, 200, `official child response: ${JSON.stringify(officialResponse.body)}`);
assert.ok(officialResponse.body.task.finalReport?.includes('Child site completed its work.'), 'Official child report missing at parent');
assert.equal(officialResponse.body.plan, null, 'Child plan must not cross the site boundary');
const childInternalDetails = await leader.account.request(`/api/work/sites/${childSiteId}/items/${received.id}/details`);
assert.equal(childInternalDetails.status, 403, 'Parent leader must not access child internal details');
await finishAndArchive(leader.account, parentTask.body.id, null, 'Parent site');

const newParentName = `Synthetic New Parent ${suffix}`;
const newParent = await platform.post('/api/sites/', { name: newParentName, overviewDesign: 'classic' });
assert.equal(newParent.status, 201, `new parent site: ${JSON.stringify(newParent.body)}`);
const newParentId = newParent.body.id;
const destinationSearch = `/api/work/sites/${siteId}/request-recipients?search=${encodeURIComponent(newParentName)}`;
const recipientDirectory = await leader.account.request(destinationSearch);
assert.equal(recipientDirectory.status, 200, JSON.stringify(recipientDirectory.body));
const destination = recipientDirectory.body.find(value => value.kind === 'site' && value.id === newParentId);
assert.ok(destination && /^[0-9a-f-]{36}$/i.test(destination.instanceId), 'Local destination lacks an instance-qualified site identity');
const foreignRecipientInstanceId = randomUUID();
const foreignAddress = await leader.account.post(`/api/work/sites/${siteId}/items`, {
  title: 'Rejected foreign address', description: 'Must not create a local request',
  recommendation: null, referenceUrl: null, dueAt: null, workItemTypeId: null,
  sourceTypeId: null, senderId: null, targetSiteId: newParentId,
  targetInstanceId: foreignRecipientInstanceId, targetUnitId: null, assignedUnitId: null,
});
assert.equal(foreignAddress.status, 409, `foreign instance address: ${JSON.stringify(foreignAddress.body)}`);
assert.equal(foreignAddress.body.error, 'federated_recipient_not_routable');
const repeatedDirectory = await leader.account.request(destinationSearch);
assert.equal(repeatedDirectory.body.find(value => value.id === newParentId)?.instanceId, destination.instanceId,
  'Instance identity changed between directory requests');
const newParentManager = await platform.post(`/api/sites/${newParentId}/site-managers`, { personId: siteManager.personId });
assert.equal(newParentManager.status, 201, `new parent manager: ${JSON.stringify(newParentManager.body)}`);
const newParentLeadership = await siteManager.account.post(`/api/sites/${newParentId}/organization-units`, {
  name: 'Leadership', parentId: null, isTemporary: false, worksAtParentLevel: false, isSiteLeadership: true,
});
assert.equal(newParentLeadership.status, 201, `new parent leadership: ${JSON.stringify(newParentLeadership.body)}`);
const newParentLeader = await appointLeader('new-parent-leader', newParentLeadership.body.id, newParentId);
const inactiveUnit = await siteManager.account.post(`/api/sites/${newParentId}/organization-units`, {
  name: 'Inactive placement', parentId: null, isTemporary: false, worksAtParentLevel: false, isSiteLeadership: false,
});
assert.equal(inactiveUnit.status, 201, `inactive placement setup: ${JSON.stringify(inactiveUnit.body)}`);
const deactivateUnit = await siteManager.account.put(`/api/sites/${newParentId}/organization-units/${inactiveUnit.body.id}`, {
  name: 'Inactive placement', parentId: null, isTemporary: false, isActive: false,
  worksAtParentLevel: false, isSiteLeadership: false,
});
assert.equal(deactivateUnit.status, 200, `deactivate placement: ${JSON.stringify(deactivateUnit.body)}`);
const inactivePlacement = await platform.put(`/api/sites/${childSiteId}`, {
  name: childSiteName, parentOrganizationUnitId: inactiveUnit.body.id, isActive: true, overviewDesign: 'classic',
});
assert.equal(inactivePlacement.status, 400, `inactive placement accepted: ${JSON.stringify(inactivePlacement.body)}`);

async function createParentAssignment(account, parentSiteId, title) {
  const result = await account.post(`/api/work/sites/${parentSiteId}/items`, {
    title, description: `${title} description`, recommendation: null,
    referenceUrl: null, dueAt: null, workItemTypeId: null, sourceTypeId: null, senderId: null,
    targetSiteId: null, targetUnitId: null, assignedUnitId: null,
  });
  assert.equal(result.status, 201, `${title}: ${JSON.stringify(result.body)}`);
  await updateStatus(account, result.body.id, 'under_review', null, 'normal', parentSiteId);
  await updateStatus(account, result.body.id, 'assigned', childLeadership.body.id, null, parentSiteId);
  const overview = await childLeader.request(`/api/work/sites/${childSiteId}/items/overview`);
  assert.equal(overview.status, 200, `child overview: ${JSON.stringify(overview.body)}`);
  const receivedTask = overview.body.find(item => item.title === title);
  assert.ok(receivedTask, `${title} missing at child site`);
  return { parentId: result.body.id, receivedId: receivedTask.id };
}

async function completeTransferredAssignment(assignment, parentAccount, parentSiteId, reportLabel) {
  await updateStatus(childLeader, assignment.receivedId, 'under_review', null, 'normal', childSiteId);
  await executeDefault(childLeader, assignment.receivedId, childSiteId);
  await finishAndArchive(childLeader, assignment.receivedId, null, reportLabel, childSiteId);
  const response = await parentAccount.request(`/api/work/sites/${parentSiteId}/items/${assignment.receivedId}/details`);
  assert.equal(response.status, 200, `historical report route: ${JSON.stringify(response.body)}`);
  assert.ok(response.body.task.finalReport?.includes(`${reportLabel} completed its work.`),
    `Report did not return to the original parent ${parentSiteId}`);
  await finishAndArchive(parentAccount, assignment.parentId, null, reportLabel, parentSiteId);
}

const oldRoute = await createParentAssignment(leader.account, siteId, 'Synthetic move: original parent route');
const moved = await platform.put(`/api/sites/${childSiteId}`, {
  name: childSiteName, parentOrganizationUnitId: newParentLeadership.body.id, isActive: true, overviewDesign: 'classic',
});
assert.equal(moved.status, 200, `move child site: ${JSON.stringify(moved.body)}`);
const oldRouteAfterMove = await childLeader.request(`/api/work/sites/${childSiteId}/items/overview`);
assert.equal(oldRouteAfterMove.status, 200, `old route after move: ${JSON.stringify(oldRouteAfterMove.body)}`);
assert.equal(oldRouteAfterMove.body.find(item => item.id === oldRoute.receivedId)?.senderSiteName,
  `Synthetic E2E Site ${suffix}`, 'Original sender-site snapshot changed after move');
await completeTransferredAssignment(oldRoute, leader.account, siteId, 'Original parent route');

const newRoute = await createParentAssignment(newParentLeader, newParentId, 'Synthetic move: new parent route');
const detached = await platform.put(`/api/sites/${childSiteId}`, {
  name: childSiteName, parentOrganizationUnitId: null, isActive: true, overviewDesign: 'classic',
});
assert.equal(detached.status, 200, `detach child site: ${JSON.stringify(detached.body)}`);
const newRouteAfterDetach = await childLeader.request(`/api/work/sites/${childSiteId}/items/overview`);
assert.equal(newRouteAfterDetach.status, 200, `new route after detach: ${JSON.stringify(newRouteAfterDetach.body)}`);
assert.equal(newRouteAfterDetach.body.find(item => item.id === newRoute.receivedId)?.senderSiteName,
  newParentName, 'New parent sender-site snapshot changed after detachment');
await completeTransferredAssignment(newRoute, newParentLeader, newParentId, 'New parent route');

const noLongerChild = await newParentLeader.post(`/api/work/sites/${newParentId}/items`, {
  title: 'Synthetic detached routing check', description: 'Cannot assign to a former child site', recommendation: null,
  referenceUrl: null, dueAt: null, workItemTypeId: null, sourceTypeId: null, senderId: null,
  targetSiteId: null, targetUnitId: null, assignedUnitId: null,
});
assert.equal(noLongerChild.status, 201, `detached routing check: ${JSON.stringify(noLongerChild.body)}`);
await updateStatus(newParentLeader, noLongerChild.body.id, 'under_review', null, 'normal', newParentId);
const rejectedRoute = await newParentLeader.put(`/api/work/sites/${newParentId}/items/${noLongerChild.body.id}/status`, {
  status: 'assigned', assignedUnitId: childLeadership.body.id, decisionNote: null, priority: null,
});
assert.equal(rejectedRoute.status, 400, `Detached child still eligible: ${JSON.stringify(rejectedRoute.body)}`);

const reattached = await platform.put(`/api/sites/${childSiteId}`, {
  name: childSiteName, parentOrganizationUnitId: leadership.body.id, isActive: true, overviewDesign: 'classic',
});
assert.equal(reattached.status, 200, `reattach child site: ${JSON.stringify(reattached.body)}`);
const grandchildSiteName = `Synthetic Grandchild ${suffix}`;
const grandchildSite = await platform.post('/api/sites/', { name: grandchildSiteName, overviewDesign: 'classic' });
assert.equal(grandchildSite.status, 201, `grandchild site: ${JSON.stringify(grandchildSite.body)}`);
const grandchildSiteId = grandchildSite.body.id;
const grandchildAttachment = await platform.put(`/api/sites/${grandchildSiteId}`, {
  name: grandchildSiteName, parentOrganizationUnitId: childLeadership.body.id, isActive: true, overviewDesign: 'classic',
});
assert.equal(grandchildAttachment.status, 200, `attach grandchild site: ${JSON.stringify(grandchildAttachment.body)}`);
const grandchildManager = await platform.post(`/api/sites/${grandchildSiteId}/site-managers`, { personId: siteManager.personId });
assert.equal(grandchildManager.status, 201, `grandchild manager: ${JSON.stringify(grandchildManager.body)}`);
const grandchildLeadership = await siteManager.account.post(`/api/sites/${grandchildSiteId}/organization-units`, {
  name: 'Leadership', parentId: null, isTemporary: false, worksAtParentLevel: false, isSiteLeadership: true,
});
assert.equal(grandchildLeadership.status, 201, `grandchild leadership: ${JSON.stringify(grandchildLeadership.body)}`);
const grandchildLeader = await appointLeader('grandchild-leader', grandchildLeadership.body.id, grandchildSiteId);

const recursiveRoute = await createParentAssignment(leader.account, siteId, 'Synthetic three-site reporting');
await updateStatus(childLeader, recursiveRoute.receivedId, 'under_review', null, 'normal', childSiteId);
await updateStatus(childLeader, recursiveRoute.receivedId, 'assigned', grandchildLeadership.body.id, null, childSiteId);
const grandchildOverview = await grandchildLeader.request(`/api/work/sites/${grandchildSiteId}/items/overview`);
assert.equal(grandchildOverview.status, 200, `grandchild overview: ${JSON.stringify(grandchildOverview.body)}`);
const grandchildItems = grandchildOverview.body.filter(item => item.title === 'Synthetic three-site reporting');
assert.equal(grandchildItems.length, 1, 'Grandchild assignment duplicated or missing');
const grandchildTaskId = grandchildItems[0].id;
const topWorkload = await leader.account.request(`/api/work/sites/${siteId}/descendant-workload`);
assert.equal(topWorkload.status, 200, `top workload: ${JSON.stringify(topWorkload.body)}`);
assert.equal(topWorkload.body.siteSummaries.find(entry => entry.siteId === childSiteId)?.active, 1,
  'Top site did not count the grandchild task through the child site');
const childWorkload = await childLeader.request(`/api/work/sites/${childSiteId}/descendant-workload`);
assert.equal(childWorkload.status, 200, `child workload: ${JSON.stringify(childWorkload.body)}`);
assert.equal(childWorkload.body.siteSummaries.find(entry => entry.siteId === grandchildSiteId)?.active, 1,
  'Child site did not count the grandchild task');
await updateStatus(grandchildLeader, grandchildTaskId, 'under_review', null, 'normal', grandchildSiteId);
await executeDefault(grandchildLeader, grandchildTaskId, grandchildSiteId);
await finishAndArchive(grandchildLeader, grandchildTaskId, null, 'Grandchild site', grandchildSiteId);
const childOfficialReport = await childLeader.request(`/api/work/sites/${childSiteId}/items/${grandchildTaskId}/details`);
assert.equal(childOfficialReport.status, 200, `grandchild report to child: ${JSON.stringify(childOfficialReport.body)}`);
assert.ok(childOfficialReport.body.task.finalReport?.includes('Grandchild site completed its work.'),
  'Grandchild report did not return to its direct parent');
const prematureGrandchildAccess = await leader.account.request(`/api/work/sites/${siteId}/items/${grandchildTaskId}/details`);
assert.notEqual(prematureGrandchildAccess.status, 200, 'Grandchild report skipped the child-site boundary');
await finishAndArchive(childLeader, recursiveRoute.receivedId, null, 'Child site', childSiteId);
const parentOfficialReport = await leader.account.request(`/api/work/sites/${siteId}/items/${recursiveRoute.receivedId}/details`);
assert.equal(parentOfficialReport.status, 200, `child report to parent: ${JSON.stringify(parentOfficialReport.body)}`);
assert.ok(parentOfficialReport.body.task.finalReport?.includes('Child site completed its work.'),
  'Child report did not return to the top parent');
assert.ok(!parentOfficialReport.body.task.finalReport.includes('Grandchild site completed its work.'),
  'Grandchild report leaked into the official child response');
await finishAndArchive(leader.account, recursiveRoute.parentId, null, 'Top site');

const requests = await testCrossSiteRequests({
  platform, siteManager: siteManager.account,
  sender: leader.account, senderSiteId: siteId, senderSiteName: `Synthetic E2E Site ${suffix}`,
  recipientInstanceId: destination.instanceId,
  subordinateOrigins: [
    { label: 'Section 1', account: sectionLeader, unitId: sectionId },
    { label: 'Staff', account: staffLeader, unitId: staffId },
    { label: 'Team Alpha', account: teamLeader, unitId: teamId },
  ],
  internalRecipients: [
    { label: 'Team Alpha', account: teamLeader, unitId: teamId },
    { label: 'Section 2', account: sectionTwoLeader, unitId: sectionTwoId },
  ],
  receiver: newParentLeader, receiverSiteId: newParentId,
  suffix, updateStatus, executeDefault, finishAndArchive,
});

const combinedBranches = await testCombinedBranches({
  leader: leader.account, sectionLeader, sectionTwoLeader, receiver: newParentLeader,
  siteId, receiverSiteId: newParentId, recipientInstanceId: destination.instanceId,
  sectionId, sectionTwoId, suffix, updateStatus,
});

const transitionChains = await testTransitionChains({
  leader: leader.account, sectionLeader, siteId, sectionId, sectionTwoId, suffix, executeDefault,
});

const authorizationBoundarySite = await platform.post('/api/sites/', {
  name: `Synthetic Authorization Boundary ${suffix}`, overviewDesign: 'classic',
});
assert.equal(authorizationBoundarySite.status, 201,
  `authorization boundary site: ${JSON.stringify(authorizationBoundarySite.body)}`);
const authorizationBoundaries = await testAuthorizationBoundaries({
  platform, siteManager: siteManager.account, leader: leader.account, sectionLeader,
  sectionTwoLeader, teamLeader, unrelatedLeader: newParentLeader, siteId,
  otherSiteId: newParentId,
  foreignAdministrationSiteId: authorizationBoundarySite.body.id,
  otherSiteTaskId: noLongerChild.body.id,
  sectionTaskId: sectionTask.id, teamTaskId: teamTask.id,
  topReportTaskId: transitionChains.approvedReportTaskId,
  planningRunId: run.id, executionRunId: executionRun.id,
});

const administrationReportApis = await testAdministrationReportApis({
  platform, leader: leader.account, siteId, childSiteId, sectionId, teamId,
  topReportId: mainTask.body.id, sectionReportId: sectionTask.id, teamReportId: teamTask.id,
  incompleteReportId: transitionChains.approvedReportTaskId, suffix, executeDefault,
});

const dependencies = await testDependencies({
  leader: leader.account, siteId, otherSiteTaskId: noLongerChild.body.id, suffix, executeDefault,
});

// Later feature fixtures deliberately add content to the completed task.
// Exercise the explicit authorized editing pause; normal completion remains locked.
const completedLifecyclePath = `/api/information/sites/${siteId}/work-items/${task.body.id}`;
const completedLifecycle = (await leader.account.request(completedLifecyclePath)).body;
assert.ok(['closed', 'archived'].includes(completedLifecycle.stage));
const reopenedFixture = await leader.account.post(`${completedLifecyclePath}/transitions`, { stage: 'active', expectedVersion: completedLifecycle.version, reason: 'Add synthetic decision and comment regression fixtures' });
assert.equal(reopenedFixture.status, 200, JSON.stringify(reopenedFixture.body));
assert.equal(reopenedFixture.body.automationPaused, true);

const decisionsRisksVersions = await testDecisionsRisksVersions({
  leader: leader.account, sibling: sectionTwoLeader, unrelated: newParentLeader,
  siteId, otherSiteId: newParentId, personId: leader.personId,
  taskId: task.body.id, planId: run.id, executionId: executionRun.id,
  sectionTaskId: sectionTask.id, approvedReportTaskId: transitionChains.approvedReportTaskId, suffix,
});

const commentReader = await makeUser('comment-reader', siteId, leadership.body.id);
const taskComments = await testTaskComments({
  leader: leader.account, reader: commentReader.account, sibling: sectionTwoLeader,
  unrelated: newParentLeader, platform, siteId, otherSiteId: newParentId,
  taskId: task.body.id, readerPersonId: commentReader.personId, base,
});

const learning = await testLearning({ leader: leader.account, reader: commentReader.account, sibling: sectionTwoLeader,
  unrelated: newParentLeader, platform, siteManager: siteManager.account, sectionLeader,
  siteId, otherSiteId: newParentId, sectionId, taskId: task.body.id, draftIds: learningDrafts.map(value => value.id),
  base, executeDefault, updateStatus,
});

const archiveManager = await appointLeader('archive-manager', leadership.body.id);
const activityLifecycle = await testActivityLifecycle({ leader: leader.account, manager: archiveManager, sibling: sectionTwoLeader, unrelated: newParentLeader, platform, siteManager: siteManager.account, siteId, otherSiteId: newParentId, taskId: task.body.id, base, suffix });

const webhooks = await testWebhookFailureIsolation({
  platform, leader: leader.account, unrelated: newParentLeader,
  siteId, otherSiteId: newParentId, taskId: task.body.id, suffix,
});

const portability = await testPortability({
  platform, siteManager: siteManager.account, leader: leader.account,
  siteId, otherSiteId: newParentId, taskId: task.body.id,
  decisionId: decisionsRisksVersions.decisionId, riskId: decisionsRisksVersions.riskId,
});

const federation = await testFederationCandidates({
  platform, siteManager: siteManager.account, rootSiteId: siteId, childSiteId,
});
const identitySessionLifecycle = await testIdentitySessionLifecycle({
  base, platform, siteManager: siteManager.account, siteId, makeUser, client, authenticationPost,
});

const governanceLifecycle = await testGovernanceLifecycle({ platform, unauthorized: leader.account, makeUser, suffix });

const removedLicense = await platform.request('/api/platform/license', { method: 'DELETE' });
assert.equal(removedLicense.status, 204);
const afterRemoval = await platform.request('/api/configuration');
assert.equal(afterRemoval.body.edition, 'community');
assert.equal((await platform.request('/api/platform/license')).body.status.state, 'none');
const blockedAfterRemoval = await platform.post('/api/platform/api-clients/', { name: 'Removed synthetic client', scopes: ['sites:read'], expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
assert.equal(blockedAfterRemoval.status, 403);
const clientsAfterRemoval = await platform.request('/api/platform/api-clients/');
assert.equal(clientsAfterRemoval.status, 200);
assert.ok(clientsAfterRemoval.body.some(value => value.id === administrationReportApis.machineClientId), 'Enterprise-created client metadata must remain readable');
const peersAfterRemoval = await platform.request('/api/platform/federation/peers');
assert.equal(peersAfterRemoval.status, 200);
const federationIdentityAfterRemoval = await platform.request('/api/platform/federation/identity');
assert.equal(federationIdentityAfterRemoval.status, 200);
assert.equal(federationIdentityAfterRemoval.body.keyConfigured, true,
  'Federation identity metadata must remain readable after license removal');
const blockedRoutingAfterRemoval = await platform.put('/api/platform/federation/routing', { enabled: true });
assert.equal(blockedRoutingAfterRemoval.status, 403);
const taskAfterRemoval = await leader.account.request(`/api/work/sites/${siteId}/items/${task.body.id}/details`);
assert.equal(taskAfterRemoval.status, 200, 'Customer-owned work must remain readable after license removal');
// The lifecycle scenarios intentionally exercise the same production-style
// authentication limiter partition as the boundary test below.
await new Promise((resolve) => setTimeout(resolve, 61_000));
const authenticationBoundary = await testAuthenticationBoundary({ base });
const storedEncoding = await testStoredEncoding({ leader: leader.account, siteId, unitId: leadership.body.id, workItemTypeId: taskTypeId });
console.log(JSON.stringify({ asvsEncoding: 'passed', ...customCssEncoding, ...storedEncoding, ...numericInput }));
const workloadLoad = await measureWorkload({ leader: leader.account, platform, siteId, unitId: leadership.body.id, workItemTypeId: taskTypeId });

console.log(JSON.stringify({ editionsAndTransitions: 'passed', ...activityLifecycle, ...governanceLifecycle, workloadLoad, bootstrap: 'passed', ...authSessionSecurity, ...identitySessionLifecycle, ...authenticationBoundary, roleSetup: 'passed', lookupSorting: 'passed', operationalIsolation: 'passed', localPlanningExecutionReport: 'passed', threeLevelDistribution: 'passed', parentChildReporting: 'passed', crossSiteIsolation: 'passed', reportArchives: 'passed', activeSiteMoveRouting: 'passed', detachedSiteRouting: 'passed', placementValidation: 'passed', senderSnapshots: 'passed', threeSiteReporting: 'passed', recursiveSiteWorkload: 'passed', crossSiteRequestResponse: 'passed', crossSiteRequestCancellation: 'passed', combinedBranches: 'passed', transitionChains: 'passed', ...authorizationBoundaries, administrationReportApis: 'passed', dependencies: 'passed', ...learning, taskComments: 'passed', taskCommentsResult: taskComments, decisionsRisksVersions: 'passed', webhookFailureIsolation: 'passed', portability: 'passed', federationCandidates: 'passed', [process.env.FYLKREN_E2E_SMTP_HOST ? 'requestNotificationsDelivered' : 'requestNotificationsQueued']: 'passed', siteId, childSiteId, grandchildSiteId, newParentId, answeredRequestId: requests.answeredTrackingId, directMixedTaskId: combinedBranches.directSourceId, plannedMixedTaskId: combinedBranches.plannedSourceId, ...transitionChains, ...administrationReportApis, ...dependencies, ...decisionsRisksVersions, ...webhooks, ...portability, taskId: task.body.id, hierarchyTaskId: mainTask.body.id, parentTaskId: parentTask.body.id }));
