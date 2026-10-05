#!/bin/sh
set -eu

umask 077
ca_private=/var/lib/fylkren-tls/ca-private
trust=/var/lib/fylkren-tls/trust
api_private=/var/lib/fylkren-tls/api
postgres_private=/var/lib/fylkren-tls/postgres

mkdir -p "$ca_private" "$trust" "$api_private" "$postgres_private"

new_ca=false
if [ ! -s "$ca_private/ca.key" ] || [ ! -s "$trust/ca.crt" ] || \
   ! openssl x509 -in "$trust/ca.crt" -checkend 15552000 -noout >/dev/null 2>&1; then
    rm -f "$ca_private/ca.key" "$ca_private/ca.srl" "$trust/ca.crt"
    openssl ecparam -name prime256v1 -genkey -noout -out "$ca_private/ca.key"
    openssl req -x509 -new -sha256 -days 3650 \
        -key "$ca_private/ca.key" -out "$trust/ca.crt" \
        -subj "/CN=Fylkren internal transport CA" \
        -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
        -addext "keyUsage=critical,keyCertSign,cRLSign" \
        -addext "subjectKeyIdentifier=hash"
    new_ca=true
fi

issue_leaf() {
    name=$1
    owner=$2
    directory=$3
    key="$directory/$name.key"
    certificate="$directory/$name.crt"
    renew=$new_ca

    if [ "$renew" = false ]; then
        if [ ! -s "$key" ] || [ ! -s "$certificate" ] || \
           ! openssl x509 -in "$certificate" -checkend 2592000 -noout >/dev/null 2>&1 || \
           ! openssl verify -CAfile "$trust/ca.crt" -verify_hostname "$name" "$certificate" >/dev/null 2>&1; then
            renew=true
        fi
    fi

    if [ "$renew" = true ]; then
        request="$directory/$name.csr"
        extensions="$directory/$name.ext"
        rm -f "$key" "$certificate" "$request" "$extensions"
        openssl ecparam -name prime256v1 -genkey -noout -out "$key"
        openssl req -new -sha256 -key "$key" -out "$request" -subj "/CN=$name"
        cat >"$extensions" <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyAgreement
extendedKeyUsage=serverAuth
subjectAltName=DNS:$name
authorityKeyIdentifier=keyid,issuer
subjectKeyIdentifier=hash
EOF
        openssl x509 -req -sha256 -days 397 -in "$request" \
            -CA "$trust/ca.crt" -CAkey "$ca_private/ca.key" -CAcreateserial \
            -out "$certificate" -extfile "$extensions"
        rm -f "$request" "$extensions"
    fi

    chown "$owner" "$key" "$certificate"
    chmod 0600 "$key"
    chmod 0644 "$certificate"
}

issue_leaf api 1654:1654 "$api_private"
issue_leaf postgres 70:70 "$postgres_private"
chmod 0600 "$ca_private/ca.key"
chmod 0644 "$trust/ca.crt"

openssl verify -CAfile "$trust/ca.crt" -verify_hostname api "$api_private/api.crt"
openssl verify -CAfile "$trust/ca.crt" -verify_hostname postgres "$postgres_private/postgres.crt"
