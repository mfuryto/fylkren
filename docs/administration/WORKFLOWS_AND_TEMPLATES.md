# Workflows and templates

This is the administration and lifecycle contract for planning/execution workflows and reusable rich-text templates.

## Ownership and visibility

Only Site Manager can open workflow/template administration. Definitions are visible across the site for traceability and reuse awareness, but only the owning level can edit or logically deactivate eligible content.

The active planning workflow is site-owned and shared throughout the site. Execution workflows and ordinary step templates may be site-owned or created for an organizational level. Visibility does not automatically grant permission to use or edit a definition.

Deactivation removes a definition from new selection while preserving active and historical instances.

## Planning workflow

Each site has one active planning workflow. New sites receive editable **Standard**:

| Order | Step | Function |
| ---: | --- | --- |
| 1 | Analysis | Rich text plus timeline |
| 2 | Task | Rich text |
| 3 | Intent | Rich text |
| 4 | Plan | Rich text plus delegation/request builder |

Existing sites are never overwritten by an upgrade. A Site Manager may edit or replace the definition. Every organizational level uses the active site planning flow.

In the Plan step, planners write all tasks for one receiving unit in a single multiline instruction field. They may use one line per task and number the lines if useful; no task-by-task button is required. Adding another unit creates a separate delegated work item. The same plan may also include requests to multiple eligible sites. Delegations autosave when added, edited or removed; pending edits are flushed before changing steps or submitting the plan. The receiving unit's work item retains its own reporting chain, while cross-site requests use the separate request-response flow.

### RFI log

Each planning run has one **RFI (Request for information)** log, opened with the RFI button in any planning step. It is not a separate log per step. An entry has **Who**, **What** (the widest text field), **Due date**, an **Answered** yes/no checkbox, and **Answer**. Long text wraps and the entry form reflows rather than extending beyond the viewport. Text and dates autosave after a short debounce; leaving a field also flushes its pending change. The current planning owner can add, edit and remove entries while the run is in progress. Releasing or reassigning planning responsibility does not erase the log. A submitted/approved plan shows the log read-only with the plan; the approval snapshot contains the exact RFI state at approval. Cross-site recipients are not given the sender's internal RFI log merely because a plan was used as request context.

The browser uses `GET/POST /api/workflows/planning/{runId}/rfi` and `PUT/DELETE /api/workflows/planning/{runId}/rfi/{entryId}`. Reads require planning access at the run's exact site and work level. Writes additionally require the claimed planning owner and an in-progress run; all mutations are audited. These routes are internal browser APIs, not public machine-integration contracts.

Submitting a plan creates an approval request, not an operational dispatch. A leader's approval freezes the exact approved plan and leaves the task in an approved-but-not-released state. The task's **Next step** offers **Wait** and **Release**; **View plan** remains read-only. Waiting may include one or more predecessor tasks and/or a written reason. Only release creates the planned delegated work items and sends planned requests; there is no second standalone request action for those planned requests. Each receiving unit sees its own instruction list as the delegated work item; the parent plan remains available as collapsed context. A hold resumed after approval returns to the approved-but-not-released state rather than dispatching automatically.

## Execution workflows

New sites receive editable execution workflow **Standard**:

1. Preparations;
2. Execution;
3. Closure and follow-up.

Multiple execution workflows may be active. A user selects an eligible workflow when starting execution. A deleted default is not recreated by later upgrades; defaults are seeded only as part of initial site configuration.

## Templates

Templates provide optional initial rich text for a configured workflow step. Site Manager selects the template while editing the workflow definition. Users do not select templates during an active plan/execution.

Starting an instance copies template content into the step document. Later edits/deactivation never change active or completed instances.

The site owns one final-report template used at every level. New sites receive:

- Summary;
- Execution;
- Conclusion.

It is edited through a compact button/dialog on Templates; the page does not display a permanent large editor.

Templates do not carry classification controls. The resulting operational document/report may be classified independently where supported.

## Step capabilities

A workflow step may enable:

- rich-text document;
- named web/document references;
- one structured timeline;
- delegation to direct subordinate units (planning);
- side requests (planning where supported);
- internal tracking of external follow-up and responses (execution).

The system stores links/references, not local document file content. Browser-based local path selection cannot provide a durable portable path and is not simulated by an upload adapter.

## Rich text

The editor supports Normal, H1–H4, bullet lists and numbered lists. Editing shows formatted content rather than Markdown markers. Rendered content is sanitized. Page headings remain visually larger than document headings; lower document headings never become smaller than normal text.

Numbered lists restart at 1 after a true break such as a new heading. Lists preserve bullets/numbers and line separation in history, report basis and read-only views.

## Timeline

The timeline starts on the workflow instance date. Editing uses Date and Event rows and autosaves. Read-only presentation is horizontal and places points proportionally to elapsed time rather than equal visual spacing. Narrow layouts scroll the timeline inside its own bounded area.

Planning and execution use the same timeline component and persistence rules.

## Autosave and responsibility

Text, links and timeline changes autosave after a short, minimally noticeable debounce. Navigation to next/previous step flushes pending changes. There is no routine Save step button.

Only the responsibility owner edits an active instance. A qualified level leader may release it to the queue or assign another eligible person. All saved content, completed steps, links, timeline and history remain; release never resets the workflow.

Concurrent writes use optimistic concurrency. A conflict returns a controlled response and requires reloading current data instead of silently overwriting another user's work.

## Version and history rules

- Definition changes affect only future instances.
- Instance content is historical operational data and is never recomputed from the definition.
- Logical deletion/deactivation preserves references.
- Responsibility changes, submission, approval, return and completion are audited.
- Approved upstream plans are read-only assignment context at receiving levels.

## Internal API boundary

Workflow/template administration requires active Site Manager assignment in the owning site. Planning/execution queue and document endpoints authorize the exact work level and responsibility on every mutation. IDs supplied by the client are looked up and ownership-validated; they are never authorization evidence.

These internal browser APIs are not public machine-integration contracts. Supported external APIs are documented separately under [API conventions](../api/API.md).
