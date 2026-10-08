#!/bin/sh
set -eu

if [ "${RUN_DB_MIGRATIONS:-false}" = "true" ]; then
  echo "Running database migrations..."
  pnpm exec drizzle-kit migrate
fi

exec "$@"
