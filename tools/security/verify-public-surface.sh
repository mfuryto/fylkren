#!/usr/bin/env bash
set -euo pipefail

[[ $# -ge 1 ]] || { printf 'Usage: %s <https://test-host>\n' "$0" >&2; exit 2; }
base_url="$1"
canonical_host="${base_url#*://}"
canonical_host="${canonical_host%%/*}"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

passes=0
failures=0

pass() { printf 'PASS  %s\n' "$1"; passes=$((passes + 1)); }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }

request() {
  local name="$1"; shift
  : > "$temp_dir/$name.headers"
  : > "$temp_dir/$name.body"
  if curl --silent --show-error --dump-header "$temp_dir/$name.headers" \
    --output "$temp_dir/$name.body" "$@"; then
    printf '0' > "$temp_dir/$name.curl-exit"
  else
    printf '%s' "$?" > "$temp_dir/$name.curl-exit"
  fi
}

status() { awk 'toupper($1) ~ /^HTTP\// { code=$2 } END { print code }' "$1"; }
header() {
  local file="$1" name="$2"
  awk -v wanted="${name,,}" 'BEGIN { FS=":" } tolower($1)==wanted { sub(/^[^:]*:[[:space:]]*/, ""); sub(/\r$/, ""); value=$0 } END { print value }' "$file"
}
expect_status() {
  local name="$1" expected="$2" actual
  actual="$(status "$temp_dir/$name.headers")"
  [[ "$actual" == "$expected" ]] && pass "$name returned $expected" || fail "$name returned $actual, expected $expected"
}
expect_header_contains() {
  local request_name="$1" header_name="$2" expected="$3" actual
  actual="$(header "$temp_dir/$request_name.headers" "$header_name")"
  [[ "${actual,,}" == *"${expected,,}"* ]] && pass "$request_name has $header_name: $expected" || fail "$request_name missing $header_name: $expected"
}

request public-config "$base_url/api/configuration/public"
expect_status public-config 200
expect_header_contains public-config cache-control no-store
expect_header_contains public-config x-content-type-options nosniff
expect_header_contains public-config x-frame-options deny
expect_header_contains public-config referrer-policy no-referrer
expect_header_contains public-config content-security-policy "default-src 'self'"
expect_header_contains public-config strict-transport-security max-age=
if grep -Eqi '"(version|edition|entitlements|communitySiteLimit|classificationMarkings|classificationEnabled)"[[:space:]]*:' "$temp_dir/public-config.body"; then
  fail "anonymous configuration disclosed protected deployment metadata"
else
  pass "anonymous configuration contains no version, license or classification metadata"
fi

request protected-config "$base_url/api/configuration"
expect_status protected-config 401

request home "$base_url/"
expect_status home 200
expect_header_contains home content-security-policy "object-src 'none'"
expect_header_contains home content-security-policy "frame-ancestors 'none'"
expect_header_contains home content-security-policy "base-uri 'none'"

asset_path="$(grep -Eo '/assets/[^" ]+\.js' "$temp_dir/home.body" | head -n 1 || true)"
if [[ -n "$asset_path" ]]; then
  request static-asset "$base_url$asset_path"
  expect_status static-asset 200
  expect_header_contains static-asset cache-control immutable
else
  fail "could not locate a versioned JavaScript asset"
fi

http_url="http://${canonical_host}/health"
request http-redirect "$http_url"
http_status="$(status "$temp_dir/http-redirect.headers")"
if [[ "$http_status" == "301" || "$http_status" == "307" || "$http_status" == "308" ]]; then
  pass "HTTP redirects to HTTPS ($http_status)"
  expect_header_contains http-redirect location "https://"
else
  fail "HTTP did not redirect to HTTPS (returned ${http_status:-no status})"
fi

request anonymous-session "$base_url/api/session"
expect_status anonymous-session 200
expect_header_contains anonymous-session cache-control no-store
if grep -Eq '"authenticated"[[:space:]]*:[[:space:]]*false' "$temp_dir/anonymous-session.body"; then
  pass "anonymous session does not disclose an authenticated identity"
else
  fail "anonymous session response was unexpected"
fi

request protected-site-list "$base_url/api/sites"
expect_status protected-site-list 401
expect_header_contains protected-site-list cache-control no-store

request protected-platform-audit "$base_url/api/platform-audit"
expect_status protected-platform-audit 401

request protected-machine-api "$base_url/api/v1/administration/sites"
expect_status protected-machine-api 401

request unknown-route "$base_url/api/security-verification-route-that-does-not-exist"
expect_status unknown-route 401
if grep -Eqi 'stack trace|system\.| at [a-z0-9_.]+\(' "$temp_dir/unknown-route.body"; then
  fail "unknown route exposed implementation details"
else
  pass "unknown route did not expose implementation details"
fi

request foreign-host --header 'Host: invalid.example' "$base_url/api/configuration/public"
foreign_status="$(status "$temp_dir/foreign-host.headers")"
foreign_exit="$(cat "$temp_dir/foreign-host.curl-exit")"
if [[ "$foreign_status" == "400" || "$foreign_status" == "421" || "$foreign_exit" != "0" ]]; then
  pass "foreign Host was rejected"
else
  fail "foreign Host returned ${foreign_status:-no status}"
fi

request trace-method --request TRACE "$base_url/"
trace_status="$(status "$temp_dir/trace-method.headers")"
if [[ "$trace_status" == "405" || "$trace_status" == "501" ]]; then
  pass "TRACE is disabled ($trace_status)"
else
  fail "TRACE returned $trace_status"
fi

printf '\nResult: %d passed, %d failed for %s (%s)\n' "$passes" "$failures" "$base_url" "$canonical_host"
(( failures == 0 ))
