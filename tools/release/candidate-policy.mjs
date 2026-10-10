import { isCandidateLabel, parseVersion } from './version-policy.mjs';

export function validateCandidateState({ version, candidate, branch, status, changelog }) {
  const parsed = parseVersion(version);
  if (parsed.prerelease !== null) throw new Error(`Candidate product version must be the intended stable MAJOR.MINOR.PATCH value, received ${version}.`);
  if (!isCandidateLabel(candidate)) throw new Error(`Candidate label must use rc.N, received ${candidate}.`);
  if (branch !== 'staging') throw new Error(`Release candidates must be built from staging, received ${branch}.`);
  if (status.trim()) throw new Error('Release candidates require a clean Git worktree and index.');
  const stableVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  const escapedVersion = stableVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`^## ${escapedVersion}(?: |$)`, 'm').test(changelog))
    throw new Error(`CHANGELOG.md must contain a prepared ${stableVersion} release heading before candidate construction.`);
  return { stableVersion, candidateVersion: `${version}-${candidate}` };
}
