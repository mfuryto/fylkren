import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const activity = readFileSync('apps/api/DomainEvents/ActivityQueryEndpoints.cs', 'utf8');
const siteAudit = readFileSync('apps/api/ActivityAudit/SiteAuditEndpoints.cs', 'utf8');
const platformAudit = readFileSync('apps/api/ActivityAudit/PlatformAuditEndpoints.cs', 'utf8');
const automation = readFileSync('apps/api/InformationLifecycle/WorkLifecycleAutomation.cs', 'utf8');

assert.match(automation, /AuditEvent\.FromSystem\([^;]+"work-lifecycle-automation"/s,
  'Automatic lifecycle events must retain a typed system actor.');
assert.match(activity, /x\.ActorKind == "system" \? "System"/,
  'Activity projection must present typed system events as System.');
assert.match(siteAudit, /value\.ActorSystem != null \? "System"/,
  'Site audit must present typed system events as System.');
assert.match(platformAudit, /value\.ActorSystem is not null\s*\? "System"/,
  'Platform audit must present typed system events as System.');
assert.match(siteAudit, /: "Unknown user"/,
  'A genuinely unresolved person actor must remain distinguishable from System.');

console.log(JSON.stringify({ systemActorPresentation: 'passed', activity: true, siteAudit: true,
  platformAudit: true, unresolvedPersonStillExplicit: true }));
