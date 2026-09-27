#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: tools/security/harden-public-github-repository.sh --repo OWNER/REPO [--apply]

Audits the GitHub controls required before publishing this repository. With
--apply, the script configures the controls, but only after the repository has
already been made public through a separate, explicit owner action. This script
never changes repository visibility.
EOF
}

repo=""
mode="audit"
while (($#)); do
  case "$1" in
    --repo)
      [[ $# -ge 2 ]] || { usage >&2; exit 2; }
      repo="$2"
      shift 2
      ;;
    --apply)
      mode="apply"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

[[ "$repo" =~ ^[^/]+/[^/]+$ ]] || {
  printf 'A repository in OWNER/REPO form is required.\n' >&2
  exit 2
}
command -v gh >/dev/null || { printf 'gh is required.\n' >&2; exit 1; }

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
git_dir=".git"
[[ -f .git/HEAD ]] || git_dir=".git-local"
git_repo=(git --git-dir="$git_dir" --work-tree=.)

api_version_header=(--header 'X-GitHub-Api-Version: 2026-03-10')
visibility="$(gh api "${api_version_header[@]}" "repos/$repo" --jq '.visibility')"
printf 'Repository: %s (%s)\n' "$repo" "$visibility"

if [[ "$mode" == "apply" ]]; then
  [[ "$visibility" == "public" ]] || {
    printf 'Refusing to apply: the repository is not public. Visibility must be changed separately after the publication gate is approved.\n' >&2
    exit 1
  }
  [[ -z "$("${git_repo[@]}" status --porcelain)" ]] || {
    printf 'Refusing to apply from a worktree with uncommitted files.\n' >&2
    exit 1
  }

  bash tools/security/verify-repository-safety.sh --history

  gh api "${api_version_header[@]}" --method PATCH "repos/$repo" --input - <<'JSON'
{
  "allow_merge_commit": false,
  "allow_rebase_merge": false,
  "allow_squash_merge": true,
  "delete_branch_on_merge": true,
  "has_pull_requests": false,
  "web_commit_signoff_required": true,
  "security_and_analysis": {
    "advanced_security": {"status": "enabled"},
    "secret_scanning": {"status": "enabled"},
    "secret_scanning_push_protection": {"status": "enabled"}
  }
}
JSON
  gh api --method PUT "repos/$repo/vulnerability-alerts"
  gh api --method DELETE "repos/$repo/automated-security-fixes"
  gh api --method PUT "repos/$repo/private-vulnerability-reporting"

  # Keep Actions off until reviewed workflows exist and every third-party action
  # is pinned to a full commit SHA.
  gh api --method PUT "repos/$repo/actions/permissions" --input - <<'JSON'
{"enabled": false}
JSON

  # Pull requests are disabled. Protect main against destructive history changes
  # while retaining direct pushes by the repository owner.
  gh api --method PUT "repos/$repo/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON
fi

printf '\nRepository security settings\n'
gh api "${api_version_header[@]}" "repos/$repo" --jq '{
  visibility,
  allow_merge_commit,
  allow_rebase_merge,
  allow_squash_merge,
  delete_branch_on_merge,
  has_pull_requests,
  web_commit_signoff_required,
  security_and_analysis
}'

printf '\nBranch protection\n'
if ! gh api "repos/$repo/branches/main/protection" --jq '{
  enforce_admins: .enforce_admins.enabled,
  pull_request_required: (.required_pull_request_reviews != null),
  linear_history: .required_linear_history.enabled,
  conversation_resolution: .required_conversation_resolution.enabled,
  force_pushes: .allow_force_pushes.enabled,
  deletions: .allow_deletions.enabled
}'; then
  printf 'Branch protection is unavailable or not configured. This is expected on the current private personal-plan repository, but blocks publication.\n' >&2
  [[ "$mode" == "audit" ]] || exit 1
fi

printf '\nAdditional controls\n'
gh api "repos/$repo/actions/permissions" --jq '{actions_enabled: .enabled}'
if gh api "repos/$repo/vulnerability-alerts" --silent; then
  printf 'PASS  dependency graph and vulnerability alerts are enabled\n'
else
  printf 'FAIL  dependency graph or vulnerability alerts are not enabled\n' >&2
  [[ "$mode" == "audit" ]] || exit 1
fi
gh api "repos/$repo/automated-security-fixes" --jq '{automated_security_fixes: .enabled, paused: .paused}'
if gh api "repos/$repo/private-vulnerability-reporting" --jq '{private_vulnerability_reporting: .enabled}'; then
  :
else
  printf 'Private vulnerability reporting is unavailable or not enabled.\n' >&2
  [[ "$mode" == "audit" ]] || exit 1
fi

if [[ "$mode" == "apply" ]]; then
  gh api "${api_version_header[@]}" "repos/$repo" --jq '
    if .visibility == "public"
       and .allow_merge_commit == false
       and .allow_rebase_merge == false
       and .allow_squash_merge == true
       and .delete_branch_on_merge == true
       and .has_pull_requests == false
       and .web_commit_signoff_required == true
       and .security_and_analysis.secret_scanning.status == "enabled"
       and .security_and_analysis.secret_scanning_push_protection.status == "enabled"
    then "PASS  repository and secret-scanning controls"
    else error("repository security settings do not match the required state") end'
  gh api "repos/$repo/branches/main/protection" --jq '
    if .enforce_admins.enabled == true
       and .required_pull_request_reviews == null
       and .required_linear_history.enabled == true
       and .required_conversation_resolution.enabled == true
       and .allow_force_pushes.enabled == false
       and .allow_deletions.enabled == false
    then "PASS  main branch protection"
    else error("main branch protection does not match the required state") end'
  gh api "repos/$repo/actions/permissions" --jq '
    if .enabled == false then "PASS  GitHub Actions remains disabled"
    else error("GitHub Actions is unexpectedly enabled") end'
  gh api "repos/$repo/automated-security-fixes" --jq '
    if .enabled == false then "PASS  PR-based automated security fixes are disabled"
    else error("automated security fixes could still create pull requests") end'
  gh api "repos/$repo/private-vulnerability-reporting" --jq '
    if .enabled == true then "PASS  private vulnerability reporting"
    else error("private vulnerability reporting is not enabled") end'
fi
