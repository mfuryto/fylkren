# Release versioning and update discovery

`VERSION` is the authoritative human-readable Fylkren version. `Directory.Build.props` and the version displayed at the top of `README.md` must contain the same value. Run `pnpm check:version` whenever the version changes.

Fylkren follows Semantic Versioning as `MAJOR.MINOR.PATCH`:

- `MAJOR` changes when a supported contract or upgrade boundary is intentionally incompatible.
- `MINOR` changes when compatible functionality is added.
- `PATCH` changes for compatible corrections and security updates.
- Pre-release suffixes such as `-dev.1`, `-alpha.1` or `-rc.1` identify builds that are not stable public releases.

The stable release line begins with `1.0.0`; durable public release history begins at the `v1.0.0` heading in `CHANGELOG.md`. Earlier engineering history remains available in Git and dated test records, but it is not a supported release series.

## Version 1 staging and promotion gate

Before the first `1.0.0` release candidate, repository development changes from direct pre-release work on `main` to a gated promotion model:

1. `staging` is the integration branch. Product changes are committed there or promoted there from short-lived owner-controlled branches.
2. Every `staging` commit must pass repository safety, documentation, language-pack completeness, version consistency, API build, web typecheck/build/unit tests, isolated edition E2E tests and the applicable security suites.
3. The exact tested commit is built once as an immutable release candidate, identified by its full Git commit and artifact digests. Generate CycloneDX SBOMs for all five immutable runtime image IDs and source dependencies with the maintained candidate command, retain the resulting manifest/SBOM hashes with release evidence, and deploy those same images to the controlled staging environment. The SBOM tool also accepts repeated `--image ROLE=REFERENCE` arguments for a separately prepared image set.
4. Staging acceptance covers installation and upgrade from the latest supported release, database migrations with retained data, backup/restore, Community and Enterprise behavior, configured identity providers, federation where applicable, browser workflows and operational health reporting.
5. Failed checks or staging findings are corrected on `staging` and restart the gate. A failing candidate is never patched directly on `main`.
6. After recorded acceptance, the exact accepted commit is fast-forwarded to `main`. Promotion must not rebuild, amend, squash or otherwise create a different source commit.
7. Public release tags and artifacts are created from the accepted `main` commit only after the checks below also pass.

At this gate, GitHub rules protect both branches. `main` rejects deletion, force-push, direct development changes and promotion without the required checks; updates are restricted to the repository owner or narrowly scoped release automation. `staging` rejects deletion and force-push and requires the automated integration checks. Required workflows use only explicitly allowed actions pinned to full commit SHAs, and their default token remains read-only unless one documented release step requires narrower write access.

This model does not accept public pull requests. GitHub does not provide a switch to remove that tab from a public repository, so no workflow or dependency automation creates or processes pull requests and unsolicited submissions are closed. Issues remain available for non-confidential reports. The protected promotion path is an owner-controlled release operation, not an open contribution workflow.

## Candidate identity and immutable promotion

The product version and candidate identity are deliberately separate at the final gate. Before building the first candidate, set `VERSION`, `Directory.Build.props`, README and the changelog to the intended stable product version, for example `1.0.0`. The candidate label `rc.1` is recorded in the candidate manifest, OCI reference label and image tag as `1.0.0-rc.1`; it does not change the version embedded in the product.

This separation allows the accepted image ID and digest to be retagged as `1.0.0` without rebuilding. A failed candidate is discarded. Corrections produce a new source commit and `rc.2`, still with the intended embedded `1.0.0` version. No candidate tag is a public stable release.

The maintained local and air-gapped-capable flow is:

```bash
pnpm run release:set-version 1.0.0
# Prepare the dated 1.0.0 heading in CHANGELOG.md, commit on staging, then:
pnpm run release:verify:candidate -- --candidate rc.1
```

The verifier requires the `staging` branch, a clean worktree, the stable product version and matching changelog heading. It installs pnpm dependencies from the committed lockfile, restores every .NET project in locked mode, runs the single source, build, test and integration sequence, then builds API, web, Data Protection initialization, PostgreSQL and internal-TLS initialization images once. It applies version/commit OCI labels, generates image/source CycloneDX SBOMs and records every image ID and SBOM hash under the ignored `output/release/1.0.0-rc.1/` directory.

An isolated build network must provide approved mirrors or preloaded caches for the pnpm and NuGet lockfiles, the pinned container base images, and a current Trivy vulnerability database. These are build-time services; an installed Fylkren runtime does not depend on them.

After acceptance, fast-forward the same commit to `main`, create and verify the signed `v1.0.0` tag, then verify and locally retag the exact candidate image IDs:

```bash
pnpm run release:promote -- --manifest output/release/1.0.0-rc.1/candidate.json
```

Publishing the verified stable tags, GitHub Release and artifacts remains a separately authorized release action. The promotion command never rebuilds an image and does not publish externally.

## Public release procedure

For every public release from `v1.0.0` onward:

1. Prepare the intended stable product version and changelog on `staging` with `pnpm run release:set-version MAJOR.MINOR.PATCH`, and move the relevant `Unreleased` entries beneath a dated version heading.
2. Complete the automated, staging acceptance and security gates against that exact commit and record its commit ID, artifact digests and validated runtime-image CycloneDX SBOM manifest.
3. Fast-forward the accepted commit to protected `main` without rebuilding or changing it.
4. Create an annotated, signed Git tag named `vMAJOR.MINOR.PATCH` on that commit.
5. Verify that the accepted candidate image IDs match the manifest, retag those exact IDs with the stable version without rebuilding, and publish a GitHub Release from the tag with the changelog entry, upgrade notes, artifact digests, SBOMs and any security notes.
6. Do not move or recreate a published release tag. Corrections go through `staging` again and receive a new patch version.

GitHub Releases are the update-notification channel; Fylkren does not contact a vendor service or require Internet access. After the repository is public, users can select **Watch → Custom → Releases** on GitHub or subscribe to the [release Atom feed](https://github.com/mfuryto/fylkren/releases.atom). Operators of isolated installations can compare their authenticated Fylkren version with a release announcement from an approved connected workstation before transferring an update through their controlled process.

Source commits, branch names, Docker image timestamps and the `latest` tag are not release identifiers. A build is an official public release only when its commit, signed version tag, GitHub Release and documented artifact digests agree.
