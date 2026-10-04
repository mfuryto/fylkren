# Security and retention model

This document defines the current security and retention behavior. Requirement-level test status and outstanding evidence belong only in the [ASVS matrix](ASVS_5.0.0_L2_MATRIX.md); the [security test plan](SECURITY_TEST_PLAN.md) defines the workflow and [verification record](SECURITY_VERIFICATION.md) holds findings.

## Identity and authentication

Fylkren supports local identities and configured AD, LDAP, OIDC, and SAML adapters. Platform Manager can see configuration and explicitly linked stable identifiers for administration, but no API returns passwords, client secrets or directory credentials, and public/non-privileged APIs do not expose external identifiers.

- AD and LDAP require LDAPS or StartTLS. The lookup account must be read-only and limited to required attributes. Filter values are escaped, lookup must resolve exactly one entry, and a user's password is used only for a separate bind to that resolved DN.
- OIDC links are namespaced by the exact canonical issuer and immutable `sub`; metadata issuer, nonce, transaction state and client audience are validated before the local session is established.
- SAML trusts only the configured identity provider, exact Entity ID, HTTPS metadata and signed response/assertion material. A permanent NameID is namespaced by that IdP Entity ID and must be explicitly linked to an active internal person. Unsigned, signature-invalid and replayed assertions are rejected.
- External identities are denied while unknown, disabled, or unlinked. Linking and unlinking are audited, and removing the final external Platform Manager path is blocked while local login is disabled.
- Active AD/LDAP links are checked by stable ID in the background. Authoritative disabled/expired results suspend immediately; missing entries require repeated successful confirmation; unavailable or ambiguous directory results fail safe without suspending access. Suspension and restoration are durably audited by the `directory-lifecycle` system actor.
- Provider configuration is managed in Platform Manager and stored in PostgreSQL. Bind passwords, OIDC client secrets and the rest of each provider configuration are encrypted with the persistent Data Protection key ring; secrets are never returned to the browser. Existing environment configuration is imported only when the database setting is first created and never overwrites later GUI configuration. External providers cannot be activated until the current saved configuration passes its connection test. Disabling local login or enabling direct SSO is guarded by tested-provider and Platform Manager linkage checks to reduce administrative lockout risk. `/?local=1` is the documented emergency local-login presentation when direct SSO is enabled, and disabling or changing the selected provider cancels direct redirect.
- Keep local authentication available during an external-provider rollout until at least one Platform Manager path has been verified.
- A directory-managed identity cannot bypass directory policy through local password, TOTP, or passkey authentication.

A normal sign-in identity is valid only while its person has an active site membership or active Site Manager responsibility in an active site. Removing the final relationship disables local sign-in but preserves authorship, tasks, reports, and audit references. Platform Manager identities have a separate system lifecycle and need no site membership.

## MFA and passkeys

TOTP secrets are protected with the persistent ASP.NET Data Protection key ring. Setup activates only after code verification, expires after ten minutes, and is cryptographically bound to the initiating identity. Sign-in challenges expire after five minutes. Recovery codes contain 128 bits of cryptographic randomness, are stored as SHA-256 digests, compared in constant time, and consumed atomically.

WebAuthn stores public credentials and counters; private keys remain on the authenticator. Challenges are short-lived, purpose-bound, and single-use.

MFA capabilities are enabled by default, but enrollment is currently voluntary and Fylkren does not yet enforce a second factor for every account or validate equivalent strength from every external provider (SV-094). `FYLKREN_MFA_ENABLED=false` hides and disables TOTP, passkeys, security keys, and WebAuthn endpoints without deleting existing credentials. This requires a documented risk decision and compensating controls. Network placement alone is not equivalent to strong authentication.

## Sessions and browser security

Local and linked external sign-in use `HttpOnly`, `SameSite=Strict` cookies with an eight-hour sliding lifetime and a twelve-hour absolute lifetime. With `FYLKREN_REQUIRE_HTTPS=true`, cookies are `Secure` and use the `__Host-` prefix. A bounded internal HTTP deployment uses a separate non-Secure cookie name.

Sessions are revalidated against identity, person, site access, and Platform Manager state at least every two minutes. AD/LDAP sessions are revalidated on every request so a directory-lifecycle suspension rejects the next request after the background check. Other deactivation or removal of final access invalidates an existing session within the ordinary validation interval. Data Protection keys live in a dedicated persistent volume so sessions and protected data survive normal container replacement.

All browser mutations, including sign-out, require an antiforgery token. The API and gateway set content-type, framing, referrer, permissions, Content Security Policy, cache, and HSTS protections as applicable. An external TLS terminator must reject weak protocols and cipher configurations.

The first Platform Manager is created through a token-free setup flow available only while none exists. A database transaction lock and repeated in-transaction check prevent parallel creation. After success, the setup endpoint behaves like an unknown resource. The database password is generated locally before first startup, stored only in the protected `.env`, and never replaced during upgrade.

