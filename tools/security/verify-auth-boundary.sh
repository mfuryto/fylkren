#!/usr/bin/env bash
set -euo pipefail

[[ $# -ge 1 ]] || { printf 'Usage: %s <https://test-host>\n' "$0" >&2; exit 2; }
base_url="$1"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
passes=0
failures=0

pass() { printf 'PASS  %s\n' "$1"; passes=$((passes + 1)); }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }
status() { awk 'toupper($1) ~ /^HTTP\// { code=$2 } END { print code }' "$1"; }

post_login() {
  local name="$1" username="$2" password="$3"
  local body
  body="$(jq -cn --arg username "$username" --arg password "$password" \
    '{username:$username,password:$password}')"
  curl --silent --show-error --dump-header "$temp_dir/$name.headers" \
    --output "$temp_dir/$name.body" --header 'Content-Type: application/json' \
    --data "$body" "$base_url/api/session"
}

post_login unknown "security-test-user-that-does-not-exist" "invalid-security-test-password"
unknown_status="$(status "$temp_dir/unknown.headers")"
if [[ "$unknown_status" == "401" || "$unknown_status" == "429" ]]; then
  pass "unknown identity is rejected ($unknown_status)"
else
  fail "unknown identity returned $unknown_status"
fi

if grep -Eqi 'stack trace|system\.|password hash|sql|exception' "$temp_dir/unknown.body"; then
  fail "authentication failure exposed implementation details"
else
  pass "authentication failure is generic"
fi

oversized_username="$(printf 'u%.0s' {1..321})"
post_login oversized "$oversized_username" "x"
oversized_status="$(status "$temp_dir/oversized.headers")"
if [[ "$oversized_status" == "401" || "$oversized_status" == "429" ]]; then
  pass "oversized username is rejected before authentication work ($oversized_status)"
else
  fail "oversized username returned $oversized_status"
fi

rate_limited=false
for attempt in {1..12}; do
  post_login "rate-$attempt" "security-rate-test-$attempt" "invalid-security-test-password"
  current="$(status "$temp_dir/rate-$attempt.headers")"
  if [[ "$current" == "429" ]]; then
    rate_limited=true
    break
  fi
  if [[ "$current" != "401" ]]; then
    fail "authentication attempt returned unexpected status $current"
    break
  fi
done

if $rate_limited; then
  pass "authentication rate limit returns 429"
  cache_control="$(awk -F: 'tolower($1)=="cache-control" { sub(/^[^:]*:[[:space:]]*/, ""); sub(/\r$/, ""); print }' "$temp_dir/rate-$attempt.headers")"
  [[ "${cache_control,,}" == *"no-store"* ]] &&
    pass "rate-limit response is not cacheable" ||
    fail "rate-limit response lacks Cache-Control no-store"
  retry_after="$(awk -F: 'tolower($1)=="retry-after" { sub(/^[^:]*:[[:space:]]*/, ""); sub(/\r$/, ""); print }' "$temp_dir/rate-$attempt.headers")"
  [[ "$retry_after" =~ ^[0-9]+$ ]] &&
    pass "rate-limit response provides numeric Retry-After" ||
    fail "rate-limit response lacks numeric Retry-After"
else
  fail "authentication rate limit was not reached within 12 attempts"
fi

printf '\nResult: %d passed, %d failed for authentication boundary\n' "$passes" "$failures"
printf 'Note: the source client is expected to remain rate-limited for at most one limiter window.\n'
(( failures == 0 ))
