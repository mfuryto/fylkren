# Offline password blocklist

Fylkren screens locally managed passwords against a bundled blocklist. Runtime checks are entirely local and do not require or attempt internet access, so the same policy works in air-gapped installations.

The generated resource contains sorted SHA-256 fingerprints, not the source passwords. It covers the first 3,000 entries that satisfy Fylkren's 14–128 character password policy. The current source is `Passwords/Common-Credentials/Pwdb_top-1000000.txt` from SecLists release `2026.1`, pinned by the following values:

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
