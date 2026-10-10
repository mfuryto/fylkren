# Public repository readiness — pre-1.0

Status: **not ready to make public**. This is a gate and evidence record, not permission to change GitHub visibility or rewrite history.

## Intended public surface

- The main `mfuryto/fylkren` repository contains the complete distributable Community/Enterprise-capable product, tests and documentation. It is source-available under the Fylkren Source Available License 1.0 in `LICENSE`, which permits compliant redistribution while prohibiting Enterprise circumvention and misrepresentation of product authorship.
- THUNOLD-OLSEN (Norwegian organization number 996871126) is identified in `NOTICE.md` and `TRADEMARKS.md`; legal ownership and trademark wording still require review.
- One codebase, one schema, one upgrade path, and the same API/web images for both editions. The official runtime enforces Enterprise entitlements server-side; Community works offline with no entitlement file.
- Only verification code and public keys belong in this repository. The bundled production public key is not a secret. Production license signing, private keys, customer/commercial records and payment logic belong in the separate private `thunold-olsen-licensing` repository. The documented signed JSON envelope is the trust boundary; compare the bundled key fingerprint with the issuer before public release.
- The version and release process is defined in [Release versioning and update discovery](RELEASE_VERSIONING.md). Before publication, replace the pre-1.0 development identifier with `1.0.0`, create the signed `v1.0.0` tag only after acceptance, and publish one matching GitHub Release with artifact digests.
- GitHub Issues may accept public bugs, feature requests and discussion after opening. There is no invitation for external patches or pull requests. Confidential vulnerability reports require a private channel first.

## GitHub presentation

**Description:** Self-hosted operational task management for hierarchical assignments, planning, execution and reporting. Source-available; Community and offline-licensed Enterprise.

**Topics:** `operational-task-management`, `mission-management`, `workflow-management`, `operations-management`, `preparedness`, `emergency-management`, `public-sector`, `self-hosted`, `offline-first`, `air-gapped`, `docker`, `dotnet`, `react`, `postgresql`, `source-available`, `enterprise-software`, `federation`, `identity-management`, `audit-log`, `reporting`.

The description and topics above were applied to the private GitHub repository
on 2026-09-27. They do not imply public visibility, enabled Discussions or a
configured confidential-security channel. Confirm all presentation and security
settings again at the release gate.

## Current checks and findings

GitHub security settings were verified and tightened on 2026-09-27 while the repository remained private. Only `mfuryto` has repository access. Pull requests are disabled at repository level. Dependency-graph vulnerability alerts remain enabled; Dependabot version-update configuration and PR-based automated security fixes are disabled. GitHub Actions is disabled because no maintained workflows exist; if workflows are introduced, re-enable only selected actions pinned to complete commit SHAs and keep the default workflow token read-only. Merge commits and rebase merges are disabled, squash is the only configured merge method if pull requests are ever re-enabled, completed branches are deleted automatically, and web-created commits require sign-off.

The current personal private-repository plan does not provide branch protection, repository rulesets, GitHub secret scanning or push protection. `main` therefore remains technically writable without a protected pull request. The [GitHub repository security runbook](../operations/GITHUB_REPOSITORY_SECURITY.md) contains a fail-closed audit/apply command for enabling and verifying those controls immediately after a separately approved visibility change; the command never makes the repository public. The personal-repository API also does not allow changing the reported private-fork setting. There are no repository webhooks, Actions secrets or deployment environments. One read-only deploy key is used for server checkout and one repository-scoped write deploy key is the current authenticated development push path; neither should be removed blindly. Rotate either key immediately if its host or custody is in doubt. The authenticated API could not confirm account-level two-factor authentication, and existing commits are not cryptographically signed; both remain owner-account controls to verify.

