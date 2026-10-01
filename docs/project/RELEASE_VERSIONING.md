# Release versioning and update discovery

`VERSION` is the authoritative human-readable Fylkren version. `Directory.Build.props` and the version displayed at the top of `README.md` must contain the same value. Run `pnpm check:version` whenever the version changes.

Fylkren follows Semantic Versioning as `MAJOR.MINOR.PATCH`:

- `MAJOR` changes when a supported contract or upgrade boundary is intentionally incompatible.
- `MINOR` changes when compatible functionality is added.
- `PATCH` changes for compatible corrections and security updates.
- Pre-release suffixes such as `-dev.1`, `-alpha.1` or `-rc.1` identify builds that are not stable public releases.

The current `0.x` line is private pre-release development. The first public release will be `1.0.0`; durable public release history begins at the `v1.0.0` heading in `CHANGELOG.md`. Earlier engineering history remains available in Git and the dated test records, but it is not presented as a supported public release series.

## Version 1 staging and promotion gate

Before the first `1.0.0` release candidate, repository development changes from direct pre-release work on `main` to a gated promotion model:

1. `staging` is the integration branch. Product changes are committed there or promoted there from short-lived owner-controlled branches.
2. Every `staging` commit must pass repository safety, documentation, language-pack completeness, version consistency, API build, web typecheck/build/unit tests, isolated edition E2E tests and the applicable security suites.
3. The exact tested commit is built once as an immutable release candidate, identified by its full Git commit and artifact digests, and deployed to the controlled staging environment.
4. Staging acceptance covers installation and upgrade from the latest supported release, database migrations with retained data, backup/restore, Community and Enterprise behavior, configured identity providers, federation where applicable, browser workflows and operational health reporting.
5. Failed checks or staging findings are corrected on `staging` and restart the gate. A failing candidate is never patched directly on `main`.
6. After recorded acceptance, the exact accepted commit is fast-forwarded to `main`. Promotion must not rebuild, amend, squash or otherwise create a different source commit.
7. Public release tags and artifacts are created from the accepted `main` commit only after the checks below also pass.

At this gate, GitHub rules protect both branches. `main` rejects deletion, force-push, direct development changes and promotion without the required checks; updates are restricted to the repository owner or narrowly scoped release automation. `staging` rejects deletion and force-push and requires the automated integration checks. Required workflows use only explicitly allowed actions pinned to full commit SHAs, and their default token remains read-only unless one documented release step requires narrower write access.

This model does not require accepting public pull requests. External pull requests remain disabled; issues may still be used for non-confidential reports. The protected promotion path is an owner-controlled release operation, not an open contribution workflow.

## Public release procedure

For every public release from `v1.0.0` onward:

1. Prepare the version and changelog on `staging`: set `VERSION` and `Directory.Build.props`, update the README marker and move the relevant `Unreleased` entries beneath a dated version heading.
2. Complete the automated, staging acceptance and security gates against that exact commit and record its commit ID and artifact digests.
3. Fast-forward the accepted commit to protected `main` without rebuilding or changing it.
4. Create an annotated, signed Git tag named `vMAJOR.MINOR.PATCH` on that commit.
5. Publish a GitHub Release from the tag with the changelog entry, upgrade notes, artifact digests and any security notes.
6. Do not move or recreate a published release tag. Corrections go through `staging` again and receive a new patch version.

GitHub Releases are the update-notification channel; Fylkren does not contact a vendor service or require Internet access. After the repository is public, users can select **Watch → Custom → Releases** on GitHub or subscribe to the [release Atom feed](https://github.com/mfuryto/fylkren/releases.atom). Operators of isolated installations can compare their authenticated Fylkren version with a release announcement from an approved connected workstation before transferring an update through their controlled process.

Source commits, branch names, Docker image timestamps and the `latest` tag are not release identifiers. A build is an official public release only when its commit, signed version tag, GitHub Release and documented artifact digests agree.
