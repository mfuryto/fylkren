# End-to-end acceptance matrix

This is the maintained manual acceptance suite for Fylkren's task, request, reporting, authorization, and integration chains. Run it in a closed environment with synthetic data. Never use ordinary production records or credentials.

The matrix defines current scenarios and acceptance criteria. Historical defect narratives belong in the issue tracker and release history, not in this executable specification.

## Release gate

A scenario passes only when:

- each work level has exactly one correct work instance;
- every transition keeps the item in the correct site and work level;
- title, instructions, references, deadline, priority, and classification are preserved;
- plans, execution history, and final reports are visible only where the access model permits them;
- **Requires action**, active counts, deadlines, overdue state, workload, and notifications change at the correct transition;
- internal processing never crosses a site boundary unless the contract explicitly permits it;
- every responsible level writes and approves its own final report;
- reports are stored at the correct level and request receipts exist on both sides where required;
- release, return, reassignment, cancellation, and completion preserve history;
- unauthorized UI actions are absent and equivalent direct API calls are rejected;
- actual results, deviations, evidence, and the tested commit are recorded.

A correct final status does not compensate for a defect during the chain. After a fix, rerun the complete affected scenario from clean fixtures, plus adjacent regression scenarios.

### Permanent reference and list-ordering checks

- create task types with explicit abbreviations and verify the management list defaults to newest first;
- verify a new type proposes the first three valid letters in the Site Manager interface while still allowing an explicit abbreviation;
- create root tasks in more than one Site and verify the installation-wide counter prevents duplicate references even when the same abbreviation is used;
- create concurrent roots, sibling delegations, side requests and a deeper delegation; verify unique `TYPE-000001`, `TYPE-000001-1`, `TYPE-000001-2` and `TYPE-000001-1-1` shapes;
- verify the same reference is searchable and displayed first in Tasks, Planning, Execution and Reports and retained in the final report;
- verify a federated receiver preserves origin instance and origin reference while allocating its own local reference;
- verify an upgrade restores only the complete legacy Site defaults affected by the historical translation migration, preserves customized workflow/template content, and creates new Sites with stored English defaults and real line breaks;
- exercise every visible sort option against the complete result set, including paginated queues, and verify ordered process structures keep their configured semantic order.

## Standard fixture

```text
TEST North (independent top-level site)
├── Leadership (designated site leadership unit)
├── Staff (works at parent level)
├── Section 1
│   ├── Team Alpha
│   └── Team Beta
└── Section 2

TEST South (independent top-level site)
├── Leadership (designated site leadership unit)
└── Receiving Section

TEST Child
├── Leadership (designated site leadership unit)
└── Specialist Team

TEST Grandchild
└── Leadership (designated site leadership unit)
```

Attach `TEST Child` below `TEST North` for hierarchy scenarios, and `TEST Grandchild` below `TEST Child` for recursive scenarios. Create an empty `TEST New Parent` for move tests.

Create people with unique synthetic email addresses:

| Person | Assignment |
| --- | --- |
| Platform operator | Platform Manager only |
| North site administrator | Site Manager only |
| North commander | Leader at site top level |
| North deputy | Staff leader with authority to act at parent level |
| North planner | Planner in Staff working at parent level |
| Section 1 leader | Leader in Section 1 |
| Team Alpha leader | Leader in Team Alpha |
| Team Alpha member | Ordinary member in Team Alpha |
| South commander | Leader at TEST South top level |
| South planner | Planner at TEST South top level |
| Child commander | Leader at TEST Child top level |

Configure the standard planning workflow, at least two execution workflows, a rich-text template, the final-report template, timeline and task-distribution steps, all notification categories, and both classified and unclassified test chains.

## Evidence record

| Field | Recorded value |
| --- | --- |
| Scenario and run ID | |
| Date and tester | |
| Commit and displayed version | |
| Environment and browser/device | |
| Fixture reset confirmed | Yes / No |
| Status at every site and level | |
| Counts, workload, and Requires action | |
| Notifications and delivery status | |
| Reports and receipts created | |
| Negative authorization attempts | |
| Evidence references | |
| Deviation IDs | |
| Result | Pass / Fail / Blocked |

Never record passwords, API secrets, MFA material, personal data, or classified operational data.

## Scenarios

### E2E-01 — Local top-level task with direct execution

Register a complete task, assess it, set leader priority, and send it directly to execution. Claim and complete an execution workflow, then write, classify, approve, and complete the final report. Verify that the recommendation appears during initial assessment only, and check the report archive, PDF/print output, audit, counts, workload, and notifications.

### E2E-02 — Local top-level task through planning