1. The current `LICENSE` implements the chosen policy directly: redistribution remains permitted, while Enterprise capabilities require a valid entitlement, practical Enterprise bypasses may not be created or distributed, and Fylkren may not be passed off as an independently created product. The text is project-specific and must not be described as a PolyForm license. Record its final legally reviewed hash at the public-release gate.
2. Current-tree secret/history scanning uses `bash tools/security/verify-repository-safety.sh --history` and targeted filename/content review. A scanner result is evidence, not proof that all sensitive material is absent.
3. **Resolved for the publishable repository on 2026-09-27:** the repository was recreated from one clean root containing the reviewed current tree. The former private development repository, including old Dependabot/PR refs and `tools/issue-offline-license.mjs`, was renamed and archived privately instead of being made public or hidden behind a force-pushed branch. A verified local bundle was also created before the transition. Production license issuance remains solely in the separate private `thunold-olsen-licensing` repository. The clean root removes the old source and prior license files from the publishable Git object graph; it does not retroactively alter legal grants made through any earlier distribution, which still requires legal review.
4. Example configuration and security scripts were checked for deployment-specific defaults; public examples use `example.invalid` and explicit targets. Repeat a full current-tree and reachable-history review for credentials, customer information, real hostnames/addresses, databases, private keys, backups and build artifacts immediately before opening.
5. **Blocker:** confidential security-reporting channel, supported-version policy and GitHub settings must be set before opening; `SECURITY.md` currently records this requirement without inventing an address.
6. **Blocker:** the product-policy choice is now encoded in the [Fylkren license](../../LICENSE): compliant redistribution is permitted, while Enterprise circumvention and passing the product off as independently created are prohibited. Qualified counsel must verify that project-specific text and matching customer/commercial terms, plus copyright chain of title, the earlier MPL-2.0 history, all third-party notices and the final brand policy. Confirm no vendor-private material is embedded in distributable containers or tracked files. Public release is blocked until that verification confirms the repository, order flow and product claims are mutually consistent.
7. **Blocker:** final 1.0 functional, integration, security and edition-transition acceptance is not complete. A synthetic pre-signed fixture is not a production issuer test. Test real license issuance/rotation in a private controlled environment, including live expiry and safe downgrade, without bringing signing material into this repository.

## Release checklist

The maintained `pnpm run release:verify:candidate -- --candidate rc.N` command is the single local candidate gate. It records locked dependency restoration, checks, image IDs, OCI source/version labels and CycloneDX evidence. Passing it does not satisfy the external, legal, GitHub-control or target-deployment items below.

- [ ] Legal and copyright review verifies the Fylkren Source Available License 1.0, including permitted redistribution, Enterprise-circumvention restriction, attribution/product-identity rule, competitive-use boundary, prior history treatment, notice and trademark policy.
- [ ] Enterprise customer/commercial terms define installation scope, term, transfer, renewal, entitlement bypass and modified-build treatment, and match the order flow and signed license payload.
- [x] Final public Git history contains no commercial issuer implementation or sensitive material; private development provenance was retained separately and is not part of the publishable repository.
- [ ] Security contact/private reporting and supported-version policy are published.
- [ ] Third-party notices, dependency/license scan and the CycloneDX SBOMs for all five immutable runtime images are reviewed.
- [ ] Repository safety, docs, builds and isolated E2E checks pass on the exact release candidate.
- [ ] The `staging` branch, immutable staging deployment and recorded promotion gate in `RELEASE_VERSIONING.md` are operational; the accepted commit is promoted unchanged to `main`.
- [ ] GitHub rules protect `staging` and `main`, require the maintained status checks, prevent deletion/force-push and restrict `main` updates to the owner or narrowly scoped release automation without enabling public pull requests.
- [ ] `VERSION`, application version, `CHANGELOG.md`, signed `v1.0.0` tag, GitHub Release and published artifact digests identify the same accepted commit.
- [ ] Final Community/Enterprise acceptance and independent security verification are evidenced.
- [ ] GitHub description/topics, issue templates, branch protection and visibility are reviewed by the owner.

Publication must remain a separate, explicit action after these checks; a private push or passing test does not satisfy this gate.
