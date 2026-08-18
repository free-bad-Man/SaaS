#!/usr/bin/env bash
set -euo pipefail

umask 077
backup_dir="/opt/verdict/backups/postgres"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
temporary="${backup_dir}/.verdict-${timestamp}.dump.tmp"
target="${backup_dir}/verdict-${timestamp}.dump"

mkdir -p "${backup_dir}"
docker inspect verdict-postgres >/dev/null
docker exec verdict-postgres sh -lc 'exec pg_dump --format=custom --compress=6 --no-owner --no-acl --username="$POSTGRES_USER" "$POSTGRES_DB"' > "${temporary}"
test -s "${temporary}"
mv "${temporary}" "${target}"
find "${backup_dir}" -type f -name 'verdict-*.dump' -mtime +14 -delete