Send a task to planning. Preview it without creating an ownership lock, then claim it, complete the configured workflow, use a template and timeline, and submit it. Add an RFI in one step, edit and answer it from another, and verify autosave, responsive wrapping, role/site isolation, retention after release/reassignment, read-only display after submission, and inclusion in the immutable approved version. Return the plan once with a written correction and confirm that all content (including RFI) remains. Resubmit and approve without distribution. Verify that approval creates an immutable approved version but does not start execution. Put the approved plan on hold, select two predecessor tasks, and resume it to the approved-but-not-released state only after both predecessors are complete. The task card must show `Wait` and `Release` under `Next step`, while `View plan` remains read-only and no separate `Send request` action appears for planned requests. Explicitly release the plan and send the task to execution at the same level. Finish reporting. Approval and release must be available from Tasks without requiring the leader to open Planning.

### E2E-03 — Three internal levels

Distribute from site top level to Section 1. Plan there and distribute to Team Alpha. Team Alpha executes and approves its report; Section 1 then writes and approves its own report; site top level repeats the reporting step. Repeat without planning. Operational counts belong to the receiving level, while superior workload aggregates recursively without duplicating tasks.

### E2E-04 — Staff and parent-level authority

Assign top-level work to Staff. The Staff leader must handle it as Staff work, while separate deputy authority continues to permit acting at parent level without moving the task. A planner may plan for the authorized level but cannot approve as leader unless separately granted that authority. Release and reassign active planning and execution and confirm that content and history remain. Test Staff both directly below the site root and below the designated leadership unit.

### E2E-05 — Parent site to child site

Attach TEST Child below TEST North and send an ordinary assignment across the site boundary. Verify separate organization, managed type lists, and immutable sender snapshots. Plan, distribute internally, execute, and report within the child site. Only the child's approved official report may cross back; the parent must not inspect internal plans, execution, or subordinate reports. The parent then writes its own report, and each responsible site retains its report.

### E2E-06 — Recursive site hierarchy

Route an assignment from TEST North through TEST Child to TEST Grandchild. Complete and report back exactly one boundary at a time. No report may skip a level, duplicate, change ownership, or enter the wrong archive. Superior sites receive recursive workload aggregation without operational access.

### E2E-07 — Moving sites with active work

Start a parent-to-child assignment, move the child to TEST New Parent, and then make it independent. The active chain must retain its original reporting route and sender snapshots, while new work follows the new hierarchy. Reject cycles, self-placement, inactive targets, and invalid child relationships.

### E2E-08 — Direct request between top-level sites

Send a request from TEST North to TEST South. Verify distinct sent/received presentation and counting. The sender sees official lifecycle states only. TEST South may plan, distribute internally, execute, and approve one official response. TEST North receives only that response and can accept and complete it. Store the response as a report/receipt in both sites with the responding site's official header. Also cancel a request and verify notification, recipient acknowledgement, terminal state, and removal from active/control counts.

### E2E-09 — Requests from subordinate levels

Send cross-site requests from Section 1, Staff, and Team Alpha. The official sender is TEST North, while **Registered by** identifies the person. Return the response to the exact originating work level. Also send internal requests between subordinate levels; these use ordinary internal visibility rather than cross-site filtering. Count active workload once at the receiver and once in recursive superior aggregation.

### E2E-10 — Side request and planned request

Create one main task with both internal distribution and a side request. Both branches must coexist without replacing or duplicating the main task. Create a plan containing both branch types and a multiline instruction list for each receiving unit, return it once, and confirm that no recipient instance exists before approval. Approval must preserve the exact plan and create no recipient instance. Explicitly release the approved plan and verify that each branch is materialized exactly once with the correct frozen basis. Each delegated item must show its own instruction list first; the parent plan is optional collapsed context, not a replacement for the instruction list. Repeat after placing the approved plan on hold and resuming it.

### E2E-11 — Waiting, return, rejection, reassignment, and cancellation

Run each transition as a complete chain:

- place received work on hold and resume it;
- reject and reopen it;
- return a plan with written correction;
- return an unapproved final report;
- confirm that an approved report cannot be returned;
- reassign to the same unit and require fresh report approval;
- reassign to another unit and preserve completed sibling history as read-only context;
- cancel the complete chain with top-leader authority;
- withdraw a request and let the recipient acknowledge and close it.

Verify UI and API actions, history, counts, workload, notifications, and terminal-list placement at every transition.

### E2E-12 — Authorization and negative isolation

Test representative reads and mutations as Platform Manager, Site Manager, leader, delegated leader, planner, and ordinary member.

- Platform Manager has platform operations but no operational content without separate operational access.
- Site Manager administers Organization, Personnel, Workflows, Templates, Notifications, and Audit for the site, but performs no ordinary task processing.
- Leaders act only at their authorized level; superior leaders receive workload and reporting, not subordinate processing controls.
- A delegated deputy retains explicitly granted leader authority.
- Planners read relevant tasks and edit planning at their authorized level but do not approve as leaders.
- Ordinary members read their level and work only on assignments received by themselves or their team.
- Sibling units, unrelated sites, and recipient-internal cross-site processing remain inaccessible.

