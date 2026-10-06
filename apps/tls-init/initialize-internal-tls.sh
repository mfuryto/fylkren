#!/bin/sh
set -eu

umask 077
ca_private=/var/lib/fylkren-tls/ca-private
trust=/var/lib/fylkren-tls/trust
api_private=/var/lib/fylkren-tls/api
postgres_private=/var/lib/fylkren-tls/postgres
database_client_private=/var/lib/fylkren-tls/database-client
data_protection_private=/var/lib/fylkren-data-protection

mkdir -p "$ca_private" "$trust" "$api_private" "$postgres_private" "$database_client_private" "$data_protection_private"

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

issue_client() {
    name=$1
    owner=$2
    directory=$3
    key="$directory/$name.key"
    certificate="$directory/$name.crt"
    renew=$new_ca

    if [ "$renew" = false ]; then
        if [ ! -s "$key" ] || [ ! -s "$certificate" ] || \
           ! openssl x509 -in "$certificate" -checkend 2592000 -noout >/dev/null 2>&1 || \
           ! openssl verify -CAfile "$trust/ca.crt" -purpose sslclient "$certificate" >/dev/null 2>&1; then
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
extendedKeyUsage=clientAuth
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
issue_client fylkren-api 1654:1654 "$database_client_private"

if [ ! -e "$data_protection_private/data-protection.key" ] && \
   [ ! -e "$data_protection_private/data-protection.crt" ]; then
    rm -f "$data_protection_private/data-protection.key" "$data_protection_private/data-protection.crt"
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 \
        -out "$data_protection_private/data-protection.key"
    openssl req -x509 -new -sha256 -days 3650 \
        -key "$data_protection_private/data-protection.key" \
        -out "$data_protection_private/data-protection.crt" \
        -subj "/CN=Fylkren Data Protection key encryption" \
        -addext "basicConstraints=critical,CA:FALSE" \
        -addext "keyUsage=critical,keyEncipherment,dataEncipherment" \
        -addext "subjectKeyIdentifier=hash"
elif [ ! -s "$data_protection_private/data-protection.key" ] || \
     [ ! -s "$data_protection_private/data-protection.crt" ]; then
    echo "Data Protection custody is incomplete; restore the matching certificate and private key." >&2
    exit 1
fi
openssl x509 -in "$data_protection_private/data-protection.crt" -checkend 2592000 -noout || {
    echo "Data Protection custody expires within 30 days; complete a controlled key-ring rotation before restart." >&2
    exit 1
}
certificate_public=$(openssl x509 -in "$data_protection_private/data-protection.crt" -pubkey -noout | openssl pkey -pubin -outform DER | sha256sum | awk '{print $1}')
private_public=$(openssl pkey -in "$data_protection_private/data-protection.key" -pubout -outform DER | sha256sum | awk '{print $1}')
[ "$certificate_public" = "$private_public" ] || {
    echo "Data Protection certificate and private key do not match." >&2
    exit 1
}
chmod 0600 "$data_protection_private/data-protection.key"
chmod 0644 "$data_protection_private/data-protection.crt"
chown 1654:1654 "$data_protection_private/data-protection.key" "$data_protection_private/data-protection.crt"
chmod 0700 "$data_protection_private"
chown 1654:1654 "$data_protection_private"
chmod 0600 "$ca_private/ca.key"
chmod 0644 "$trust/ca.crt"

openssl verify -CAfile "$trust/ca.crt" -verify_hostname api "$api_private/api.crt"
openssl verify -CAfile "$trust/ca.crt" -verify_hostname postgres "$postgres_private/postgres.crt"
openssl verify -CAfile "$trust/ca.crt" -purpose sslclient "$database_client_private/fylkren-api.crt"
openssl x509 -in "$data_protection_private/data-protection.crt" -noout -subject -fingerprint -sha256
