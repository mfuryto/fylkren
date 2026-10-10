#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: tools/security/harden-public-github-repository.sh --repo OWNER/REPO [--apply]

Audits the GitHub controls and presentation required for Fylkren. With --apply,
the script configures the controls only after the repository owner has made the
repository public. It never changes repository visibility, publishes a release,
pushes code or creates a tag.
EOF
}

repo=""
mode="audit"
while (($#)); do
  case "$1" in
    --repo) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; repo="$2"; shift 2 ;;
    --apply) mode="apply"; shift ;;
    --help|-h) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
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

description="Self-hosted, multilingual and AI-assisted operational task and mission management for secure, offline and air-gapped organizations."
homepage="https://mfuryto.github.io/fylkren/"
topics='["self-hosted","task-management","mission-management","operations-management","workflow-management","risk-management","emergency-management","preparedness","ai-assisted","multilingual","offline-first","air-gapped","enterprise-software","public-sector","docker","dotnet","react","postgresql","identity-management","federation"]'

visibility="$(gh api "${api_version_header[@]}" "repos/$repo" --jq '.visibility')"
printf 'Repository: %s (%s)\n' "$repo" "$visibility"

if [[ "$mode" == "apply" ]]; then
  [[ "$visibility" == "public" ]] || {
    printf 'Refusing to apply: visibility must be changed separately by the owner after release acceptance.\n' >&2
    exit 1
  }
  [[ -z "$("${git_repo[@]}" status --porcelain)" ]] || {
    printf 'Refusing to apply from a worktree with uncommitted files.\n' >&2
    exit 1
  }

  bash tools/security/verify-repository-safety.sh --history

  gh api "${api_version_header[@]}" --method PATCH "repos/$repo" --input - <<'JSON'
{
  "description": "Self-hosted, multilingual and AI-assisted operational task and mission management for secure, offline and air-gapped organizations.",
  "homepage": "https://mfuryto.github.io/fylkren/",
  "has_issues": true,
  "has_projects": false,
  "has_wiki": false,
  "has_discussions": false,
  "has_pull_requests": false,
  "allow_merge_commit": false,
  "allow_rebase_merge": false,
  "allow_squash_merge": true,
  "allow_update_branch": true,
  "delete_branch_on_merge": true,
  "web_commit_signoff_required": true,
  "security_and_analysis": {
    "secret_scanning": {"status": "enabled"},
    "secret_scanning_push_protection": {"status": "enabled"}
  }
}
JSON

  printf '{"names":%s}\n' "$topics" | gh api "${api_version_header[@]}" --method PUT "repos/$repo/topics" --input -
  gh api --method PUT "repos/$repo/vulnerability-alerts"
  gh api --method DELETE "repos/$repo/automated-security-fixes"
  gh api --method PUT "repos/$repo/private-vulnerability-reporting"

  gh api --method PUT "repos/$repo/actions/permissions" --input - <<'JSON'
{"enabled":true,"allowed_actions":"selected"}
JSON
  gh api --method PUT "repos/$repo/actions/permissions/selected-actions" --input - <<'JSON'
{"github_owned_allowed":true,"verified_allowed":false,"patterns_allowed":[]}
JSON
  gh api --method PUT "repos/$repo/actions/permissions/workflow" --input - <<'JSON'
{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}
JSON

  if gh api "repos/$repo/pages" --silent; then
    gh api --method PUT "repos/$repo/pages" --input - <<'JSON'
{"build_type":"workflow","https_enforced":true}
JSON
  else
    gh api --method POST "repos/$repo/pages" --input - <<'JSON'
{"build_type":"workflow"}
JSON
  fi

  gh api --method PUT "repos/$repo/branches/staging/protection" --input - <<'JSON'
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
  gh api --method PUT "repos/$repo/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Source, documentation and tests", "Analyze (csharp)", "Analyze (javascript-typescript)"]
  },
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

  while IFS='|' read -r name color description_text; do
    if gh api "repos/$repo/labels/$name" --silent; then
      gh api --method PATCH "repos/$repo/labels/$name" -f new_name="$name" -f color="$color" -f description="$description_text" >/dev/null
    else
      gh api --method POST "repos/$repo/labels" -f name="$name" -f color="$color" -f description="$description_text" >/dev/null
    fi
  done <<'LABELS'
