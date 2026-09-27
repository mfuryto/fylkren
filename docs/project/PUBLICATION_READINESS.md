# Public repository readiness — pre-1.0

Status: **not ready to make public**. This is a gate and evidence record, not permission to change GitHub visibility or rewrite history.

## Intended public surface

- The main `mfuryto/fylkren` repository contains the complete distributable Community/Enterprise-capable product, tests and documentation. It is source-available under the unmodified PolyForm Perimeter 1.0.0 text in `LICENSE`.
- THUNOLD-OLSEN (Norwegian organization number 996871126) is identified in `NOTICE.md` and `TRADEMARKS.md`; legal ownership and trademark wording still require review.
- One codebase, one schema, one upgrade path, and the same API/web images for both editions. The official runtime enforces Enterprise entitlements server-side; Community works offline with no entitlement file.
- Only verification code and public keys belong in this repository. The bundled production public key is not a secret. Production license signing, private keys, customer/commercial records and payment logic belong in the separate private `thunold-olsen-licensing` repository. The documented signed JSON envelope is the trust boundary; compare the bundled key fingerprint with the issuer before public release.
- GitHub Issues may accept public bugs, feature requests and discussion after opening. There is no invitation for external patches or pull requests. Confidential vulnerability reports require a private channel first.

## Suggested GitHub presentation

**Description:** Self-hosted operational task management for hierarchical assignments, planning, execution and reporting. Source-available; Community and offline-licensed Enterprise.

**Topics:** `operational-task-management`, `mission-management`, `task-management`, `workflow`, `planning`, `execution`, `reporting`, `preparedness`, `self-hosted`, `offline-first`, `air-gapped`, `docker`, `dotnet`, `react`, `postgresql`, `source-available`, `enterprise-software`.

These are proposed metadata, not a claim that GitHub settings, Discussions or a security channel have been configured. Confirm actual GitHub metadata and public visibility only at the release gate.

## Current checks and findings

GitHub security settings were verified and tightened on 2026-09-27 while the repository remained private. Only `mfuryto` has repository access. Dependabot vulnerability alerts and automated security fixes are enabled. GitHub Actions is disabled because no maintained workflows exist; if workflows are introduced, re-enable only selected actions pinned to complete commit SHAs and keep the default workflow token read-only. Merge commits and rebase merges are disabled, squash is the only merge method, completed branches are deleted automatically, web-created commits require sign-off, and `CODEOWNERS` assigns review ownership to `@mfuryto`. Weekly Dependabot version checks cover pnpm/npm, NuGet and all three runtime Dockerfiles.

The current personal private-repository plan does not provide branch protection, repository rulesets, GitHub secret scanning or push protection. `main` therefore remains technically writable without a protected pull request. The [GitHub repository security runbook](../operations/GITHUB_REPOSITORY_SECURITY.md) contains a fail-closed audit/apply command for enabling and verifying those controls immediately after a separately approved visibility change; the command never makes the repository public. The personal-repository API also does not allow changing the reported private-fork setting. There are no repository webhooks, Actions secrets or deployment environments. One read-only deploy key is used for server checkout and one repository-scoped write deploy key is the current authenticated development push path; neither should be removed blindly. Rotate either key immediately if its host or custody is in doubt. The authenticated API could not confirm account-level two-factor authentication, and existing commits are not cryptographically signed; both remain owner-account controls to verify.

1. The exact current `LICENSE` text is compared byte-for-byte with the PolyForm project's [official 1.0.0 source](https://github.com/polyformproject/polyform-licenses/blob/1.0.0/PolyForm-Perimeter-1.0.0.md). SHA-256: `8ead8ddb75d93c22b1281901ae09fad975c8c2302480393480d116f8cbb990b1`. Do not insert a copyright holder into the license text; `NOTICE.md` carries the Fylkren-specific notice.
2. Current-tree secret/history scanning uses `bash tools/security/verify-repository-safety.sh --history` and targeted filename/content review. A scanner result is evidence, not proof that all sensitive material is absent.
3. **Resolved for the publishable repository on 2026-09-27:** the repository was recreated from one clean root containing the reviewed current tree. The former private development repository, including old Dependabot/PR refs and `tools/issue-offline-license.mjs`, was renamed and archived privately instead of being made public or hidden behind a force-pushed branch. A verified local bundle was also created before the transition. Production license issuance remains solely in the separate private `thunold-olsen-licensing` repository. The clean root removes the old source and prior license files from the publishable Git object graph; it does not retroactively alter legal grants made through any earlier distribution, which still requires legal review.
4. Example configuration and security scripts were checked for deployment-specific defaults; public examples use `example.invalid` and explicit targets. Repeat a full current-tree and reachable-history review for credentials, customer information, real hostnames/addresses, databases, private keys, backups and build artifacts immediately before opening.
5. **Blocker:** confidential security-reporting channel, supported-version policy and GitHub settings must be set before opening; `SECURITY.md` currently records this requirement without inventing an address.
6. **Blocker:** verify copyright chain of title, PolyForm licensing implications for existing distributions/history, all third-party license notices and the final brand policy with qualified counsel. Confirm no vendor-private material is embedded in distributable containers or tracked files.
7. **Blocker:** final 1.0 functional, integration, security and edition-transition acceptance is not complete. A synthetic pre-signed fixture is not a production issuer test. Test real license issuance/rotation in a private controlled environment, including live expiry and safe downgrade, without bringing signing material into this repository.

## Release checklist

- [ ] Legal and copyright review approves source license, prior history treatment, notice and trademark policy.
- [x] Final public Git history contains no commercial issuer implementation or sensitive material; private development provenance was retained separately and is not part of the publishable repository.
- [ ] Security contact/private reporting and supported-version policy are published.
- [ ] Third-party notices and dependency/license scan are reviewed.
- [ ] Repository safety, docs, builds and isolated E2E checks pass on the exact release candidate.
- [ ] Final Community/Enterprise acceptance and independent security verification are evidenced.
- [ ] GitHub description/topics, issue templates, branch protection and visibility are reviewed by the owner.

Publication must remain a separate, explicit action after these checks; a private push or passing test does not satisfy this gate.
