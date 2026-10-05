#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(CDPATH= cd -- "$script_dir/../.." && pwd)
env_file="$project_dir/.env"
template_file="$script_dir/.env.example"
mkdir -p "$project_dir/runtime"

if [ -e "$env_file" ]; then
  echo "Existing .env preserved. No changes were made."
  echo "Run sudo ./deploy/host-status/install.sh to enable host status collection."
  exit 0
fi

cp "$template_file" "$env_file"
chmod 600 "$env_file"

echo "Created .env. Review installation settings before starting Fylkren."
echo "After Docker is installed, run sudo ./deploy/host-status/install.sh to enable host status collection."
