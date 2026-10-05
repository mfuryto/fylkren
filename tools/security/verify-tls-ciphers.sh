#!/usr/bin/env bash
set -euo pipefail

[[ $# -ge 1 ]] || { printf 'Usage: %s <test-host> [port]\n' "$0" >&2; exit 2; }
host="$1"
port="${2:-443}"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

probe() {
  local name="$1"; shift
  timeout 15 openssl s_client -connect "$host:$port" -servername "$host" \
    -verify_hostname "$host" -verify_return_error "$@" </dev/null >"$temp_dir/$name" 2>&1
}

probe tls13 -tls1_3
grep -Eq 'Cipher is TLS_(AES_(128|256)_GCM_SHA(256|384)|CHACHA20_POLY1305_SHA256)' "$temp_dir/tls13"
probe tls12 -tls1_2
grep -Eq 'Cipher is ECDHE-(RSA|ECDSA)-AES(128|256)-GCM-SHA(256|384)' "$temp_dir/tls12"

for entry in \
  'rsa-cbc:AES128-SHA' \
  'rsa-cbc-256:AES256-SHA' \
  'ecdhe-cbc:ECDHE-ECDSA-AES128-SHA' \
  'ecdhe-rsa-cbc:ECDHE-RSA-AES128-SHA'; do
  name="${entry%%:*}"
  cipher="${entry#*:}"
  if probe "$name" -tls1_2 -cipher "$cipher"; then
    printf 'Weak TLS 1.2 cipher was accepted: %s\n' "$cipher" >&2
    exit 1
  fi
done

tls13_cipher="$(sed -n 's/^New, TLSv1\.3, Cipher is //p' "$temp_dir/tls13" | head -n1)"
tls12_cipher="$(sed -n 's/^New, TLSv1\.2, Cipher is //p' "$temp_dir/tls12" | head -n1)"
printf '{"tlsCipherPolicy":"passed","tls13Preferred":"%s","tls12Preferred":"%s","weakSuitesRejected":4,"forwardSecrecy":true}\n' \
  "$tls13_cipher" "$tls12_cipher"
