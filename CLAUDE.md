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
pnpm --filter @distribute/<package> test
pnpm --filter @distribute/<package> test:unit
pnpm --filter @distribute/<package> vitest run tests/unit/specific.test.ts
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

- `packages/mcp-sales-outreach/` — @distribute/sales-outreach
- `packages/mcp-google-ads/` — @distribute/google-ads
- `packages/mcp-influencer-pitch/` — @distribute/influencer-pitch
- `packages/mcp-journalist-pitch/` — @distribute/journalist-pitch
- `packages/mcp-podcaster-pitch/` — @distribute/podcaster-pitch
- `packages/mcp-reddit-ads/` — @distribute/reddit-ads
- `packages/mcp-thought-leader/` — @distribute/thought-leader

### Shared Libraries

- `shared/auth/` — Shared authentication utilities
- `shared/content/` — Single source of truth for all marketing/docs content
- `shared/pictures/` — Shared images and assets
- `shared/runs-client/` — Client for the runs-service
- `shared/types/` — Shared TypeScript types

### Content Sync Rules

All marketing/docs content lives in `shared/content/src/`. Public surfaces import from `@distribute/content`.

- `shared/content/src/urls.ts` — All public URLs
- `shared/content/src/mcps.ts` — MCP package definitions
- `shared/content/src/pricing.ts` — Pricing tiers, BYOK cost estimates
- `shared/content/src/features.ts` — Feature descriptions, FAQ, supported AI clients
- `shared/content/src/brand.ts` — Brand name, tagline, hero text

When changing content: update `shared/content/src/`, run `pnpm generate:readme`, verify build, commit regenerated README.md.

**README.md is GENERATED** — never edit directly.

### Missing Backend Fields

If the dashboard needs a field, endpoint, or capability that the backend doesn't provide, NEVER work around it client-side (regex, slugifying, name-derivation, aggregation heuristics, etc.). Instead, immediately draft a message for Kevin to forward to the backend team requesting what you need. Block on the backend change.

### No Fallbacks — Fail Visibly

NEVER add fallback logic (|| alternatives, silent defaults, graceful degradation) when data is missing or doesn't match. Instead, log a clear `console.error` with the mismatched value and context so the bug surfaces immediately. If a required field is absent, show an error UI — don't hide the problem. This applies everywhere: lookups, field resolution, display logic.

### Dynasty-First Display Rule

Always display `dynastyName` for workflows and features, never the versioned name. The only exception is settings/debug panels where the specific version matters — there, show the version number and versioned name alongside the dynasty name. This applies to page titles, table rows, cards, breadcrumbs, and any user-facing text. URLs should also use dynasty slugs once the backend supports resolving them to the active version.
