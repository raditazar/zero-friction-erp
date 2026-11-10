#!/bin/sh
# Apply real migrations in dependency order; the demo seed (002) needs columns added by 005, so it runs last.
# 006 is a goose file (Up + Down in one file): only the Up part must run, otherwise psql would create then drop the tables.
set -eu
apply() {
  echo "applying $1"
  sed "/^-- +goose Down/,\$d" "$1" | psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"
}
for f in $(ls /migrations/*.sql | grep -v "/002_seed_data.sql" | sort); do
  apply "$f"
done
apply /migrations/002_seed_data.sql
