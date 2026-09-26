#!/usr/bin/env bash

set -e

NAME="$1"

if [ -z "$NAME" ]; then
  echo "Usage: ./scripts/make-action.sh CreateDocumentVersion"
  exit 1
fi

bun --bun ace make:controller "$NAME"
bun --bun ace make:validator "$NAME"
bun --bun ace make:transformer "$NAME"
