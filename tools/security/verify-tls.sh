#!/usr/bin/env bash
set -euo pipefail

[[ $# -ge 1 ]] || { printf 'Usage: %s <test-host> [port]\n' "$0" >&2; exit 2; }
host="$1"
port="${2:-443}"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
passes=0
failures=0

pass() { printf 'PASS  %s\n' "$1"; passes=$((passes + 1)); }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }

probe() {
  local protocol="$1"
  local output="$temp_dir/$protocol.txt"
  if timeout 15 openssl s_client -connect "$host:$port" -servername "$host" \
      -verify_hostname "$host" -verify_return_error "-$protocol" < /dev/null > "$output" 2>&1; then
    return 0
  fi
  return 1
}

if probe tls1_2 && grep -q 'Verify return code: 0 (ok)' "$temp_dir/tls1_2.txt"; then
  pass "TLS 1.2 is accepted with a valid chain and hostname"
else
  fail "TLS 1.2 validation failed"
fi

if probe tls1_3 && grep -q 'Verify return code: 0 (ok)' "$temp_dir/tls1_3.txt"; then
  pass "TLS 1.3 is accepted with a valid chain and hostname"
else
  fail "TLS 1.3 validation failed"
fi

if probe tls1; then fail "TLS 1.0 is accepted"; else pass "TLS 1.0 is rejected"; fi
if probe tls1_1; then fail "TLS 1.1 is accepted"; else pass "TLS 1.1 is rejected"; fi

if timeout 15 openssl s_client -connect "$host:$port" -servername "$host" \
    -verify_hostname "$host" -verify_return_error < /dev/null > "$temp_dir/default.txt" 2>&1 &&
   grep -Eq 'New, TLSv1\.3|Protocol[[:space:]]*:[[:space:]]*TLSv1\.3' "$temp_dir/default.txt"; then
  pass "the default negotiation prefers TLS 1.3"
else
  fail "the default negotiation did not select TLS 1.3"
fi

openssl s_client -connect "$host:$port" -servername "$host" < /dev/null 2>/dev/null \
  | openssl x509 -outform PEM > "$temp_dir/certificate.pem"
if openssl x509 -in "$temp_dir/certificate.pem" -checkend 1209600 -noout; then
  pass "certificate remains valid for at least 14 days"
else
  fail "certificate expires within 14 days"
fi

printf '\nCertificate subject and validity:\n'
openssl x509 -in "$temp_dir/certificate.pem" -noout -subject -issuer -dates
printf '\nResult: %d passed, %d failed for %s:%s\n' "$passes" "$failures" "$host" "$port"
(( failures == 0 ))
