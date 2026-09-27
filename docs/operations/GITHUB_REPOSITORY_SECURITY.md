# GitHub repository security

This runbook defines the repository controls required when `mfuryto/fylkren`
is eventually made public. It does not authorize publication. Legal review,
release acceptance, security reporting and every other gate in
[publication readiness](../project/PUBLICATION_READINESS.md) must first be
complete.

## Current private state

The publishable repository is private. Dependabot vulnerability alerts and
automated security fixes are enabled. Squash is the only merge method, merged
branches are deleted, web commits require sign-off, and GitHub Actions is
disabled because there are no reviewed workflows. `CODEOWNERS` assigns the
repository to `@mfuryto`.

The current personal private-repository plan does not expose branch protection,
GitHub secret scanning or push protection. These are therefore publication
controls, not controls that can be truthfully claimed today. The audit command
shows their actual API state:

```bash
bash tools/security/harden-public-github-repository.sh --repo mfuryto/fylkren
```

An audit can report unavailable controls while the repository is private. It
does not change settings or visibility.

## Publication-day sequence

1. Complete and record every publication-readiness gate. Work from the exact,
   clean release commit and run:

   ```bash
   bash tools/security/verify-repository-safety.sh --history
   ```
2. Have the repository owner make the repository public as a separate,
   deliberate GitHub action. Do not combine visibility changes with automation.
3. Immediately apply and verify the public-repository controls:

   ```bash
   bash tools/security/harden-public-github-repository.sh \
     --repo mfuryto/fylkren \
     --apply
   ```

4. Run the same command without `--apply` and inspect GitHub's Security and
   Branches settings. Do not announce the repository until the verification is
   clean.

The apply command deliberately refuses to operate while the repository is
private and never changes visibility. It enables GitHub Advanced Security,
secret scanning, push protection, the dependency/vulnerability alerts used by
Dependabot, automated security fixes and private vulnerability reporting. It
protects `main` against direct pushes—including administrator bypass—requires a
pull request, linear history and resolved conversations, and prohibits force
pushes and deletion.

The initial single-owner policy requires a pull request but zero approving
reviews. A repository owner cannot approve their own pull request, so requiring
one approval would lock out the only maintainer. When another trusted maintainer
is established, increase the count to one and require code-owner review.

## GitHub Actions and status checks

Actions remain disabled until maintained workflows exist. Before enabling
Actions, review every workflow, pin each third-party action to a complete commit
SHA, set the default workflow token to read-only, prevent Actions from creating
or approving pull requests, and explicitly grant only the permissions each job
needs. Then add the stable security and test jobs as required status checks on
`main`; never require a check that cannot run for the repository's normal pull
requests.

## Operational cautions

- Keep the production license issuer, signing keys, customer records and
  commercial data exclusively in the separate private
  `thunold-olsen-licensing` repository.
- Treat secret scanning as detection, not proof that history is safe. Retain the
  local and independent review gates.
- Verify account-level two-factor authentication, recovery methods, deploy-key
  custody and signing-key custody separately; repository APIs do not prove all
  account controls.
- Rotate a deploy key immediately if its host or custody is in doubt. The
  production checkout key should remain read-only.
- Re-run the audit after ownership, plan, visibility, branch rules, Actions or
  deploy keys change.
