#!/usr/bin/env bash
set -euo pipefail

[[ $# -ge 1 ]] || { printf 'Usage: %s <https://test-host> [synthetic-credentials-file] [account]\n' "$0" >&2; exit 2; }
base_url="$1"
credentials_file="${2:-e2e-test-credentials.local}"
account_name="${3:-ordinary1}"

if [[ ! -f "$credentials_file" ]]; then
  printf 'Credential file not found: %s\n' "$credentials_file" >&2
  exit 2
fi

password="$(awk -F= -v name="$account_name" '$1 == name { sub(/^[^=]*=/, ""); print; exit }' "$credentials_file")"
if [[ -z "$password" ]]; then
  printf 'Synthetic account not found: %s\n' "$account_name" >&2
  exit 2
fi

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
cookie_jar="$temp_dir/cookies"
passes=0
failures=0

pass() { printf 'PASS  %s\n' "$1"; passes=$((passes + 1)); }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }
status() { awk 'toupper($1) ~ /^HTTP\// { code=$2 } END { print code }' "$1"; }

login_body="$(jq -cn --arg username "$account_name" --arg password "$password" \
  '{username:$username,password:$password}')"
curl --silent --show-error --cookie-jar "$cookie_jar" \
  --dump-header "$temp_dir/login.headers" --output "$temp_dir/login.body" \
  --header 'Content-Type: application/json' --data "$login_body" "$base_url/api/session"

login_status="$(status "$temp_dir/login.headers")"
if [[ "$login_status" == "204" ]]; then
  pass "synthetic account signed in"
else
  fail "sign-in returned $login_status"
  printf '\nResult: %d passed, %d failed\n' "$passes" "$failures"
  exit 1
fi

set_cookie="$(grep -i '^set-cookie:' "$temp_dir/login.headers" || true)"
[[ "${set_cookie,,}" == *"secure"* ]] && pass "session cookie is Secure" || fail "session cookie lacks Secure"
[[ "${set_cookie,,}" == *"httponly"* ]] && pass "session cookie is HttpOnly" || fail "session cookie lacks HttpOnly"
[[ "${set_cookie,,}" == *"samesite=strict"* ]] && pass "session cookie is SameSite=Strict" || fail "session cookie is not SameSite=Strict"

curl --silent --show-error --cookie "$cookie_jar" \
  --dump-header "$temp_dir/session.headers" --output "$temp_dir/session.body" \
  "$base_url/api/session"
if [[ "$(status "$temp_dir/session.headers")" == "200" ]] &&
   grep -Eq '"authenticated"[[:space:]]*:[[:space:]]*true' "$temp_dir/session.body"; then
  pass "authenticated session is active"
else
  fail "authenticated session could not be verified"
fi

curl --silent --show-error --cookie "$cookie_jar" --request DELETE \
  --dump-header "$temp_dir/no-csrf.headers" --output "$temp_dir/no-csrf.body" \
  "$base_url/api/session"
[[ "$(status "$temp_dir/no-csrf.headers")" == "400" ]] &&
  pass "logout without antiforgery token is rejected" ||
  fail "logout without antiforgery token was not rejected with 400"

curl --silent --show-error --cookie "$cookie_jar" --cookie-jar "$cookie_jar" \
  --dump-header "$temp_dir/antiforgery.headers" --output "$temp_dir/antiforgery.body" \
  "$base_url/api/security/antiforgery"
token="$(jq -r '.token // empty' "$temp_dir/antiforgery.body")"
[[ -n "$token" ]] && pass "antiforgery token was issued to authenticated session" || fail "antiforgery token was missing"

curl --silent --show-error --cookie "$cookie_jar" --request DELETE \
  --header "X-Fylkren-CSRF: $token" \
  --dump-header "$temp_dir/logout.headers" --output "$temp_dir/logout.body" \
  "$base_url/api/session"
[[ "$(status "$temp_dir/logout.headers")" == "204" ]] &&
  pass "logout with antiforgery token succeeded" ||
  fail "logout with antiforgery token failed"

curl --silent --show-error --cookie "$cookie_jar" \
  --dump-header "$temp_dir/after.headers" --output "$temp_dir/after.body" \
  "$base_url/api/session"
if [[ "$(status "$temp_dir/after.headers")" == "200" ]] &&
   grep -Eq '"authenticated"[[:space:]]*:[[:space:]]*false' "$temp_dir/after.body"; then
  pass "session is invalid after logout"
else
  fail "session remained authenticated after logout"
fi

printf '\nResult: %d passed, %d failed for session/CSRF flow\n' "$passes" "$failures"
(( failures == 0 ))
