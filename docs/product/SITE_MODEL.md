# Site model

## Site boundary

One platform can host multiple isolated sites. Each site owns its durable identity, internal organization, administration, membership, roles, workflows, tasks, reports and history. Platform Manager controls the service and site relationships without automatically receiving access to operational site content.

Cross-site routing can operate within one installation or, when an entitled Platform Manager has explicitly enabled it, between approved independent installations. Federation uses the composite `(instanceId, siteId)` address and a separate remote-site directory; it never turns remote sites into locally administered rows. Active top-level sites become mutually available after bilateral peer approval and connection testing, without site-pair or directional grants. See the [federation architecture](../architecture/INSTANCE_FEDERATION.md) and [GUI administration guide](../administration/FEDERATION.md).

Only Platform Manager can create, rename, move or deactivate a site and assign its Site Manager. Deactivation is logical: historical references remain, operational memberships are released and affected people become available for reassignment. Circular site hierarchies are rejected.

Each site has a hidden durable root and exactly one explicitly designated active top-leadership unit. The designation is stored independently of name and language. The top-leadership unit is the visible organizational representation of the site's top operational level, not a separate queue or counter. Its protected leader role identifies the top-level leader.

## Internal levels

Ordinary units below the top-leadership unit form separate operational levels with their own task list, planning, execution, reporting and statistics. A level selector appears only when the person can act in more than one real context.

A staff unit may be placed beneath the top-leadership unit or beside it under the hidden site root. In either structure it remains an independent work level. “Works at parent level” grants members an additional scope at the parent level without removing the staff unit's own scope. An individual “May act as leader at parent level” grant provides deputy authority while preserving leadership in the person's own unit.

Internally created subordinate work remains visible and actionable at its owning level. Superior levels receive recursive capacity information but do not receive an ordinary task or “Requires action” entry unless an explicit delegation, report, approval or return transition requires superior action.

## Parent and child sites

A site can be attached to the hidden root or an ordinary unit in another site. The attachment establishes tasking and reporting direction; it does not merge administration, personnel, local configuration or internal visibility.

A child site remains independently administered and may itself have child sites. The parent organization view shows child sites as read-only site nodes. Child-site personnel never appear as internal parent-site personnel.

```text
Site A
├── Site B
│   ├── Site D
│   └── Site E
└── Site C
```

Moving a site changes future routing only. Existing cross-site work retains durable sender/receiver links and reports through its original chain. The site ID, internal organization, users, workflows, configuration and history remain unchanged.

### Placement and move invariants

- Only Platform Manager changes a site's placement. The target must be an active organizational unit in another site. A site cannot be attached to its own unit, to a descendant site, or to a missing or inactive unit; these requests must fail without changing the current placement.
- A site move does not transfer ownership of existing work or grant the new parent access to old work. An assignment already sent from Site A to Site B keeps its direct parent work-item link to A even if B is subsequently attached to Site C or made independent. B's approved official final report returns to A; C does not become the recipient of that report.
- A new assignment is routed using the hierarchy at the moment it is sent. If C sends work to B after the move, that assignment keeps C as its reporting parent even if B later moves again. Once B is independent, C cannot create a new hierarchical assignment to B through its former attachment.
- Sender-site and registering-person display values on transferred work are snapshots of the sending event. Renaming or moving a site does not rewrite those historical labels. Site-managed type, source-type and sender registries remain separate on each side of the boundary.
- A parent can follow the controlled status and official response of work it sent, but cannot inspect the receiving site's internal planning, execution or lower-level reports merely because it is or was the parent. A move must not expand that visibility.

For example, A assigns work to B, then B moves under C before completion. B finishes and approves its own report; the response returns to A, where A writes and approves its own report. A later assignment sent by C to B reports to C even if B becomes independent while it is active. The two chains coexist with different historical reporting parents.

## Cross-site tasking

When work crosses a site boundary, display values for task type, source type, sender, sending site and registering person are copied as immutable snapshots. Foreign registry IDs are not reused and the receiver's local registries are not populated.

Hierarchical tasking may expose the approved plan that forms the assignment basis, while local receiver planning and execution remain inside the receiver site. Status and final reporting travel one durable task link at a time, allowing arbitrary parent/child depth.

In an A → B → D chain, D's approved report returns to B, not directly to A. B uses that response to complete its own work and approves a separate B-level report to A. A then completes its own report. Each site retains the report it authored in its own archive; the upper site receives only the official response across its direct boundary. Recursive workload totals may include descendants, but they do not confer access to descendant case files.

A cross-site request can connect separate hierarchies without creating a parent relationship. Its receiver must be an active independent top-level site at send time. The sender sees coarse progress and one approved official top-level response; the receiver's internal planning, execution, delegation and subordinate reports remain private. Cross-site official report headers show the originating site only.

## Organization and ordering

The organization represents how work is currently organized, including permanent units, temporary teams and mission-specific structures. Units have a stable sibling order and can be moved deliberately. Every operational unit has a persistent leader role even when no person currently fills it.

## Management visibility

Superior levels see the information needed for direction and capacity management:

- active workload and status distribution;
- deadlines, overdue work and last relevant activity;
- blocking or explicit attention requirements;
- reports and approvals addressed to that level;
- recursively aggregated workload across internal descendants and child sites.

Aggregation must not expose subordinate personnel, working notes or internal task structure. Leadership receives management information and formal reporting, not implicit micromanagement access.

## Export and import

The versioned, open site export preserves stable IDs, organization, tasks, history, workflows, roles, references, decisions, risks and audit data. Identity mapping on a new platform is explicit and authentication secrets are excluded. An existing identical site ID on a target platform is a blocking conflict until an authorized migration has supplied an explicit mapping. See [Portable export and customer exit](../api/PORTABLE_EXPORT_FORMAT.md).
