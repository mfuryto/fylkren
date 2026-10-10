# Repository and release readiness

Status: **repository content prepared; a new release candidate and owner-controlled GitHub activation remain.** This is the release evidence and activation checklist. It does not authorize a visibility change, tag, GitHub Release or production deployment.

## Public product surface

- `mfuryto/fylkren` contains the complete Community/Enterprise-capable product, tests and documentation under the Fylkren Source Available License 1.0.
- Community and Enterprise use one codebase, schema, container set and upgrade path. Enterprise entitlements are enforced by the API; Community operates offline without an entitlement file.
- Production license signing, private keys, customer/commercial records and payment logic stay outside this repository. Only public verification material and synthetic signed fixtures are distributable here.
- The maintained Git history was recreated from a reviewed clean root. Current-tree and reachable-history scans remain mandatory for every release candidate.
- `docs/` is customer documentation and is bundled with the matching application. `dev-notes/` contains engineering, test and release evidence and is not bundled.

## GitHub product presentation

**Description:** Self-hosted, multilingual and AI-assisted operational task and mission management for secure, offline and air-gapped organizations.

**Homepage:** `https://mfuryto.github.io/fylkren/`

**Topics:** `self-hosted`, `task-management`, `mission-management`, `operations-management`, `workflow-management`, `risk-management`, `emergency-management`, `preparedness`, `ai-assisted`, `multilingual`, `offline-first`, `air-gapped`, `enterprise-software`, `public-sector`, `docker`, `dotnet`, `react`, `postgresql`, `identity-management`, `federation`.

The README presents multilingual operation, optional local or hosted AI assistance, air-gapped deployment, editions, security, documentation, the live demo and actual product screenshots near the top. The Pages demo has canonical metadata, Open Graph data, structured software metadata, robots and sitemap files. The prepared 1280×640 social image is `apps/demo/public/fylkren-social-preview.png`.

## Repository automation and security

Tracked GitHub configuration now provides:

- structured bug, feature and question forms with confidentiality guidance;
- private-vulnerability-reporting instructions and a supported-version policy;
- a read-only-token quality workflow for source, docs, language, builds and tests;
- CodeQL analysis for C# and JavaScript/TypeScript;
- a `main`-only GitHub Pages build and deployment of the static synthetic demo; and
- full commit-SHA pinning for every external Action.

The fail-closed [GitHub security runbook](../operations/GITHUB_REPOSITORY_SECURITY.md) and `tools/security/harden-public-github-repository.sh` apply and audit the matching repository settings. The script disables Pull requests, enables only GitHub-owned Actions, keeps default workflow permissions read-only, prevents workflow approval of pull requests, enables Advanced Security, secret scanning, push protection, vulnerability alerts and private vulnerability reporting, disables PR-based automated security fixes, and protects `main` and `staging` against destructive history changes. It also applies the exact description, homepage, topics and issue labels and configures Pages for workflow deployment. It never changes visibility or publishes a release.

## Release state

The complete `1.0.0-rc.1` candidate gate passed on commit `dd758e0ee9c8301e1574999bf930f933de9f0dd6`, including 31 source, security, functional, identity, browser, workload, recovery, image and SBOM checks. The GitHub presentation and automation changes are newer source changes. They therefore require a new candidate identity and a complete candidate verification before promotion; the earlier result remains historical evidence for its exact commit.

## Release and activation checklist

- [ ] Qualified legal review confirms the Fylkren Source Available License 1.0, customer/commercial terms, copyright chain, earlier MPL-2.0 history, trademark policy and third-party obligations.
- [x] Current public Git history excludes commercial issuer implementation, private signing material, customer information and old private development history.
- [x] Security policy, confidential reporting instructions and supported-version policy are present.
- [x] README, documentation, issue forms, support guidance, repository metadata, topics and social-preview asset are prepared.
- [x] Pull requests are disabled; Quality, CodeQL and Pages automation use least-privilege permissions and immutable Action references with no PR automation.
- [x] ASVS 5.0 Level 2 has one authoritative 253-row matrix: 199 Passed and 54 Not applicable, with no unfinished row.
- [ ] Run `pnpm run release:verify:candidate -- --candidate rc.2` against the exact clean `staging` commit and review all image/SBOM evidence.
- [ ] The owner explicitly changes repository visibility to public. Keep this separate from every script and release command.
- [ ] Run `bash tools/security/harden-public-github-repository.sh --repo mfuryto/fylkren --apply`, then repeat it without `--apply` and inspect GitHub's Security, Actions, Pages and Branches views.
- [ ] Upload `apps/demo/public/fylkren-social-preview.png` under **Settings → General → Social preview**; GitHub has no repository-file setting that applies this image automatically.
- [ ] Run the Quality and CodeQL workflows on the accepted `staging` commit and verify that the required checks are green.
- [ ] Verify private vulnerability reporting by confirming the **Report a vulnerability** button and maintainer security-alert notifications.
- [ ] Verify `https://mfuryto.github.io/fylkren/`, HTTPS, canonical metadata, synthetic-data notice and links after the first Pages deployment.
- [ ] Fast-forward the exact accepted commit to `main`, create and verify the signed `v1.0.0` tag, promote the exact candidate image IDs without rebuilding, and publish one matching GitHub Release with digests, SBOMs, upgrade and security notes.

Target deployments retain their own acceptance requirements: TLS/proxy behavior, identity-provider compatibility, authenticator behavior, backup/key custody and restore rehearsal, time synchronization, host access, capacity and optional log-forwarding decision. Those customer controls do not belong in repository metadata.
