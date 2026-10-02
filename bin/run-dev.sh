#!/usr/bin/env bash

set -e

echo "Checking for Bun..."

if ! command -v bun &> /dev/null; then
    echo "Bun is not installed. Installing..."

    curl -fsSL https://bun.com/install | bash

    # Bun is usually installed here
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"

    if ! command -v bun &> /dev/null; then
        echo "Bun installation failed or could not be found."
        exit 1
    fi
else
    echo "Bun is already installed."
fi

echo "Installing dependencies..."
bun install

echo "Starting development server..."
bun run dev
