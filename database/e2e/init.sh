#!/bin/sh
# Apply real migrations in dependency order; the demo seed (002) needs columns added by 005, so it runs last.
set -eu
for f in $(ls /migrations/*.sql | grep -v "/002_seed_data.sql" | sort); do
  echo "applying $f"
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$f"
done
echo "applying /migrations/002_seed_data.sql"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /migrations/002_seed_data.sql
