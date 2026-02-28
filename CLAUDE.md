# Project: MCP Factory

DFY (Done-For-You), BYOK (Bring Your Own Keys) automation platform built on the Model Context Protocol. Users provide a URL + budget, the platform handles lead finding, outreach, email generation, and reporting.

## Commands

```bash
pnpm dev                    # All services via Turbo
pnpm dev:dashboard          # Dashboard only (Next.js, port 3001)
pnpm dev:<service-name>     # Any individual service
pnpm build                  # Build all (Turbo-orchestrated)
pnpm lint                   # Lint all packages
pnpm generate:readme        # Regenerate README.md from shared/content

# Per-package testing
pnpm --filter @mcpfactory/<package> test
pnpm --filter @mcpfactory/<package> test:unit
pnpm --filter @mcpfactory/<package> vitest run tests/unit/specific.test.ts
```

## Architecture

**Monorepo** — pnpm workspaces + Turborepo. Three workspace roots: `apps/`, `packages/`, `shared/`.

### Apps

- `apps/dashboard/` (port 3001) — Next.js 15 App Router, Clerk auth
- `apps/docs/` — Documentation site (docs.distribute.you)
- `apps/landing/` — Main landing page
- `apps/performance-service/` — Performance monitoring service
- `apps/sales-cold-emails-landing/` — Marketing landing page (salescoldemail.distribute.you)

### Extracted Services (separate repos)

- [shamanic-technologies/api-service](https://github.com/shamanic-technologies/api-service) — Backend API service
- [shamanic-technologies/mcp](https://github.com/shamanic-technologies/mcp) — MCP server endpoint service

### Packages (Published MCP Servers)

Each package is a standalone MCP server published to npm. Built with `tsup` for ESM.

- `packages/mcp-sales-outreach/` — @mcpfactory/sales-outreach
- `packages/mcp-google-ads/` — @mcpfactory/google-ads
- `packages/mcp-influencer-pitch/` — @mcpfactory/influencer-pitch
- `packages/mcp-journalist-pitch/` — @mcpfactory/journalist-pitch
- `packages/mcp-podcaster-pitch/` — @mcpfactory/podcaster-pitch
- `packages/mcp-reddit-ads/` — @mcpfactory/reddit-ads
- `packages/mcp-thought-leader/` — @mcpfactory/thought-leader

### Shared Libraries

- `shared/auth/` — Shared authentication utilities
- `shared/content/` — Single source of truth for all marketing/docs content
- `shared/pictures/` — Shared images and assets
- `shared/runs-client/` — Client for the runs-service
- `shared/types/` — Shared TypeScript types

### Content Sync Rules

All marketing/docs content lives in `shared/content/src/`. Public surfaces import from `@mcpfactory/content`.

- `shared/content/src/urls.ts` — All public URLs
- `shared/content/src/mcps.ts` — MCP package definitions
- `shared/content/src/pricing.ts` — Pricing tiers, BYOK cost estimates
- `shared/content/src/features.ts` — Feature descriptions, FAQ, supported AI clients
- `shared/content/src/brand.ts` — Brand name, tagline, hero text

When changing content: update `shared/content/src/`, run `pnpm generate:readme`, verify build, commit regenerated README.md.

**README.md is GENERATED** — never edit directly.
