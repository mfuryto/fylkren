#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
git_dir=".git"
[[ -f .git/HEAD ]] || git_dir=".git-local"
git_repo=(git --git-dir="$git_dir" --work-tree=.)
failures=0

fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }
pass() { printf 'PASS  %s\n' "$1"; }

tracked_forbidden="$("${git_repo[@]}" ls-files --cached --others --exclude-standard | grep -E '(^|/)(\.env($|\.)|e2e-test-credentials\.local|node_modules|bin|obj|dist|output|TestResults|playwright-report|test-results)(/|$)' || true)"
if [[ -n "$tracked_forbidden" ]]; then
  printf '%s\n' "$tracked_forbidden"
  fail "local, generated, credential, or test-output artifacts are tracked"
else
  pass "no forbidden local or generated artifacts are tracked"
fi

oversized="$("${git_repo[@]}" ls-files --cached --others --exclude-standard -z | while IFS= read -r -d '' path; do
  [[ -f "$path" ]] && stat --printf '%s\t%n\n' "$path"
done | awk '$1 > 1048576')"
if [[ -n "$oversized" ]]; then
  printf '%s\n' "$oversized"
  fail "tracked files larger than 1 MiB require an explicit public-repository review"
else
  pass "no tracked file exceeds 1 MiB"
fi

local_paths="$("${git_repo[@]}" grep -nE '(/home/[^/[:space:]]+|/Users/[^/[:space:]]+|[A-Za-z]:\\\\Users\\\\[^\\[:space:]]+)' -- ':!tools/security/verify-repository-safety.sh' || true)"
if [[ -n "$local_paths" ]]; then
  printf '%s\n' "$local_paths"
  fail "tracked content contains workstation-specific absolute paths"
else
  pass "no workstation-specific absolute paths were found"
fi

if [[ -f tools/issue-offline-license.mjs ]]; then
  fail "license-generation tooling is present in the publishable tree"
else
  pass "no license-generation CLI is present in the current tree"
fi

if [[ "${1:-}" == "--history" ]]; then
  if "${git_repo[@]}" rev-list --objects --all | grep -E '^[0-9a-f]+[[:space:]]+tools/issue-offline-license\.mjs$' >/dev/null; then
    fail "reachable Git history still contains the offline license issuer; review history before publication"
  else
    pass "no offline license issuer was found in reachable Git history"
  fi
fi

if command -v trivy >/dev/null 2>&1; then
  if trivy fs --quiet --scanners secret --exit-code 1 \
      --skip-dirs node_modules --skip-dirs apps/api/bin --skip-dirs apps/api/obj \
      --skip-dirs apps/web/dist .; then
    pass "Trivy found no secrets in the current repository content"
  else
    fail "Trivy reported a potential secret"
  fi
  if [[ "${1:-}" == "--history" ]]; then
    history_dir="$(mktemp -d)"
    trap 'rm -rf "$history_dir"' EXIT
    "${git_repo[@]}" log --all --format=fuller --patch --binary > "$history_dir/history.txt"
    if trivy fs --quiet --scanners secret --exit-code 1 "$history_dir"; then
      pass "Trivy found no secrets in reachable Git history"
    else
      fail "Trivy reported a potential secret in reachable Git history"
    fi
  fi
else
  printf 'SKIP  Trivy is not installed; run this gate in the release environment.\n'
fi

printf '\nResult: %d repository-safety failure(s)\n' "$failures"
(( failures == 0 ))
