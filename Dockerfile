# syntax=docker/dockerfile:1.7
#
# One image, two roles (same build, different command):
#   web    : node bin/server.js                         (default CMD)
#   worker : node ace queue:work --queue=documents
#   migrate: node ace migration:run --force             (one-off task)
# See docker/entrypoint.sh and terraform/ for how each role is run.

ARG NODE_VERSION=24

# ---------------------------------------------------------------- build
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app

# bun.lock is the lockfile of record for this repo.
RUN npm install -g bun@1

COPY package.json bun.lock ./
# Railway only accepts cache mounts whose id is `s/<service id>-<target>`; 52cd682d-... is the
# worker service (terraform output railway_worker_service_id). Plain Docker accepts any id.
RUN --mount=type=cache,id=s/52cd682d-cc43-46ca-94bd-44a5ad9d1104-/root/.bun/install/cache,target=/root/.bun/install/cache bun install --frozen-lockfile

COPY . .
# `node ace build` compiles the server + Vite assets into /app/build.
# Env vars are not validated by the build, so no secrets are needed here.
# NOTE: --ignore-ts-errors because the repo currently has pre-existing type errors
# (e.g. a missing `createHash` import in claim_review_service.ts). Drop the flag
# once `bun run typecheck` is clean so CI catches regressions.
RUN node ace build --ignore-ts-errors

# Production-only dependencies for the compiled app.
WORKDIR /app/build
RUN --mount=type=cache,id=s/52cd682d-cc43-46ca-94bd-44a5ad9d1104-/root/.bun/install/cache,target=/root/.bun/install/cache bun install --frozen-lockfile --production

# ---------------------------------------------------------------- runtime
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333 \
    TZ=UTC \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    UV_PYTHON_INSTALL_DIR=/opt/python \
    UV_PROJECT_ENVIRONMENT=/app/python/pdf_worker/.venv \
    PDF_WORKER_PYTHON=/app/python/pdf_worker/.venv/bin/python
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl tini \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/build ./

# Playwright Chromium (PDF export) and its system libraries, using the exact
# version resolved in the lockfile.
RUN npx --no-install playwright install --with-deps chromium \
 && rm -rf /var/lib/apt/lists/*

# PyMuPDF worker: reproducible venv from uv.lock (Python 3.13 is fetched by uv).
COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /usr/local/bin/uv
COPY python/pdf_worker ./python/pdf_worker
RUN uv sync --project python/pdf_worker --frozen --no-dev --compile-bytecode \
 && chmod -R a+rX /opt/python

# OCR language data (tesseract.js reads it from the app root).
COPY eng.traineddata ./eng.traineddata

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /app/tmp && chown -R node:node /app/tmp /app/python/pdf_worker

USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "bin/server.js"]
