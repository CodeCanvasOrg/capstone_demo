#!/usr/bin/env bash

set -e

NAME="$1"

if [ -z "$NAME" ]; then
  echo "Usage: ./scripts/make-action.sh CreateDocumentVersion"
  exit 1
fi

node ace make:controller "$NAME"
node ace make:validator "$NAME"
node ace make:transformer "$NAME"
