# syntax=docker/dockerfile:1

##
## One image holds everything the app needs at runtime: the Next.js build, the
## native modules (better-sqlite3, sharp), and the exact Chrome build this
## Puppeteer expects for the 300 DPI print path. Nothing is downloaded at boot,
## so a deploy either produces a working image or fails in CI where you can see
## it — never at 11pm on the server.
##
## The one thing that is NOT in here is DATA_DIR. The database and every
## uploaded photo live on a volume; see deploy/docker-compose.yml.
##

ARG NODE_VERSION=22

# --------------------------------------------------------------- deps --
FROM node:${NODE_VERSION}-bookworm AS deps
WORKDIR /app
# Chrome is installed once, in the runtime stage. Skipping it here keeps three
# copies of a 150 MB download out of the build.
ENV PUPPETEER_SKIP_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci

# -------------------------------------------------------------- build --
FROM node:${NODE_VERSION}-bookworm AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=1 NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------- prod deps --
FROM node:${NODE_VERSION}-bookworm AS prod-deps
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=1
COPY package.json package-lock.json ./
# Same Debian release as the runtime stage, so the native binaries built here
# match the glibc they will run against.
RUN npm ci --omit=dev

# ------------------------------------------------------------ runtime --
FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data \
    PRINT_BASE_URL=http://127.0.0.1:3000 \
    PUPPETEER_CACHE_DIR=/opt/puppeteer

# Chrome's shared libraries, plus a base font so fontconfig is never empty —
# the ads bring their own faces from public/fonts, but Chrome still wants one.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      fonts-liberation \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libatspi2.0-0 \
      libcairo2 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libgbm1 \
      libglib2.0-0 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libpango-1.0-0 \
      libx11-6 \
      libxcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxkbcommon0 \
      libxrandr2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json next.config.mjs ./
# make-admin.mjs is how the first booster account gets its admin flag on a
# server nobody can log into yet.
COPY scripts ./scripts
# The only piece of src/ the runtime needs. reprice-ads.mjs reads the price list
# straight from it rather than keeping a second copy that could drift, and the
# rest of src/ is already compiled into .next. Node strips the types on import
# (22.18+), so no build step stands between this file and the script.
COPY --from=build /app/src/lib/config.ts ./src/lib/config.ts

# The local binary, not `npx puppeteer`, so the Chrome build is the one this
# exact Puppeteer expects and nothing is resolved from the registry at build.
RUN node_modules/.bin/puppeteer browsers install chrome && chown -R node:node /opt/puppeteer
RUN mkdir -p /data && chown -R node:node /data /app

USER node
EXPOSE 3000

# Answers only if the process is up AND the database it was pointed at opens —
# a container that is running but looking at an empty DATA_DIR is not healthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["node_modules/.bin/next", "start"]
