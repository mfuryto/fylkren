# Fylkren development notes

This file contains repository maintenance rules for developers and reviewers. It is deliberately excluded from the customer documentation bundled with Fylkren.

## Documentation maintenance

- Repository documentation, source comments, test descriptions and examples are written in English.
- `pnpm check:language` enforces the English-source repository boundary with the maintained language-marker set while excluding derived locale catalogs. `pnpm check:language:full` is the complete release gate and must pass before the release candidate is frozen.
- UI localization is separate from repository language. American English (`en-US`) is the source catalog and mandatory fallback; every language in the maintained roster is a complete bundled pack governed by the same automated acceptance rules.
- Every user-visible text change must update every complete bundled language pack in the same commit; the maintained [language roster and pack requirements](../docs/product/LOCALIZATION.md) are authoritative.
- Routes, API contracts, persistent identifiers and permalinks remain language-neutral.
- Documentation must describe current behavior. Planned behavior belongs in the roadmap, and released changes belong in the changelog.
- Air-gapped operation must never depend on external documentation, fonts, scripts or runtime lookups.
- Every user-visible feature must update the relevant manual section in the same change.
- Examples must use synthetic names and data. Commands must distinguish first installation, routine upgrade and destructive development-only operations.
- API documents are versioned contracts. UI labels and screenshots are supporting material, not authorization or protocol definitions.
- Security and test records describe evidence and remaining verification; they must not claim completion without reproducible results.

## Publication gate

Before public publication, run `bash tools/security/verify-repository-safety.sh --history`. The gate checks current content and reachable history for tracked local or generated artifacts, large files, workstation paths and secrets.

The customer documentation manifest is [`apps/web/customer-documentation.json`](../apps/web/customer-documentation.json). Add a document there only when it is intended for customer use and must be available inside an offline installation. Roadmaps, test evidence, release working papers, developer architecture notes and documentation rules stay repository-only.
