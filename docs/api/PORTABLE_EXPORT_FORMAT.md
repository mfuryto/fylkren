# Portable export and customer exit

Fylkren's portable export is an open, site-scoped customer-data package. It exists for portability, migration, archival and customer exit. It can be created and read without a vendor service or an Internet connection.

It is not a disaster-recovery backup. A backup preserves an installation, including PostgreSQL state, configuration and the matching Data Protection key ring. A portable export deliberately excludes installation and authentication secrets and is not a drop-in database restore.

## Package layout

Format identifier: `fylkren-portable-export`  
Current format version: `1.1` (validator also accepts `1.0`)

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

## Snapshot and artifact custody

Export runs inside one PostgreSQL repeatable-read transaction, including authorization and all datasets. Format 1.1 records the instance UUID, transaction time and a SHA-256 fingerprint of the snapshot boundary; raw database transaction identifiers are not exposed. Concurrent committed changes cannot mix old and new related records in one package. The exporter validates its own completed package before saving the success audit and receipt. A package that exceeds 512 MiB or 250 ZIP entries fails without a success receipt; larger installations require a future bounded/chunked export capability.

The receipt identifies the exact ZIP by export ID, byte count and SHA-256, with the Site root lifecycle version. It is separate from the ZIP to avoid circular hashes. An authorized exporter can confirm custody only against the saved file's matching checksum and current receipt version, with an explicit recipient/rationale. Confirmation neither authorizes deletion nor proves import/restoration. The exit API states its limited `site-package` scope and keeps irreversible disposition disabled.

## Included data

The site export includes the site record, organization and roles, site membership and relevant people, non-secret identity references, tasks and relationships, dependencies and state history, internal learning points and their comments/treatment history, workflow definitions/templates/runs/content/links/timelines, planning RFI log entries, execution runs/content/follow-up/timelines, final reports embedded in tasks, decisions and immutable revisions, risks/mitigations and immutable revisions, site audit history, domain events, sanitized webhook configuration and delivery history, notification history and notification preferences. `data/planning-rfi-entries.jsonl` links each request and answer to its planning run through `run_id`.

Format 1.1 additionally includes Site reference settings, owned lifecycle records and hold history, the exact referenced immutable policy versions, archive grants, prior export receipts, common consumer projection state, locally owned federation work links and inbound receipts, and outbound envelope evidence without protocol payloads. Global person lifecycle references expose only identity/status/version/times, not another owner's governance reason. The current export receipt is not embedded in its own package.

Historical person references are collected from the owned records, including risk owners and revision authors without current membership. An unresolved legacy actor UUID gets a minimal export-only `historical_reference_only` record with no invented name, email or creation time; this does not recreate an account, anonymise stored data or grant access.

Cross-site relationships can retain identifiers and sender snapshots needed to understand the record, but the package never follows such a relationship into another site's private data.

## Deliberate exclusions

The export never contains password hashes, password-reset grants, sessions, TOTP secrets, recovery codes, passkey/WebAuthn credentials, SMTP credentials or webhook signing secrets. Installation-wide external identity bindings, identity-provider configuration, federation private payloads, foreign private records and global platform configuration are also excluded. These are installation security material, not portable customer content. Import into another installation must explicitly map or recreate identities and integration credentials.

## API and authorization

Authenticated Platform Managers and the Site Manager for the selected site can use:

- `POST /api/portability/sites/{siteId}/export`
- `POST /api/portability/sites/{siteId}/imports/validate` with multipart field `package`
- `GET /api/portability/sites/{siteId}/exports` (latest 20 receipts)
- `GET /api/portability/sites/{siteId}/exit` (bounded exit evidence, no disposition permission)
- `POST /api/portability/sites/{siteId}/exports/{exportId}/acknowledge` with `expectedVersion`, `packageSha256` and `reason`

All operations enforce the selected site boundary. Export and validation attempts are recorded in that site's audit log. Current closed/archived Site custodians with explicit export permission can export and confirm custody from **Archives**, but cannot apply or validate imports or gain operational access. The browser exposes export/validation from **Sites** for Platform Manager; Site Managers can use the same authenticated API for their own site.

The validation endpoint performs no import. It validates ZIP paths and limits, manifest structure, supported format version, target site ID, declared files, record counts, JSON structure, duplicate record IDs, site-boundary markers, file sizes and SHA-256 values. It rejects a package belonging to a different site before any application data can change.

## Migration/import contract

Formats `1.0` and `1.1` establish a safe import foundation, not a promise that arbitrary packages are immediately applied. A future apply operation must run only after successful validation and in a transaction. It must additionally:

1. reject unresolved identifier collisions or require an explicit mapping;
2. map people and external identities without importing authentication secrets;
3. preserve stable IDs and immutable histories where possible;
4. validate every foreign-key relationship before writing;
5. preserve the package's site boundary and never merge data into another tenant implicitly;
6. write an audit record containing the package identity and outcome;
7. roll back the complete operation if any record fails.

Adding an apply endpoint before these rules are implemented and tested is prohibited. Validation-only behavior prevents a partially implemented importer from corrupting production data while keeping exported customer data fully accessible and portable today.

## Compatibility

Readers must use the manifest rather than assume a fixed file list. A reader can accept a new minor format only when its compatibility rules are documented. Legacy 1.0 remains accepted with a warning that snapshot/lifecycle custody evidence is absent. Version 1.1 requires the new lifecycle datasets and exact referenced policy versions. An unsupported version is rejected by Fylkren's validator. Format documentation must remain available with public releases so historical exports remain interpretable.

Internal learning uses `data/learning-lessons.jsonl` and `data/learning-entries.jsonl`. Points reference work items, work-level units, authors and responsible people; entries reference points and authors. These recovery datasets are separate from the public final-report payload and are never added to report exports or forwarded reports.
