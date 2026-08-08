# syntax=docker/dockerfile:1
#
# The public landing, as a container for the Hetzner box that already runs the fleet.
# Build from the MONOREPO ROOT, not from this directory:
#
#   docker compose build landing-app       # context: ./repos/distribute.you
#
# Every NEXT_PUBLIC_* value is inlined into the client bundle at BUILD time, so those
# live in apps/landing/.env.production (written by the deploy script, never committed)
# and changing one needs a rebuild, not a restart. Server-side secrets arrive at RUN
# time through the compose env_file, like every other service on the box.
#
# DATABASE_URL is the one exception, because the blog migrations run BEFORE the build
# the way they do on Vercel. It arrives as a BuildKit secret rather than a build arg or
# a line in .env.production: a build arg is recorded in the image history and an env
# file is a layer, and this is a real database credential rather than a publishable
# token. The mount exists only for the length of that one RUN.

FROM node:22-alpine AS builder
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /repo

COPY . .

# Only the landing's subtree, not the whole workspace: the other four apps are deployed
# elsewhere and installing them here would cost minutes and gigabytes for nothing. The
# trailing `...` pulls in @distribute/content, which every served page reads its copy from.
RUN pnpm install --frozen-lockfile --filter @distribute/landing...

# Idempotent (`IF NOT EXISTS` throughout) and skipped silently when the secret is absent,
# which is what a local `docker build` without BuildKit secrets does. Run explicitly
# rather than relying on the `prebuild` lifecycle hook, so it cannot quietly stop running
# because of a pnpm pre/post-script default — a schema change that silently never applies
# is the failure this deploy path is meant to make impossible.
RUN --mount=type=secret,id=landing_db_url \
    DATABASE_URL="$(cat /run/secrets/landing_db_url 2>/dev/null || true)" \
    pnpm --filter @distribute/landing migrate

RUN pnpm --filter @distribute/landing... build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# The standalone output keeps the workspace layout, so the server lives at
# apps/landing/server.js and expects static/ and public/ beside it.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/landing/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/landing/public ./apps/landing/public

# Every SEO page is ISR, so the server rewrites its own cache as pages revalidate. The
# standalone output ships no cache directory and the process does not run as root, so
# without this the first revalidation fails and every page serves from the build forever.
RUN mkdir -p ./apps/landing/.next/cache && chown -R nextjs:nodejs ./apps/landing/.next

USER nextjs
EXPOSE 3000

CMD ["node", "apps/landing/server.js"]
