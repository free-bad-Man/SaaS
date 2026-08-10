#!/usr/bin/env bash
set -euo pipefail

umask 077
backup_dir="/opt/3ve4/backups/postgres"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
temporary="${backup_dir}/.threeve4-${timestamp}.dump.tmp"
target="${backup_dir}/threeve4-${timestamp}.dump"

mkdir -p "${backup_dir}"
docker inspect 3ve4-postgres >/dev/null
docker exec 3ve4-postgres sh -lc 'exec pg_dump --format=custom --compress=6 --no-owner --no-acl --username="$POSTGRES_USER" "$POSTGRES_DB"' > "${temporary}"
test -s "${temporary}"
mv "${temporary}" "${target}"
find "${backup_dir}" -type f -name 'threeve4-*.dump' -mtime +14 -delete

