# syntax=docker/dockerfile:1.7
#
# One Dockerfile for every service. Build with:
#
#   docker build -f infra/Dockerfile --build-arg APP=auth-service -t ecom/auth-service .
#
# Three stages:
#   deps    - installs the full workspace once (cached until package-lock changes)
#   build   - generates Prisma clients and bundles the one app requested
#   runtime - slim image with production deps, the bundle, and the generated client
#
# Prisma clients are generated *inside* the image so the query engine matches the
# image's OS/libc, and so the node_modules/@ecom-db/* directories exist at runtime.

ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /workspace
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
COPY tools/scripts/prisma.mjs tools/scripts/prisma.mjs
# postinstall runs prisma generate, which needs the schemas present. Skip it here;
# the build stage runs generate explicitly once the schemas are copied in.
RUN npm ci --ignore-scripts

# ---------------------------------------------------------------------------
FROM deps AS build
ARG APP
ENV NX_DAEMON=false
COPY . .
# Every schema is generated so that a shared lib importing a sibling client type-checks;
# the runtime image copies only the one this app needs.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" node tools/scripts/prisma.mjs generate
RUN npx nx build ${APP} --configuration=production --skip-nx-cache

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime
ARG APP
ENV NODE_ENV=production
ENV APP_NAME=${APP}
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl dumb-init \
  && addgroup -S app && adduser -S app -G app

COPY --from=deps /workspace/package.json /workspace/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Generated Prisma clients (all of them - small, and keeps the stage generic).
COPY --from=build /workspace/node_modules/@ecom-db ./node_modules/@ecom-db
# The prisma CLI is needed at container start for `migrate deploy`.
COPY --from=build /workspace/node_modules/prisma ./node_modules/prisma
COPY --from=build /workspace/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /workspace/apps/${APP}/prisma ./prisma
COPY --from=build /workspace/dist/apps/${APP} ./dist
COPY infra/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && chown -R app:app /app

USER app
EXPOSE 3000 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/api/v1/health/live || exit 1

ENTRYPOINT ["dumb-init", "--", "docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
