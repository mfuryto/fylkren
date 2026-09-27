# Portable export and customer exit

Fylkren's portable export is an open, site-scoped customer-data package. It exists for portability, migration, archival and customer exit. It can be created and read without a vendor service or an Internet connection.

It is not a disaster-recovery backup. A backup preserves an installation, including PostgreSQL state, configuration and the matching Data Protection key ring. A portable export deliberately excludes installation and authentication secrets and is not a drop-in database restore.

## Package layout

Format identifier: `fylkren-portable-export`  
Current format version: `1.0`

The package is a conventional ZIP archive:

```text
manifest.json
README.txt
data/*.jsonl
attachments/*
```

`manifest.json` contains the stable export ID, format and application versions, UTC export time, site ID and name, scope, integrity algorithm, exclusions and an inventory of every dataset and attachment. Each inventory entry records its relative path, media type, byte length and SHA-256 digest. Dataset entries also record the number of records.

Structured data uses UTF-8 JSON Lines: one independent JSON object per line. Property names use `snake_case`. Stable Fylkren UUIDs and relationship keys are retained so records remain understandable and can later be reconstructed. The files can be inspected using ordinary ZIP and JSON tools; a running Fylkren installation is not required.

Binary content is stored in its original format under `attachments/`. Fylkren currently stores document references rather than uploaded operational files. Consequently, workflow document URLs and metadata are present in structured datasets while the referenced external files are not copied. Profile images are included as binary attachments when present.

## Included data

The site export includes the site record, organization and roles, site membership and relevant people, non-secret identity references, tasks and relationships, dependencies and state history, workflow definitions/templates/runs/content/links/timelines, planning RFI log entries, execution runs/content/follow-up/timelines, final reports embedded in tasks, decisions and immutable revisions, risks/mitigations and immutable revisions, site audit history, domain events, sanitized webhook configuration and delivery history, notification history and notification preferences. `data/planning-rfi-entries.jsonl` links each request and answer to its planning run through `run_id`.

Cross-site relationships can retain identifiers and sender snapshots needed to understand the record, but the package never follows such a relationship into another site's private data.

## Deliberate exclusions

The export never contains password hashes, password-reset grants, sessions, TOTP secrets, recovery codes, passkey/WebAuthn credentials, SMTP credentials or webhook signing secrets. These are installation security material, not portable customer content. Import into another installation must explicitly map or recreate identities and integration credentials.

## API and authorization

Authenticated Platform Managers and the Site Manager for the selected site can use:

- `POST /api/portability/sites/{siteId}/export`
- `POST /api/portability/sites/{siteId}/imports/validate` with multipart field `package`

Both operations enforce the selected site boundary. Export and validation attempts are recorded in that site's audit log. The browser exposes both operations from **Sites** for Platform Manager; Site Managers can use the same authenticated API for their own site.

The validation endpoint performs no import. It validates ZIP paths and limits, manifest structure, supported format version, target site ID, declared files, record counts, JSON structure, duplicate record IDs, site-boundary markers, file sizes and SHA-256 values. It rejects a package belonging to a different site before any application data can change.

## Migration/import contract

Format `1.0` establishes a safe import foundation, not a promise that arbitrary packages are immediately applied. A future apply operation must run only after successful validation and in a transaction. It must additionally:

1. reject unresolved identifier collisions or require an explicit mapping;
2. map people and external identities without importing authentication secrets;
3. preserve stable IDs and immutable histories where possible;
4. validate every foreign-key relationship before writing;
5. preserve the package's site boundary and never merge data into another tenant implicitly;
6. write an audit record containing the package identity and outcome;
7. roll back the complete operation if any record fails.

Adding an apply endpoint before these rules are implemented and tested is prohibited. Validation-only behavior prevents a partially implemented importer from corrupting production data while keeping exported customer data fully accessible and portable today.

## Compatibility

Readers must use the manifest rather than assume a fixed file list. A reader can accept a new minor format only when its compatibility rules are documented. An unsupported version is rejected by Fylkren's validator. Format documentation must remain available with public releases so historical exports remain interpretable.
