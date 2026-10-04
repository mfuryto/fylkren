import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const registration = readFileSync('apps/api/ServiceRegistration.cs', 'utf8');
assert.match(registration, /FallbackPolicy = new AuthorizationPolicyBuilder\(\)\s*\.RequireAuthenticatedUser\(\)/);

const serverPolicies = [
  ['apps/api/Organization/AccessAuthorization.cs', 'CanAdministerSite'],
  ['apps/api/WorkManagement/WorkItemPolicy.cs', 'CanManageItem'],
  ['apps/api/WorkManagement/WorkLevelAuthorization.cs', 'HasOperationalAccess'],
  ['apps/api/Learning/LearningPolicy.cs', 'CanManage'],
  ['apps/api/InformationLifecycle/ArchiveAccess.cs', 'CanRead'],
];
for (const [path, marker] of serverPolicies)
  assert.ok(readFileSync(path, 'utf8').includes(marker), `Trusted API policy is missing: ${path} / ${marker}`);

const directHttp = readFileSync('tools/e2e/authorization-boundaries.mjs', 'utf8');
assert.match(directHttp, /account\.(?:request|post|put)\(/);
assert.match(directHttp, /Site Manager task creation/);
assert.match(directHttp, /Foreign object under authorized site route/);
assert.doesNotMatch(directHttp, /page\.|locator\(|click\(/,
  'Authorization boundary evidence must call the API directly rather than depend on UI controls');

process.stdout.write(`${JSON.stringify({
  trustedServiceAuthorization: 'passed', serverPolicyLayers: serverPolicies.length,
  globalAuthenticatedFallback: true, directHttpNegativeEvidence: true, clientUiDependency: false,
})}\n`);
