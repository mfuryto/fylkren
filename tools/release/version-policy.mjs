export const semanticVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9A-Za-z][0-9A-Za-z-]*)(?:\.(?:0|[1-9A-Za-z][0-9A-Za-z-]*))*))?$/;

export function parseVersion(value) {
  const match = semanticVersionPattern.exec(value);
  if (!match) throw new Error(`${value} is not a valid Semantic Version.`);
  return {
    value,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

export function compareCore(left, right) {
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  return 0;
}

export function validateTransition(currentValue, nextValue) {
  const current = parseVersion(currentValue);
  const next = parseVersion(nextValue);
  const coreComparison = compareCore(current, next);
  if (coreComparison > 0) throw new Error(`Version regression from ${currentValue} to ${nextValue} is not allowed.`);
  if (coreComparison === 0 && current.prerelease === null)
    throw new Error(`A stable version ${currentValue} cannot be replaced without increasing MAJOR, MINOR or PATCH.`);
  if (coreComparison === 0 && current.prerelease === next.prerelease)
    throw new Error(`Version is already ${nextValue}.`);
  return next;
}

export function isReleaseCandidate(value) {
  return /^\d+\.\d+\.\d+-rc\.[1-9]\d*$/.test(value);
}

export function isCandidateLabel(value) {
  return /^rc\.[1-9]\d*$/.test(value);
}
