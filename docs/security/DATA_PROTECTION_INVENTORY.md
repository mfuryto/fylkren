# Data protection inventory

This inventory classifies data by the harm caused by unauthorized disclosure or change. Customer-defined content markings are additional labels; they do not replace authorization or this technical classification.

| Protection level | Data families | Required controls |
| --- | --- | --- |
| Critical secret | Passwords, session and antiforgery cookies, reset/activation/MFA values, machine secrets, integration credentials including AI provider keys, signing private keys and Data Protection keys | Never log or place in URLs/browser storage; transmit only over approved protected channels; store only as salted verifier, authenticator-held key or purpose-protected ciphertext; tightly restrict custody; rotate/revoke and restore with the documented secret lifecycle |
| Restricted personal/security | Names, email, profile image, external stable identifiers, role/membership, audit actor, IP-derived security context and authentication/security events | Site/platform authorization and field minimization; no tracker disclosure; non-cacheable API responses; audited administration; customer-defined retention and controlled export |
| Restricted operational | Assignments, tasks, plans, decisions, risks, measures, comments, learning, reports, attachments/references, activity, notifications, webhooks, federation payloads and archives | Object/site authorization, restricted-task filtering, integrity/concurrency controls, non-cacheable API responses, authorized export, preservation/lifecycle rules and transport protection; apply customer content marking where configured |
| Operational configuration | Sites, organization, workflows, templates, reference codes, appearance, integration state without returned secrets and host-health summary | Administrative authorization, audit, bounded fields, safe presentation and backup/restore |
| Public | Login shell, branding explicitly configured for anonymous use, minimal health response and public configuration needed before sign-in | Integrity, safe media types, no sensitive fields and explicit public review |

Encoded values remain at the protection level of their decoded content. IDs, hashes, ciphertext, signed payloads and pseudonyms are not automatically public. Export packages, backups, logs, notification bodies, webhook deliveries and federated copies inherit the highest level of the data they contain.

## Processing and disclosure rules

- Sensitive inputs use request bodies or protected headers. Route and query values are limited to identifiers, pagination, filters and explicit non-secret presentation state.
- Every API response is `no-store`; authenticated state is held in an HttpOnly cookie. The web client stores only a non-sensitive overview layout preference in `localStorage` and keeps API data in memory. Sign-out clears the application GET cache and rerenders the unauthenticated shell.
- The Content Security Policy allows no third-party script, frame, image or connection origin. Fylkren has no analytics or advertising tracker.
- Database/backups and the Data Protection key ring require deployment access control. Transport and secret-custody controls are implemented and remain traceable through closed findings SV-103 and SV-105.
- Operational and personal fields are returned through explicit response projections and authorization checks. Security audit, technical logging and activity have distinct purposes and retention categories.
- AI processing is an explicit customer-selected disclosure to one configured provider. Only authorized context from selected Sites is sent; prompts and model responses are not placed in audit/activity logs, and provider retention, training and processing location remain part of the customer's provider assessment.
- Retention periods remain customer-configurable; irreversible deletion/anonymisation is disabled. Export packages are customer data and must use approved storage/transfer controls.

Changes that introduce a new data family, browser persistence, third-party recipient, public endpoint, export, attachment type or log field must update this inventory and reassess ASVS chapter 14 before release.
