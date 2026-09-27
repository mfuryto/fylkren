# Risk and mitigation management

Risks are first-class, site-isolated records attached to a task, assignment, plan, or execution. The task view provides the first contextual user interface; the API model already supports the other context types without creating a separate GRC product.

Each risk has a stable ID and immutable revisions. A revision records title, description, probability, impact, derived score and level, owner, status, due date, and optional residual probability and impact. Updating a risk creates a new revision instead of overwriting the earlier assessment. The initial assessment, implemented measures, and residual assessment therefore remain connected.

Mitigation measures are individual trackable actions with their own stable IDs and revision history. Each action has a responsible owner, status, and optional due date. Actions are not stored as an unstructured text block on the risk.

The current default score is probability multiplied by impact on a 1–5 scale. The derived labels are low, moderate, high, and critical. Scoring is isolated in the domain layer so a configurable matrix, acceptance authority, escalation, and reporting can be introduced later without changing historical assessments.

Users with read access to the relevant work tree can view risks. The leader who can manage the underlying object can create and revise risks and measures. Owners must be active members of the same site. Every change produces a site audit event; no risk data is shared across site boundaries.

API routes are available below `/api/risks`. Browser calls require the normal authenticated session and anti-forgery protection. Supported contextual object types are `task`, `assignment`, `plan`, and `execution`.
