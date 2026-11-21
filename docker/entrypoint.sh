#!/bin/sh
# APP_ROLE=worker runs the queue worker instead of the image's default command
# (used by the Railway worker in terraform/vercel, which can't override CMD per role).
# Optionally apply migrations before starting a role. Leave RUN_MIGRATIONS unset
# on workers and when migrations run as a separate one-off task.
set -e
if [ "${APP_ROLE:-}" = "worker" ]; then
  set -- node ace queue:work --queue=documents
fi
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Running database migrations..."
  node ace migration:run --force
fi
exec "$@"
