# syntax=docker/dockerfile:1
#
# The customer dashboard, as a container for the Hetzner box that already runs the fleet.
# Build from the MONOREPO ROOT, not from this directory:
#
#   docker compose build dashboard-app     # context: ./repos/distribute.you
#
# Every NEXT_PUBLIC_* value is inlined into the client bundle at BUILD time, so those
# live in apps/dashboard/.env.production (written by the deploy script, never committed)
# and changing one needs a rebuild, not a restart. Server-side secrets — the Clerk
# backend key, the platform keys this app registers into key-service on boot — arrive at
# RUN time through the compose env_file, like every other service on the box.
#
# There is no `maxDuration` here to carry over. That export is a Vercel function limit;
# a standalone Next server has no per-route ceiling, so the only timeout on the long
# calls (the /api/v1 proxy, the chat stream) is Caddy's, set on the vhost.

FROM node:22-alpine AS builder
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /repo

COPY . .

# Only the dashboard's subtree, not the whole workspace: the other four apps are deployed
# elsewhere and installing them here would cost minutes and gigabytes for nothing.
RUN pnpm install --frozen-lockfile --filter @distribute/dashboard...
RUN pnpm --filter @distribute/dashboard build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# The standalone output keeps the workspace layout, so the server lives at
# apps/dashboard/server.js and expects static/ and public/ beside it.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/dashboard/public ./apps/dashboard/public

# The dashboard is almost entirely dynamic, but a handful of routes still revalidate and
# the process does not run as root — an unwritable cache directory turns those into a
# permission error on the first revalidation rather than a stale page.
RUN mkdir -p ./apps/dashboard/.next/cache && chown -R nextjs:nodejs ./apps/dashboard/.next

USER nextjs
EXPOSE 3000

CMD ["node", "apps/dashboard/server.js"]
