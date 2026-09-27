#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(CDPATH= cd -- "$script_dir/../.." && pwd)
env_file="$project_dir/.env"
template_file="$script_dir/.env.example"

if [ -e "$env_file" ]; then
  echo "Existing .env preserved. No changes were made."
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "OpenSSL is required to generate FYLKREN_DB_PASSWORD." >&2
  exit 1
fi

db_password=$(openssl rand -hex 32)
cp "$template_file" "$env_file"
sed -i "s/^FYLKREN_DB_PASSWORD=.*/FYLKREN_DB_PASSWORD=$db_password/" "$env_file"
chmod 600 "$env_file"

echo "Created .env with a random database password. Review installation settings before starting Fylkren."