For every hidden UI operation, send the equivalent direct HTTP request and verify `403` or a deliberately concealed `404`.

### E2E-13 — Administration and report APIs

For the administration API, test every scope separately; create, read, edit, move, and deactivate a synthetic site; exercise successful, missing, and stale ETags; verify idempotent replay and conflicting reuse; reject hierarchy cycles; manage a synthetic user's assignment and lifecycle; and read and change classifications.

For the report API, test missing credentials, missing scope, missing grant, the exact granted top and deep levels, `organizationPath`, incomplete and unapproved reports, and classified reports with and without `includeClassified`. Disable the client and verify immediate rejection. Platform machine events must appear only in Platform Audit. Follow the formal contracts in [API conventions](../../docs/api/API.md), [Administration API](../../docs/api/ADMINISTRATION_API.md), and [Report API](../../docs/api/REPORT_API.md).

### E2E-14 — AD/LDAP directory lifecycle

Link synthetic users through AD and LDAP and establish authenticated sessions.
Verify scheduled and manual synchronization by stable ID, managed name/email
updates and visible last-check status. Disable and expire an AD account and make
an LDAP entry fail its configured active-account filter; each link must suspend
on the first authoritative check and its existing session must fail on the next
request. Delete an entry and confirm that access remains through the configured
missing-confirmation threshold, then suspends. Restore every entry and verify
the same internal person, memberships, roles and history are retained while the
link resumes. During TLS failure, directory outage, invalid lookup bind,
ambiguous stable ID and malformed attributes, no user may be suspended. Confirm
transition audit events use the `directory-lifecycle` system actor and that no
password, bind secret or sensitive attribute is logged.

Configure Local, AD, LDAP, OIDC and SAML from Platform Manager rather than by
editing environment variables. Verify secrets never return to the browser,
configuration and test actions are audited, saved changes take effect without a
restart and the first upgrade imports existing environment values exactly once.
Reject external provider writes in Community. Reject local-login deactivation
without a tested external Platform Manager path. Reject activation of an
external provider until its current saved configuration has passed the
connection test. Enable direct OIDC/SAML and
verify normal visits bypass the login form while `/?local=1` retains documented
emergency local presentation. Changing or disabling the selected SSO provider
must automatically cancel direct redirect until it is tested and selected again.

Evidence status on 2026-09-29: the maintained [OpenLDAP](runs/2026-09-29-live-openldap-identity.md), [Samba Active Directory](runs/2026-09-29-live-active-directory-identity.md), and [OIDC/SAML](runs/2026-09-29-live-oidc-saml-identity.md) laboratories pass the complete identity scenario above. Evidence includes scheduled and manual synchronization, disabled/expired/missing accounts, malformed and ambiguous LDAP data, invalid bind and outage fail-safe behavior, exact provider namespaces, unlink/relink, one-time environment import, secret-safe audit/log checks, Community write rejection, local lockout guards, direct-SSO redirect/emergency presentation/cancellation, signed positive flows and forged, wrong-nonce, wrong-audience, unsigned, tampered and replayed callback negatives. Repeat the maintained commands unchanged against the final release-candidate revision; external customer IdPs, certificate rotation, multi-domain AD and load remain deployment/interoperability evidence rather than missing functional controls in E2E-14.

### E2E-15 — Dependencies and blocked progress

Create a task with two finish-to-start predecessors. Verify it remains blocked until both are completed; one completion alone must not release it. Check blocked state in Tasks and the API, and reject direct API progress while blocked. Reject self-dependency, duplicates, cross-site references and cycles. Add a dependency while assessing a task, place it on hold for that reason, and verify that an approved plan cannot be released while the dependency remains active. Remove a dependency and confirm that the change is audited and the derived blocked state updates.

### E2E-16 — Decisions, risks, and formal versions

Record a decision against a task, plan and execution with rationale, makers, time and status. Revise it and verify stable decision ID, immutable numbered revisions and separate audit events. Record a risk and multiple assigned mitigation actions, update action status and residual assessment, and verify ownership, due dates, history and site isolation. Approve a plan and final report, then change the working content and approve again. Compare the exact earlier and later immutable versions, approvers, timestamps and integrity hashes. The default comparison must present readable plan steps, delegated work, requests, reports and decisions with changed fields highlighted, while original JSON remains available only when expanded. Confirm the technical audit is separate from formal sign-off history. Deny sibling-unit and unrelated-site reads and writes through both UI and direct API.

