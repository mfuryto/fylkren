# Tasks and operational flow

This document is the authoritative task-state and routing contract. The user-facing procedure is in [the complete manual](USER_MANUAL.md).

## Core chain

```text
Task or request
  → leader assessment and priority
  → optional Planning
  → Execution
  → Final report, approval and completion
```

Across this chain: **Priority → delegation → status → learning → …**. Learning is continuous operational feedback: observations lead to discussion, prioritized treatment and outcomes that inform future assessments, plans and execution. Learning points retain the assignment reference and remain internal to their reporting level; they are separate records, not another task status or content automatically forwarded with final reports. See [the learning guide](LEARNING.md).

Planning may delegate work to one or more direct subordinate units or create side requests. Each receiver starts the same optional-planning/required-execution/reporting chain at its own level.

## Permanent task references

The database UUID remains the internal identity and authorization boundary. Every work item also has an immutable human-readable reference. A root task uses its task type abbreviation when available, otherwise its Site fallback code, followed by the installation-wide forward-only number, for example `INC-000123`. A child assignment or request appends its sibling number (`INC-000123-1`); deeper delegation extends the same path (`INC-000123-1-1`). Allocation locks the global counter or parent row in the same database transaction as creation, so concurrent registration and delegation cannot issue duplicates.

References are shown and searchable through Tasks, Planning, Execution and Reports. Formal approval snapshots and final reports retain the work item's reference. Changing a task type abbreviation, Site fallback code or number padding affects only new root tasks. Existing references are never rewritten or reused.

## Ownership and visibility

- A work item is owned by one site and operational level.
- Operational actions are authorized against that exact level.
- A parent tracking item remains while child assignments are active but is not counted as duplicate workload.
- A superior sees assignments it sent, controlled status and returned reports, not subordinate internal work.
- A task created independently at a subordinate level remains in that level's queues. Superior levels receive recursive aggregate workload only.
- Required ancestor context may be shown read-only; sibling branches remain hidden.

## State rules

### Assessment

Newly registered or received work requires a leader decision. The leader sets priority and may reject, wait, delegate, send to planning or send to execution. A cross-site/side request becomes available only after the work has been assessed.

### Planning

Planning has one active responsibility owner. Autosaved fields, links, timeline and draft delegation remain when responsibility is released/reassigned. Submission creates a leader action in Tasks. Approval freezes the plan as assignment basis; return reopens correction without erasing history. Approval does not itself send assignments or requests. The approved task card presents `Wait` and `Release` under `Next step`; viewing the plan is read-only. Release dispatches the approved assignments and requests.

After release, an approved plan with child assignments sends work to those receivers. An approved plan without child assignments proceeds to Execution at the planning level.

### Delegation and waiting

Internal delegation materializes a child assignment and changes the parent to a waiting/tracking condition. The parent cannot be sent to control while any direct child remains active. `Delegate further` is not offered again on the parent as a parallel action; reassignment occurs on the specific child.

Reassignment can target the same or another eligible unit. History remains. A previously approved child report must be approved again when the same work is reopened/reassigned.

### Task dependencies

An authorized leader can make a task depend on one or more other tasks in the same site. The initial dependency type is **finish-to-start**: the dependent task is blocked until every predecessor is completed. Blocked state is derived from the current predecessor states and is therefore released automatically; it is not a separately editable task status.

The task card identifies blocked work, shows the number of unresolved predecessors and provides a searchable dependency view. Progress actions are unavailable while blocked, although a leader may still place the task on hold, reject it or cancel the chain. The API rejects self-dependencies, duplicates, cross-site dependencies and any addition that would create a direct or indirect cycle. Adding and removing dependencies is recorded in site audit.

Each `Wait` decision offers a search for one or more predecessor tasks, including during plan approval and after plan approval. A written reason can be used alone or together with dependencies. A task with an approved plan returns to the approved, awaiting-release state when resumed after a hold; it is not dispatched merely by resuming.

Dependencies store an explicit type so later releases can add scheduling semantics and critical-path analysis without replacing the relationship model. This release does not provide duration calculations, automatic dates, critical-path calculation or Gantt presentation.

