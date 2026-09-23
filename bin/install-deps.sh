#!/usr/bin/env bash

set -e

echo "Installing Capstone dependencies..."

# Core
bun add zod

# Authentication
bun add bcryptjs

# AI / RAG
bun add \
  langchain \
  @langchain/langgraph \
  @langchain/openai \
  @langchain/textsplitters

# Rich Text Editor
bun add \
  @tiptap/react \
  @tiptap/pm \
  @tiptap/starter-kit \
  @tiptap/extension-placeholder \
  @tiptap/extension-link \
  @tiptap/extension-underline

# Document Processing
bun add \
  pdf-parse \
  mammoth \
  unified \
  remark-parse \
  remark-rehype

# OCR
bun add tesseract.js

# S3-compatible storage
bun add @aws-sdk/client-s3

# PDF Export
bun add playwright
bunx playwright install chromium

echo ""
echo "Dependencies installed successfully."
