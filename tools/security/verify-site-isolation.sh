#!/usr/bin/env bash
set -euo pipefail

[[ $# -ge 1 ]] || { printf 'Usage: %s <https://test-host> [synthetic-credentials-file] [account-a] [account-b]\n' "$0" >&2; exit 2; }
base_url="$1"
credentials_file="${2:-e2e-test-credentials.local}"
account_a="${3:-sjef}"
account_b="${4:-datterleder}"

if [[ ! -f "$credentials_file" ]]; then
  printf 'Credential file not found: %s\n' "$credentials_file" >&2
  exit 2
fi

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
passes=0
failures=0

pass() { printf 'PASS  %s\n' "$1"; passes=$((passes + 1)); }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }
status() { awk 'toupper($1) ~ /^HTTP\// { code=$2 } END { print code }' "$1"; }
password_for() {
  awk -F= -v name="$1" '$1 == name { sub(/^[^=]*=/, ""); print; exit }' "$credentials_file"
}

login() {
  local account="$1" prefix="$2" password body response_status
  password="$(password_for "$account")"
  if [[ -z "$password" ]]; then
    printf 'Synthetic account not found: %s\n' "$account" >&2
    exit 2
  fi
  body="$(jq -cn --arg username "$account" --arg password "$password" '{username:$username,password:$password}')"
  curl --silent --show-error --cookie-jar "$temp_dir/$prefix.cookies" \
    --dump-header "$temp_dir/$prefix.login.headers" --output "$temp_dir/$prefix.login.body" \
    --header 'Content-Type: application/json' --data "$body" "$base_url/api/session"
  response_status="$(status "$temp_dir/$prefix.login.headers")"
  if [[ "$response_status" != "204" ]]; then
    printf 'Synthetic sign-in failed for test side %s with HTTP %s\n' "$prefix" "$response_status" >&2
    exit 2
  fi
}

request() {
  local prefix="$1" name="$2" path="$3" expected="$4" response_status
  curl --silent --show-error --cookie "$temp_dir/$prefix.cookies" \
    --dump-header "$temp_dir/$prefix.$name.headers" --output "$temp_dir/$prefix.$name.body" \
    "$base_url$path"
  response_status="$(status "$temp_dir/$prefix.$name.headers")"
  [[ "$response_status" == "$expected" ]] && pass "$name returned $expected" || fail "$name returned $response_status instead of $expected"
}

login "$account_a" a
login "$account_b" b
pass "two synthetic users signed in without exposing credentials"

request a context-a /api/work/context 200
request b context-b /api/work/context 200
site_a="$(jq -r '.sites[0].siteId // empty' "$temp_dir/a.context-a.body")"
site_b="$(jq -r '.sites[0].siteId // empty' "$temp_dir/b.context-b.body")"
if [[ -z "$site_a" || -z "$site_b" || "$site_a" == "$site_b" ]]; then
  printf 'The selected accounts must resolve to two different active sites.\n' >&2
  exit 2
fi

request a visible-sites /api/sites 200
if jq -e --argjson allowed "$(jq '[.sites[].siteId]' "$temp_dir/a.context-a.body")" \
    'all(.[]; .id as $id | $allowed | index($id) != null)' "$temp_dir/a.visible-sites.body" >/dev/null; then
  pass "interactive site list contains no site outside the user context"
else
  fail "interactive site list exposed a site outside the user context"
fi

request a own-work "/api/work/sites/$site_a/items?filter=active" 200
request a foreign-work "/api/work/sites/$site_b/items?filter=active" 403
request a foreign-organization "/api/sites/$site_b/organization-units" 403
request a foreign-personnel "/api/sites/$site_b/access" 403
request a foreign-planning "/api/workflows/planning/sites/$site_b" 403
request a foreign-execution "/api/execution/sites/$site_b" 403
request a platform-operations /api/platform/operations 403
request a platform-audit /api/platform-audit 403

printf '\nResult: %d passed, %d failed for site and role isolation\n' "$passes" "$failures"
(( failures == 0 ))