### E2E-17 — Domain events and webhooks

Subscribe a synthetic HTTPS receiver to selected versioned events for one site. Create and complete work, approve a plan, start execution and record a decision. Verify stable event IDs, envelope version and tenant context, correct payload, signature validation, delivery history and no event leakage from another site. Make the receiver time out and return non-2xx responses; the originating action must still commit, retries must be bounded and visible, and receiver-side deduplication by event ID must work. Deactivate the subscription and verify new deliveries stop without deleting prior history. Follow the [webhook contract](../../docs/api/WEBHOOKS.md).

### E2E-18 — Portable export and import validation

Export one synthetic site with tasks, relationships, reports, approval versions, decisions, risks, audit/history and available attachments. Verify authorization, site isolation, audit of the export, manifest/schema version and integrity metadata. Inspect structured data independently of a running installation. Validate a valid package without changing application data; reject tampered files, incompatible versions, malformed identifiers, missing relationships and attempts to cross a site boundary. Confirm that the current API exposes validation only and cannot apply an import. A future import-apply operation requires its own acceptance scenario before release. Keep installation backup/restore tests separate from portable export/import. Follow the [portable format](../../docs/api/PORTABLE_EXPORT_FORMAT.md).

### E2E-19 — Host status and backup registration

Run the maintained collector against a fresh Compose installation. Verify that
Platform Manager shows filesystem capacity and healthy web, API and PostgreSQL
containers with their actual restart counts. Stop one container and confirm the
next snapshot reports it down without affecting the application-level checks.
Inject a stale, oversized and structurally invalid snapshot and confirm each is
rejected or marked unavailable without content entering logs. Record a complete
synthetic database, environment and key archive set and verify the completion
time appears; reject missing and empty artifacts. Recreate a container and
confirm the displayed restart count follows Docker's current-container scope.
Verify the maintained backup command creates a PostgreSQL custom dump, protected
environment copy, matching key archive, manifest, checksums and `COMPLETE`
marker in one timestamped directory and automatically publishes the completion
time. With local retention set to two, create older complete and incomplete
fixtures; remove only the oldest complete set and preserve the incomplete set.
Reject missing and empty externally supplied artifacts. Destructively restore
the generated set into fresh database and key volumes, verify checksums before
replacement and confirm the recovered installation returns to its pre-backup
setup state.
Verify the API container has no Docker socket and only a read-only snapshot
mount. Repeat collection inside the Hyper-V Linux VM during the maintained
Windows Server acceptance run.

### E2E-20 — Internal experience-based learning

Save positive and improvement points with a final-report draft. Verify atomic validation, stable numbering and retry deduplication. Keep original point text immutable while leaders prioritize and process it. Require an action plan and deadline for in-progress work, outcomes for closure and a fresh rationale for reopening. Check pending counts before and after treatment, searchable closed history, comment pagination, stale/concurrent save rejection and audit references. Deny administrative-only, sibling-level and unrelated-site reads/writes and missing-CSRF writes. A superior may read eligible formal report versions without reading subordinate internal learning. Verify absence of point text in report archives, print/PDF, approved report versions, delegation bases and federated official answers. Complete Site portability and backups must retain points, authors and treatment history. Check keyboard and mobile presentation in both Norwegian and English.

## Cross-cutting regression

- server-side pagination with more than 20 items in Tasks, Planning, Execution, and Reports;
- search, filters, newest-first order, stable deep links, and no filter reset when opening an item;
- desktop and mobile layouts, rotation, modal scrolling, keyboard navigation, and no horizontal overflow;
- rich-text headings and lists in editors, read views, reports, print, and PDF;
- autosave during navigation, release, reassignment, and browser refresh;
- notification creation, queue status, retries, SMTP delivery, personal muting, and visible failure reason;
- report classification in every printed page header and footer;
- no duplicate work instances, request cards, action entries, notifications, or reports;
- no sensitive data in logs, audit, URLs, or browser storage.

## Current baseline

The [2026-10-02 release regression](runs/2026-10-02-release-regression.md) records the fresh API/edition, browser/report/privacy, identity, license, backup and federation runs, together with workload and image-scan evidence and explicit remaining release gates.

E2E-01 through E2E-13 were exercised with synthetic data during development, and discovered defects were corrected and regression-tested. That development evidence does not replace a clean release run. Before a production-ready release, execute this complete matrix against the release candidate from reset fixtures and retain an evidence record for every scenario.

The former E2E-14 multi-theme scenario is intentionally retired because the additional overview design was removed.

## Deviation handling

Assign every deviation a stable ID such as `E2E-08-01`. Record expected and actual results, affected site and level, safe evidence, logs without secrets, and the correcting commit. Close it only after rerunning the complete scenario and adjacent regression scenarios.
