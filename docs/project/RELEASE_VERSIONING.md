# Release versioning and update discovery

`VERSION` is the authoritative human-readable Fylkren version. `Directory.Build.props` and the version displayed at the top of `README.md` must contain the same value. Run `pnpm check:version` whenever the version changes.

Fylkren follows Semantic Versioning as `MAJOR.MINOR.PATCH`:

- `MAJOR` changes when a supported contract or upgrade boundary is intentionally incompatible.
- `MINOR` changes when compatible functionality is added.
- `PATCH` changes for compatible corrections and security updates.
- Pre-release suffixes such as `-dev.1`, `-alpha.1` or `-rc.1` identify builds that are not stable public releases.

The current `0.x` line is private pre-release development. The first public release will be `1.0.0`; durable public release history begins at the `v1.0.0` heading in `CHANGELOG.md`. Earlier engineering history remains available in Git and the dated test records, but it is not presented as a supported public release series.

## Public release procedure

For every public release from `v1.0.0` onward:

1. Set `VERSION` and `Directory.Build.props` to the final version and update the README version marker.
2. Move the relevant `Unreleased` entries in `CHANGELOG.md` beneath a dated version heading.
3. Complete the release acceptance and security gates against the exact commit.
4. Create an annotated, signed Git tag named `vMAJOR.MINOR.PATCH` on that commit.
5. Publish a GitHub Release from the tag with the changelog entry, upgrade notes, artifact digests and any security notes.
6. Do not move or recreate a published release tag. Corrections receive a new patch version.

GitHub Releases are the update-notification channel; Fylkren does not contact a vendor service or require Internet access. After the repository is public, users can select **Watch → Custom → Releases** on GitHub or subscribe to the [release Atom feed](https://github.com/mfuryto/fylkren/releases.atom). Operators of isolated installations can compare their authenticated Fylkren version with a release announcement from an approved connected workstation before transferring an update through their controlled process.

Source commits, branch names, Docker image timestamps and the `latest` tag are not release identifiers. A build is an official public release only when its commit, signed version tag, GitHub Release and documented artifact digests agree.