### Decisions

Formal operational decisions are first-class historical records and are not inferred from the technical audit log. A decision has a stable ID. Each append-only revision records title, decision text, rationale, status, decision time, one or more decision makers, the recording user, and typed references to the relevant task, assignment, plan or execution record.

Leaders can view and record decisions from the task context. Readers with access to the task can read its decisions. A correction or status change creates a new numbered revision through the API; it never overwrites the earlier wording, rationale, makers or references. Creation and revision are additionally recorded in site audit. The revision model provides a stable target for a future approval/sign-off record, but this release does not implement formal signatures or approval policy.

### Execution and control

Work may enter Execution directly after assessment or after approved planning. Execution completion is the only ordinary path to control. At control, the author can inspect execution history and direct child reports before writing the level's final report.

### Final report and completion

Every level writes and obtains approval for its own report. An approved report cannot be returned. Completion reports to the direct parent; the parent then completes its own control/report cycle. A fully completed task has no next action and cannot be reassigned.

### Cancellation

Authorized top leadership may cancel the complete active task chain with a reason. Cancellation propagates to active planning/execution/children while retaining all content and audit history. Cross-site cancellation is acknowledged by the receiver rather than silently deleting receiver work.

## Internal requests

An internal request creates receiver-owned work inside the same site and retains normal internal information sharing. It can originate at any work level and return to the exact sending level. Receiver workload is counted at the receiver and aggregates upward once.

## Cross-site requests

A cross-site request creates two deliberately separate records:

- sender tracking branch, linked to the originating task/level;
- receiver operational task at the selected independent site's top level.

The sender sees only a coarse projection such as received, assessed, distributed, answered/rejected/cancelled. Receiver internals never cross the boundary. The receiver's approved top-level final report becomes the official response. Acceptance archives a durable copy for both sites using the sender site's official header rules.

The request branch must not replace its source task: the sending site retains a tracking item linked to the source, and the receiving site owns a distinct operational item. A response is available to the sender only after the receiver's final report has been approved and the receiver's item completed. The sender may then close the tracking item; the approved response is copied into the sender's report archive while the receiver keeps its authored report. The sender cannot query the receiver's internal task details or execution queue using the tracking link.

Withdrawal follows a separate terminal path. The authorized sender cancels the tracking item with a reason; the receiver's item becomes **request cancelled**, and the receiving leader acknowledges it as complete. The sender's tracking item stays cancelled rather than becoming an accepted report. Both sites retain their records; active views and counters must exclude the terminal items after acknowledgement.

Requests copy display snapshots of type, source type, sender, sending site and registering person. They never add values to the receiver's site-managed registries.

## Parent/child sites

Hierarchical cross-site tasking uses durable sender/receiver links and controlled status/report return. A later site move changes new routing but does not reroute active chains. Arbitrary hierarchy depth is supported because every response returns one direct link at a time.

## Presentation rules

- Primary task cards start collapsed.
- Description is always a collapsed section; recommendation appears only during first assessment.
- Historical plan, execution and final-report sections for subordinate work start collapsed.
- Completed child assignments show history/report, not `Next step`, `Reassign` or standalone `View plan` actions.
- All available ordinary choices for the current state appear in one `Next step` area.
- Whole-chain cancellation remains a separate final danger action.
- Lists are newest-first, searchable/filterable and paginated.

## Counting rules

- Active counts represent active leaf workload, not every visible ancestor plus child.
- Received internal/cross-site requests count at the receiver.
- Sent cross-site requests use a separate sender count until terminal/acknowledged completion.
- Rejected, cancelled, reassigned and completed work is not active.
- `Requires action` contains only items for which the current level/person has an available required decision.
- Deadlines and overdue logic treat requests like tasks because they share the same operational fields.

## Reports and API

Reports retain author, approver, timestamps, organization path and classification snapshots. The read-only integration API exposes approved report data only under exact machine grants; it does not expose planning, execution or task history. See [API conventions](../api/API.md) and [Report API](../api/REPORT_API.md).
