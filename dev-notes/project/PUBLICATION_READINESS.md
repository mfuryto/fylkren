# Repository and release readiness

Status: **public repository and `v1.0.0` release activated on 2026-10-10.** This record preserves the release evidence and the remaining manual presentation step. Publication does not by itself qualify a customer production deployment.

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

The fail-closed [GitHub security runbook](../operations/GITHUB_REPOSITORY_SECURITY.md) and `tools/security/harden-public-github-repository.sh` apply and audit the matching repository settings. The script disables Pull requests, enables only GitHub-owned Actions, keeps default workflow permissions read-only, prevents workflow approval of pull requests, enables secret scanning, push protection, vulnerability and malware alerts and private vulnerability reporting, disables PR-based automated security fixes, and protects `main` and `staging` against destructive history changes. GitHub Advanced Security is available automatically for the public repository and is therefore audited rather than configured. The script also applies the exact description, homepage, topics and issue labels and configures Pages for workflow deployment. It never changes visibility or publishes a release.

## Release state

The complete `1.0.0-rc.2` candidate gate passed all 31 source, security, functional, identity, browser, workload, recovery, image and SBOM checks on commit `2b78e2e4cfaa61a7dc27e3b814c999709e467474`. The SSH-signed annotated `v1.0.0` tag identifies that exact source. Its five verified image IDs were promoted to stable `1.0.0` tags without rebuilding, and the candidate record plus CycloneDX inventories are attached to the [GitHub Release](https://github.com/mfuryto/fylkren/releases/tag/v1.0.0). The later `9eb7fbf19f1d03111dc56b63d0da1d70285203a2` maintenance commit fixes only the public GitHub workflows and hardening audit; Quality and both CodeQL analyses passed on `main` for that revision.

## Release and activation checklist

- [x] Repository owner approved public distribution under the reviewed Fylkren Source Available License 1.0, trademark policy and documented third-party obligations.
- [x] Current public Git history excludes commercial issuer implementation, private signing material, customer information and old private development history.
- [x] Security policy, confidential reporting instructions and supported-version policy are present.
- [x] README, documentation, issue forms, support guidance, repository metadata, topics and social-preview asset are prepared.
- [x] Pull requests are disabled; Quality, CodeQL and Pages automation use least-privilege permissions and immutable Action references with no PR automation.
- [x] ASVS 5.0 Level 2 has one authoritative 253-row matrix: 199 Passed and 54 Not applicable, with no unfinished row.
- [x] `1.0.0-rc.2` passed all 31 maintained checks against exact clean commit `2b78e2e4cfaa61a7dc27e3b814c999709e467474`; image IDs and SBOM evidence were reviewed and retained.
- [x] The owner explicitly authorized publication and the repository is public.
- [x] The hardening configuration and audit were applied; Security, Actions, Pages and branch-protection state match the runbook.
- [ ] Upload `apps/demo/public/fylkren-social-preview.png` under **Settings → General → Social preview**; GitHub has no repository-file setting that applies this image automatically.
- [x] Quality and both CodeQL analyses passed on accepted `staging` and the activated `main` revision.
- [x] GitHub private vulnerability reporting plus Dependabot vulnerability and malware alerts are enabled; confidential reports use the repository's **Report a vulnerability** flow.
- [x] `https://mfuryto.github.io/fylkren/` serves the synthetic demo over HTTPS with canonical, Open Graph, robots and sitemap metadata.
- [x] The accepted source was fast-forwarded to `main`; the SSH-signed `v1.0.0` tag, no-rebuild image promotion and matching GitHub Release with candidate and SBOM evidence are published.

Target deployments retain their own acceptance requirements: TLS/proxy behavior, identity-provider compatibility, authenticator behavior, backup/key custody and restore rehearsal, time synchronization, host access, capacity and optional log-forwarding decision. Those customer controls do not belong in repository metadata.