## Rich text and references

Workflow content is stored as text using a bounded formatting model: Normal, H1–H4, unordered lists, and ordered lists. Rendering uses controlled application elements; raw HTML is never executed. Document references store only a display name and address. Fylkren does not upload, copy, execute, or render the referenced file.

## Secrets and SMTP

SMTP passwords use a dedicated Data Protection purpose and are never returned after storage. The interface exposes only whether a password exists. A blank password field preserves it; explicit removal deletes it. User-facing failures remain safe and concise, while restricted technical logs can contain the operational cause but never the secret. STARTTLS is recommended; clear-text SMTP is intended only for a trusted internal relay.

The complete secret inventory and lifecycle are maintained in [Secrets and security logging](SECRETS_AND_SECURITY_LOGGING.md).

## Three separate records

1. **Operational history** contains notes, decisions, meetings, states, responses, deliveries, and approvals.
2. **Audit** records who performed a traceable administrative or operational action, its type, affected object, and time. Domain history remains in its domain model rather than being duplicated into audit.
3. **Technical logging** records faults, jobs, database operations, updates, authentication failures, and service health.

Audit is append-only for ordinary users and administrators. Site Manager reads audit for the managed site. Platform Manager reads platform audit and restricted technical logs, but has no operational site-content access by default. The audit boundary is captured when an event occurs; later role changes never move old events between platform and site views.

The built-in technical log is a bounded in-process buffer, not a SIEM. It retains only `Warning` and higher, at most 300 entries and 2,000 characters per entry, and is lost at process restart. Password, token, API-key, Authorization, cookie, URI-credential, and sensitive query patterns are sanitized before storage.

Host status uses an external least-privilege collector rather than exposing the
Docker control socket to the API. The collector writes a bounded snapshot into a
directory mounted read-only in the API container. The API validates the schema,
age, lengths, numeric ranges and fixed status vocabulary. The snapshot excludes
environment values, logs, network addresses, volume paths and credentials.

## Authorization and restricted tasks

Authorization normally follows site, work level, role, and task relationship. A main task can be marked restricted to explicit units or roles, and child tasks normally inherit that restriction. Classification labels are not authorization decisions.

## Classification labels

Classification is an optional, platform-managed information label. Platform Manager enables it and manages name, abbreviation, order, and active state on **Classification**. Sites cannot create competing definitions.

When enabled, active labels are available for relevant operational text in tasks, planning, distribution, leader decisions, and final reports. Organization, personnel, link names, and link addresses have no classification selector. The API validates every selected definition against the central database register.

The label follows the information and final-report classification appears in report headers and footers. Disabling or deactivating a definition does not rewrite historical data. Classification does not assess clearance, nationality, or permission and does not replace site- and role-based authorization.

## Retention

The operating organization determines legal basis and retention policy. Fylkren does not encode one jurisdiction's rules. Supported policy outcomes can include:

- retain;
- review after a configured period;
- sanitize after a configured period.

Active and completed tasks are not normally deleted. Completed work becomes historical and read-only and leaves operational queues.

The [common lifecycle architecture](../architecture/EVENT_ACTIVITY_AND_INFORMATION_LIFECYCLE.md) separates access deactivation from reversible information closure/archive. Platform Managers administer versioned, reasoned holds and immutable named preservation policy versions. Multiple holds remain independent; releasing one does not release another. Optional review days are customer-configured metadata with no default duration or automatic expiry. Content, activity, security audit, delivery, replay and backup are distinct policy categories; binding a content rule does not create an audit or transport purge policy. Irreversible deletion/anonymisation and automatic retention execution remain disabled.

Existing federation transport cleanup now excludes work protected by a Site/root/owning-ancestor hold or information lock/archive, serializing housekeeping with hold/archive administration. Protocol receipts and delivered payloads can still be cleaned under their existing configured horizon for unprotected terminal work. Security audit records are never removed by federation transport maintenance. Legacy held roots are reconciled into durable hold records with explicitly unknown original actor and migration-time provenance.

## Sanitization and historical integrity

The system must preserve that an event occurred while allowing removal of personal or operational content that may no longer be retained. A controlled review can permanently remove or redact selected content while leaving a neutral audit event describing the sanitization, never the sensitive original.

Sanitized means removed from the operational database, not merely hidden or soft-deleted. Backup treatment must be defined with the deployment's backup and retention policy. Permanent deletion or sanitization requires dedicated authority, a reason, and an audit event.

## Export, import and restore

A site export can contain complete history and personal data. Export and package validation are therefore authorized per site and audited. The portable package uses documented ZIP, JSON Lines and original attachment formats with SHA-256 integrity metadata; it does not rely on proprietary encryption. Protect the resulting file with the customer's approved storage and transfer controls.

Portable export/import is not backup/restore. Database backups and the matching Data Protection key ring must be protected, retained and restored together for disaster recovery. See [Portable export and customer exit](../api/PORTABLE_EXPORT_FORMAT.md).