bug|d73a4a|Confirmed or reported product defect
enhancement|2b7489|Product improvement or new capability
question|6f42c1|Product, deployment or integration question
needs-triage|d4c5f9|Awaiting maintainer assessment
documentation|1d76db|Documentation change or clarification
security|b60205|Public tracking item with no confidential vulnerability details
LABELS
fi

printf '\nRepository presentation and features\n'
gh api "${api_version_header[@]}" "repos/$repo" --jq '{
  visibility, description, homepage, has_issues, has_projects, has_wiki,
  has_discussions, has_pull_requests, allow_merge_commit, allow_rebase_merge, allow_squash_merge,
  delete_branch_on_merge, web_commit_signoff_required, security_and_analysis
}'
gh api "${api_version_header[@]}" "repos/$repo/topics" --jq '{topics: .names}'

printf '\nBranch protection\n'
for branch in staging main; do
  if ! gh api "repos/$repo/branches/$branch/protection" --jq "{
    branch: \"$branch\",
    enforce_admins: .enforce_admins.enabled,
    required_checks: [.required_status_checks.checks[]?.context],
    linear_history: .required_linear_history.enabled,
    force_pushes: .allow_force_pushes.enabled,
    deletions: .allow_deletions.enabled
  }"; then
    printf 'Branch protection is unavailable or not configured for %s.\n' "$branch" >&2
    [[ "$mode" == "audit" ]] || exit 1
  fi
done

printf '\nActions, Pages and security reporting\n'
gh api "repos/$repo/actions/permissions" --jq '{actions_enabled: .enabled, allowed_actions}'
gh api "repos/$repo/actions/permissions/workflow" --jq '{default_workflow_permissions, can_approve_pull_request_reviews}'
if ! gh api "repos/$repo/pages" --jq '{pages: .html_url, build_type, https_enforced}'; then
  printf 'GitHub Pages is not configured.\n' >&2
  [[ "$mode" == "audit" ]] || exit 1
fi
if gh api "repos/$repo/vulnerability-alerts" --silent; then printf 'PASS  vulnerability alerts\n'; else printf 'FAIL  vulnerability alerts\n' >&2; [[ "$mode" == "audit" ]] || exit 1; fi
gh api "repos/$repo/automated-security-fixes" --jq '{automated_security_fixes: .enabled, paused: .paused}'
if ! gh api "repos/$repo/private-vulnerability-reporting" --jq '{private_vulnerability_reporting: .enabled}'; then
  printf 'Private vulnerability reporting is unavailable or not enabled.\n' >&2
  [[ "$mode" == "audit" ]] || exit 1
fi

if [[ "$mode" == "apply" ]]; then
  gh api "${api_version_header[@]}" "repos/$repo" --jq --arg description "$description" --arg homepage "$homepage" '
    if .visibility == "public"
       and .description == $description
       and .homepage == $homepage
       and .has_issues == true
       and .has_pull_requests == false
       and .allow_merge_commit == false
       and .allow_rebase_merge == false
       and .allow_squash_merge == true
       and .web_commit_signoff_required == true
       and .security_and_analysis.secret_scanning.status == "enabled"
       and .security_and_analysis.secret_scanning_push_protection.status == "enabled"
    then "PASS  presentation and repository controls"
    else error("repository settings do not match the required state") end'
  gh api "repos/$repo/actions/permissions/workflow" --jq '
    if .default_workflow_permissions == "read" and .can_approve_pull_request_reviews == false
    then "PASS  restricted workflow token"
    else error("workflow token permissions do not match the required state") end'
  gh api "repos/$repo/automated-security-fixes" --jq '
    if .enabled == false then "PASS  PR-based automated security fixes are disabled"
    else error("automated security fixes could create pull requests") end'
  gh api "repos/$repo/private-vulnerability-reporting" --jq '
    if .enabled == true then "PASS  private vulnerability reporting"
    else error("private vulnerability reporting is not enabled") end'
fi
