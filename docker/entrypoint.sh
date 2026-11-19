#!/bin/sh
# Optionally apply migrations before starting a role. Leave RUN_MIGRATIONS unset
# on workers and when migrations run as a separate one-off task.
set -e
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Running database migrations..."
  node ace migration:run --force
fi
exec "$@"
