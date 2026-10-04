# Offline password blocklist

Fylkren screens locally managed passwords against a bundled blocklist. Runtime checks are entirely local and do not require or attempt internet access, so the same policy works in air-gapped installations.

## Context-specific words

The local password policy rejects a candidate that contains any normalized token of four or more characters from this maintained list:

- the built-in product identifier `Fylkren`;
- the local identity's username;
- the person's display name; and
- the person's email address, including its local and domain components.

Matching uses Unicode NFKC normalization and invariant lowercase. Spaces and the punctuation characters `. , ; : @ \\ / - _ + ( ) [ ]` separate tokens, so case or punctuation changes do not bypass a listed word. Tokens shorter than four characters are omitted to avoid rejecting broad sets of unrelated passphrases. The same inputs are supplied during initial Platform Manager creation, password change and password reset. The separate bundled common-password list covers widely used passwords and common role/department terms independent of a particular account.

The common-password resource contains sorted SHA-256 fingerprints, not the source passwords. It covers the first 3,000 entries that satisfy Fylkren's 14–128 character password policy. The current source is `Passwords/Common-Credentials/Pwdb_top-1000000.txt` from SecLists release `2026.1`, pinned by the following values:

- Git commit: `190c6f7bd58c847ceadfe57d9853592737f059e8`
- Source SHA-256: `e9a88f67aafe65496682dc374559ee714e978bee50314767494c3e37a18c9fc8`
- Generated resource SHA-256: `66e30d55061376fbbb14783be31a6dec1c8aac86ed765a2ff58ca9343a869940`
- License: MIT; see `../project/THIRD_PARTY_NOTICES.md`

Maintainers can reproduce the binary resource after obtaining the pinned source file:

```bash
node tools/security/generate-password-blocklist.mjs \
  /path/to/Pwdb_top-1000000.txt \
  apps/api/Identity/common-passwords.sha256
```

The generator refuses source content with a different checksum. Updating the source therefore requires an explicit review of the release, checksum, attribution, generated resource, policy tests, and this document.

## Breached-password set

The separate breached-password resource is derived from SecLists' PII-free `Passwords/Leaked-Databases/fortinet-2021_passwords.txt` at the same pinned commit. SecLists documents this directory as passwords obtained from data breaches without user-linkable PII, and identifies the Fortinet list as passwords from the 2021 Fortinet breach. Fylkren retains every unique normalized entry that satisfies the 14–128 character policy: 8,249 sorted SHA-256 fingerprints. The raw breach list is used only as generator input and is not distributed with Fylkren.

- Git commit: `190c6f7bd58c847ceadfe57d9853592737f059e8`
- Source SHA-256: `6b9a57a8a3d8cfce01bd1e0f6892aafdefbdb03c1551351d70f8fb25da29425d`
- Generated resource SHA-256: `74bce61752988a11bdfd733bec641f7554f448e9333f68d9e03d932bf8d9c607`
- License: MIT; see `../project/THIRD_PARTY_NOTICES.md`

Maintainers can reproduce it after obtaining that exact source file:

```bash
node tools/security/generate-breached-password-blocklist.mjs \
  /path/to/fortinet-2021_passwords.txt \
  apps/api/Identity/breached-passwords.sha256
```

The generator rejects any other source checksum. Source/release changes require the same explicit provenance, attribution, resource-hash and policy-test review as the common-password resource.
