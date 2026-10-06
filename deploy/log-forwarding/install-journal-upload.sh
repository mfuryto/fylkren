#!/bin/sh
set -eu

if [ "$#" -ne 4 ]; then
    echo "Usage: sudo $0 https://log-host:19532 CLIENT_CERT CLIENT_KEY TRUSTED_CA" >&2
    exit 2
fi
[ "$(id -u)" -eq 0 ] || { echo "Run as root." >&2; exit 1; }
url=$1
case "$url" in https://*/*|https://*) ;; *) echo "Log destination must use HTTPS." >&2; exit 2 ;; esac
case "$url" in *[[:space:]]*|*'#'*|*';'*) echo "Log destination contains unsafe characters." >&2; exit 2 ;; esac
command -v systemctl >/dev/null 2>&1 || { echo "systemd is required." >&2; exit 1; }
systemctl cat systemd-journal-upload.service >/dev/null 2>&1 || {
    echo "systemd-journal-upload is not installed." >&2
    exit 1
}

destination=/etc/fylkren/log-forwarding
mkdir -p -m 0700 "$destination" /etc/systemd/journal-upload.conf.d /etc/systemd/journald.conf.d
for source in "$2" "$3" "$4"; do
    case "$source" in /*) ;; *) echo "Certificate paths must be absolute." >&2; exit 2 ;; esac
    [ -f "$source" ] && [ -s "$source" ] || { echo "Missing certificate material: $source" >&2; exit 1; }
done
openssl x509 -in "$2" -noout -checkend 2592000 >/dev/null
openssl pkey -in "$3" -noout -check >/dev/null
openssl x509 -in "$4" -noout >/dev/null
certificate_public=$(openssl x509 -in "$2" -pubkey -noout | openssl pkey -pubin -outform DER | sha256sum | awk '{print $1}')
private_public=$(openssl pkey -in "$3" -pubout -outform DER | sha256sum | awk '{print $1}')
[ "$certificate_public" = "$private_public" ] || { echo "Client certificate and key do not match." >&2; exit 1; }

install -m 0644 "$2" "$destination/client.crt"
install -m 0600 "$3" "$destination/client.key"
install -m 0644 "$4" "$destination/trusted-ca.crt"
cat > /etc/systemd/journal-upload.conf.d/fylkren.conf <<EOF
[Upload]
URL=$url
ServerCertificateFile=$destination/client.crt
ServerKeyFile=$destination/client.key
TrustedCertificateFile=$destination/trusted-ca.crt
NetworkTimeoutSec=30s
EOF
chmod 0600 /etc/systemd/journal-upload.conf.d/fylkren.conf
cat > /etc/systemd/journald.conf.d/fylkren-persistent.conf <<'EOF'
[Journal]
Storage=persistent
Seal=yes
EOF
chmod 0644 /etc/systemd/journald.conf.d/fylkren-persistent.conf
systemctl restart systemd-journald
systemctl enable --now systemd-journal-upload.service
echo "Authenticated Fylkren journal forwarding is installed. Run verify-journal-upload.sh."
