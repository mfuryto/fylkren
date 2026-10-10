# GitHub repository security and operations

This runbook defines the GitHub controls for `mfuryto/fylkren`. It complements
the [release-readiness gate](../project/PUBLICATION_READINESS.md) and does not
authorize visibility changes, release publication or production deployment.

## Tracked controls

The repository carries the configuration that can be reviewed with source:

- `.github/workflows/quality.yml` verifies source, documentation, localization,
  builds and maintained tests on `staging` and `main`;
- `.github/workflows/codeql.yml` analyzes C# and JavaScript/TypeScript on pushes,
  a weekly schedule and manual dispatch;
- `.github/workflows/pages.yml` builds the static demo and deploys it only from
  `main`;
- issue forms, `SECURITY.md`, `SUPPORT.md`, `CONTRIBUTING.md` and `CODEOWNERS`
  define public intake and ownership.

Every external Action reference is pinned to a complete commit SHA. Workflow
tokens default to read-only, checkout credentials are not persisted, concurrent
obsolete quality runs are cancelled, and only the Pages deployment job receives
the two write permissions it needs.

## Apply and audit GitHub settings

Work from the exact, clean release commit. The repository owner changes
visibility as a separate deliberate GitHub action. Then run:

```bash
bash tools/security/harden-public-github-repository.sh \
  --repo mfuryto/fylkren \
  --apply

bash tools/security/harden-public-github-repository.sh \
  --repo mfuryto/fylkren
```

The apply command first scans the current tree and reachable history. It never
changes visibility, pushes code, creates a tag or publishes a release. It applies
and verifies:

- the exact description, Pages homepage and twenty search topics;
- Issues enabled, unused wiki/projects/discussions disabled and maintained issue
  labels;
- Advanced Security, secret scanning, push protection, vulnerability alerts and
  private vulnerability reporting, with PR-based automated fixes disabled;
- GitHub-owned Actions only, restricted default token permissions and no
  workflow approval of pull requests;
- workflow-based Pages with HTTPS;
- linear `staging` and `main` history with deletion and force-push disabled; and
- required Quality and CodeQL checks on `main`.

`staging` accepts owner-controlled integration pushes and runs all maintained
checks. `main` accepts only an exact commit that already has the required checks,
which supports the documented fast-forward promotion without rebuilding. No
workflow, template or dependency automation creates or processes pull requests.
GitHub does not provide a switch to remove the Pull requests tab from a public
repository, so any unsolicited pull request is closed without review.

## Activation sequence

1. Complete the release-readiness checklist and pass a new full candidate on the
   exact `staging` commit.
2. Change visibility through GitHub and immediately apply and audit the settings
   above.
3. Run **Quality** and **CodeQL** manually on `staging` once Actions is enabled;
   inspect the exact commit, permissions and logs.
4. Confirm **Security → Report a vulnerability** is visible and subscribe the
   maintainer account to security-alert notifications.
5. Upload `apps/demo/public/fylkren-social-preview.png` under **Settings →
   General → Social preview**.
6. Promote the already checked commit to `main`. The Pages workflow then builds
   and deploys `apps/demo`; inspect the deployment environment and live site.
7. Create the signed version tag and matching GitHub Release only after commit,
   image IDs, digests and SBOMs match the accepted candidate manifest.

## Ongoing operation

- Review dependency and vulnerability alerts at least weekly. Apply updates on
  `staging` through the ordinary owner-controlled release process; do not enable
  automated update or remediation pull requests.
- Treat secret scanning as detection rather than proof. Retain the local current-
  tree and reachable-history release scan.
- Triage private vulnerability reports inside GitHub Security Advisories. Keep
  proof, remediation discussion and disclosure timing private until a correction
  and operator guidance are ready.
- Review CodeQL and Dependabot alerts at least weekly and before every release.
- Re-run the audit after ownership, account plan, Actions, Pages, branch rules,
  deploy keys or visibility changes.
- Keep production license issuance, signing keys, customer records and commercial
  data outside this repository.
- Verify account MFA, recovery methods, deploy-key custody and tag-signing-key
  custody separately; repository APIs cannot establish those account controls.
- Keep server checkout keys read-only. Rotate a deploy key immediately when its
  host or custody is in doubt.
