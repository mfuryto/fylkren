#!/bin/sh
set -eu

samba_root=/samba
samba_config="$samba_root/etc/smb.conf"
domain_config="$samba_root/etc/smb.conf.d/00-domain.conf"

mkdir -p "$samba_root/log" "$samba_root/lock" "$samba_root/state" "$samba_root/cache" "$samba_root/private/tls"
mkdir -p /bind-dns /ntp_signd
chmod 0750 /ntp_signd

if [ ! -e "$samba_root/private/secrets.tdb" ]; then
  printf '%s\n' \
    'workgroup = EXAMPLE' \
    'realm = EXAMPLE.TEST' \
    'netbios name = AD' > "$domain_config"
  rm -f "$samba_root/etc/smb.conf.d/includes"
  for custom_config in "$samba_root"/etc/smb.conf.d/*.conf; do
    printf 'include = %s\n' "$custom_config" >> "$samba_root/etc/smb.conf.d/includes"
  done
  : > /tmp/smb.conf
  samba-tool domain provision -q -d0 \
    --use-rfc2307 \
    --dns-backend=SAMBA_INTERNAL \
    --domain=EXAMPLE \
    --realm=EXAMPLE.TEST \
    --host-name=AD \
    --server-role=dc \
    --function-level=2008_R2 \
    --configfile=/tmp/smb.conf \
    --backend-store=tdb \
    --targetdir="$samba_root" \
    --adminpass="$ADMIN_PASSWORD"
fi

exec samba -i -s "$samba_config"
