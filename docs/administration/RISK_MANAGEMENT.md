# Risk and mitigation management

Risks are first-class, site-isolated records attached to a task, assignment, plan, or execution. Open Risk from the task detail links to work with a compact register and an interactive before/after risk map. The API also supports the other context types.

Each risk has a stable ID and immutable revisions. A revision records title, description, probability, impact, derived score and level, owner, status, due date, and optional residual probability and impact. Updating a risk creates a new revision instead of overwriting the earlier assessment. The initial assessment, implemented measures, and residual assessment therefore remain connected.

Mitigation measures are individual trackable actions with their own stable IDs and revision history. Each action has a responsible owner, status, and optional due date. Actions are not stored as an unstructured text block on the risk.

The current default score is probability multiplied by impact on a 1–5 scale. The derived labels are low, moderate, high, and critical. Scoring is isolated in the domain layer so a configurable matrix, acceptance authority, escalation, and reporting can be introduced later without changing historical assessments.

Users with read access to the relevant work tree can view risks. The leader who can manage the underlying object can create and revise risks and measures. Owners must be active members of the same site. Every change produces a site audit event; no risk data is shared across site boundaries.

API routes are available below `/api/risks`. Browser calls require the normal authenticated session and anti-forgery protection. Supported contextual object types are `task`, `assignment`, `plan`, and `execution`.

## Risk register and visual assessment

Each task has a numbered risk register with title, description, probability/impact before mitigation, mitigation actions, deadlines and residual probability/impact after mitigation. The numbers link each register row to its circles in the map. Numbers stay in creation order when risks are added or revised.

![Task risk register and before/after map using synthetic data](images/risk-workspace.png)

The 5 × 5 map puts impact on the horizontal axis and probability on the vertical axis, increasing upwards. Filled numbered circles show the assessment before mitigation; light circles show residual risk. A line joins the two assessments for the same risk. Risks sharing a cell are distributed within that cell so their markers remain individually selectable. A missing residual assessment has no residual marker or connecting line.

The map uses the existing score boundaries: low 1–4, moderate 5–9, high 10–16 and critical 17–25. Colors supplement the numeric coordinates and legend; they do not replace them. The displayed movement represents an entered assessment, not a system guarantee that a mitigation will achieve that reduction.

## Recording and following up a risk

1. Select **Record risk** and enter a title and description.
2. Assess probability and impact before mitigation, using the numeric fields or clicking a map cell.
3. Enter the first mitigation action and its deadline before assessing residual risk. The risk and first action are saved together; an invalid action leaves neither partially created.
4. Select the residual assessment and choose its map cell, or enter both residual values. Leave both empty if residual risk has not been assessed.
5. Save the risk. Map changes remain drafts until saved; later risk changes create new revisions.

Select a register row or a numbered circle to inspect a risk. To change an assessment, select its before/after heading and click a cell, or drag the selected risk's corresponding circle. Keyboard users can activate cells and markers with Enter or Space, or use the labeled numeric fields.

A risk can have several mitigation actions. Add actions from the register or editor, edit their descriptions and deadlines, and mark completed actions individually. Updating or completing an action retains its responsible owner and uses the current revision number to detect concurrent changes. Residual assessment remains a separate documented judgment; completing an action does not automatically lower the risk score.

On narrow screens the register scrolls horizontally within its own container and the map and editor stack vertically. Readers retain access to the register and map; creation and editing follow the existing operational leader permissions.

## Demonstrating the capability

Use synthetic risks in a product walkthrough. Show the initial position, the mitigation and deadline in the same register row, then the connected residual position. This gives reviewers a concrete view of the intended reduction and the measures behind it, with revision history and ownership providing traceability. This capability does not imply configurable scoring policies, automatic escalation, a certification or a separate risk-report export.
