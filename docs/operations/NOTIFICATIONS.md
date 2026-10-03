# Email notifications

## Responsibility model

Platform Manager configures shared SMTP transport and global templates on Email. Site Manager enables categories per site on Notifications. The domain event, organizational level and recipient rules come from the task/access model; notification settings can never expand information access.

Historical events are not resent when notification support or a migration is installed. The final common-event upgrade drains only the old cursor's known unconsumed obligations in resumable startup batches, retaining existing rendered deliveries and their legacy deduplication key. It does not invent missing historical facts or replay rows already behind the old cursor.

New business commands create a common event, independent audit and frozen eligible notification snapshot together. The SMTP worker delivers the existing queue and no longer scans security audit records. Common projection state owns backlog reporting.

## SMTP and sender

Configuration includes host, port, STARTTLS, optional credentials, sender address and sender name. STARTTLS is recommended; unencrypted SMTP is limited to a trusted internal relay. The password is protected by persistent Data Protection keys, never returned to the client and replaced only when a new value is submitted. Test recipients are not stored.

Operational sender display is `<configured sender name> – <site name>`. Site identity is resolved by the service and is not hard-coded in templates.

## Site and personal choices

Site categories cover new assignments, task changes, leader decisions, completed subordinate work/final reports, plans awaiting approval and execution awaiting control. Cross-site and locally registered received work use the same new-assignment category at the receiving level.

For a cross-site request, the receiving site's **new assignment** category covers initial receipt. The sending site's **completed subordinate work** category covers the receiver's completed official response. If the sender withdraws the request, the receiving site's **task changes** category covers the withdrawal notice; the receiver must still acknowledge the cancellation in its task view. These are independent site choices and require eligible recipients at the relevant level.

Users inherit enabled site categories and may mute individual categories per site. A personal preference cannot enable a category disabled by Site Manager.

## Templates

Platform Manager edits one global subject/body template per event category. Supported fields are explicitly listed in the editor and include recipient, site, level, task title/type, priority, status, deadline, required action, triggering person, reporting unit, permalink and classification. Unknown placeholders are rejected.

Default templates are installed automatically. An upgrade may replace only an untouched original default; locally edited templates remain intact. Templates never include credentials, tokens, full work documents, plans, final reports or information the recipient could not already access.

## Recipient and disclosure rules

Recipients are active leaders and planners with scope at the event's exact level, including valid staff/deputy grants. Inactive people, missing email and out-of-scope roles are excluded. Platform Manager receives no site content through the platform role; Site Manager receives no operational notification without a separate operational role.

A user may receive a notification for an action they triggered when they are the only eligible leader/planner and can mute it personally. Sensitive or classified information must be minimized before use in ordinary email.

## Durable delivery

`notification_outbox` deduplicates event/recipient pairs and retains rendered recipient, subject and body. Delivery uses at most five attempts with exponential backoff and `pending`, `sent` or `failed` state. SMTP failure never rolls back the domain action.

Platform Email provides a paginated, status-filtered delivery view including transport state, projection backlog, queued/retried deliveries, recipient, site, task and timestamps. A failed delivery stores a safe concrete SMTP or technical reason. Technical logs include message ID and attempt metadata, not message content or secrets.

Plan submission and execution completion emit explicit atomic events; the delivery projector does not infer them later from a status view.

An isolated synthetic test on 2026-09-23 verified that receipt, completed response and sender withdrawal each create an outbox message for the intended site when the relevant category is enabled. With SMTP disabled, each remained `pending`, proving projection and queueing. A second fresh run used a local SMTP sink restricted to synthetic `example.invalid` recipients: all three relevant event deliveries reached `sent`, and the sink accepted the messages. This proves the asynchronous handoff to an SMTP server, **not** delivery to a real mailbox, STARTTLS, authentication or retry behavior.

A fresh closed-laboratory E2E-01 browser run on 2026-09-27 extended that evidence. The sink returned `451` for the first task message; the platform delivery view exposed it as pending with one attempt, the normal exponential backoff elapsed, and the same recipient then reached `sent` with `sentAt` set and `lastError` cleared. Inspection of the synthetic mailbox verified the decoded task title and task link. The [dated run record](../testing/runs/2026-09-27-e2e-01-smtp-retry-mailbox.md) ties the result to the exact harness revision. STARTTLS, authentication, an external production relay, DNS/spam handling and receipt at a provider-operated mailbox remain separate production checks.

The deployment operator confirmed receipt of a **new task** notification through a real email server on 2026-09-23. This is operator-reported evidence for that category only; the remaining categories, failure paths and recipient rules still need their own recorded production or closed-laboratory checks.

## Audit and verification

SMTP/template changes appear in platform audit; site category changes appear in site audit. Delivery state remains operational data on Email. Production verification covers every category across sites/levels, missing email, inactive users, role changes, SMTP failure, retry and deduplication. Negative tests ensure messages never cross an unauthorized site or level boundary.
