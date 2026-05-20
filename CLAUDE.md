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

# Per-package testing — scripts use `test`/`test:unit`, NOT `vitest` directly
pnpm --filter @distribute/<package> test                                   # all tests
pnpm --filter @distribute/<package> test:unit                              # unit tests only
pnpm --filter @distribute/<package> test tests/unit/specific.test.ts       # single file
```

**Shared workspace packages must be built before app tests/build.** Vitest + Vite resolve workspace deps via their `dist/` (per `package.json` exports), so an unbuilt `shared/*` package surfaces as `Failed to resolve entry for package "@distribute/<name>"` in unrelated test files. Run `pnpm -r build` (or `pnpm --filter @distribute/<name> build`) once after `pnpm install` or after pulling changes that touch `shared/`.

## Release flow (distribute.you specifics)

This monorepo does NOT use `release.sh hotfix` (the user-level release script targets Railway-deployed services with semver tags). Vercel deploys this repo on every `main` merge — no tag, no bump.

- **Hotfix** → branch from `origin/main`, PR target `main`, ship with `gh pr merge --auto --squash` (or hold for deploy-ordering blockers).
- **Bugfix / Feature** → branch from `origin/staging`, PR target `staging`, ship with `gh pr merge --auto --squash`. Promotion to `main` happens via the existing staging→main PR flow.

## Architecture

**Monorepo** — pnpm workspaces + Turborepo. Three workspace roots: `apps/`, `packages/`, `shared/`.

### Apps

- `apps/dashboard/` (port 3001) — Next.js 15 App Router, Clerk auth
- `apps/docs/` — Documentation site (docs.distribute.you)
- `apps/landing/` — Main landing page
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

### Verify backend shape before writing client types

Before declaring a typed dashboard helper for any backend endpoint (`listX`, `getX`, response interface, Zod schema), fetch the actual returned shape via the `api-registry` / `api-registry-staging` MCP. Never invent a type from "what feels right" or copy from an aspirational PR description — the deployed openapi is ground truth. If you want a richer shape, file a backend request and block (see "Missing Backend Fields"). Skipping this produces page crashes like `Cannot read property 'X' of undefined` because `data.X` does not exist on the real response.

Incident 2026-05-17 (distribute.you#1079): `quote-requests/page.tsx` was scaffolded against an aspirational `QuoteRequest` (`title`, `question`, `publication`, `priorityScore`, `status`, `deadlineAt`). Backend `GET /v1/orgs/quote-requests` actually returns `{ providerQuoteRequests: [{ opportunityText, mediaOutlet, deadline, … }] }`. Page crashed with "This page couldn't load" on first user visit. A 30-second `api-registry` lookup before declaring the type would have caught it.

### No Fallbacks — Fail Visibly

NEVER add fallback logic (|| alternatives, silent defaults, graceful degradation) when data is missing or doesn't match. Instead, log a clear `console.error` with the mismatched value and context so the bug surfaces immediately. If a required field is absent, show an error UI — don't hide the problem. This applies everywhere: lookups, field resolution, display logic.

### React Query mutations: write the response to the cache, don't just invalidate

When a mutation returns the fresh entity (e.g. POST `/campaigns/{id}/stop` returns `{ campaign }` with the new status), write it into the single-entity cache via `queryClient.setQueryData(["entity", id], data)` instead of (or in addition to) `invalidateQueries`. The downstream GET endpoint can return 5xx, and with `placeholderData: keepPreviousData` an invalidate-then-failed-refetch leaves the cache holding the stale pre-mutation row. The user sees the button revert / status unchanged and concludes the click did nothing.

`invalidateQueries` is still correct for list caches the mutation cannot rebuild on its own (`["campaigns"]`, `["leads"]`, etc.) — there the upside of a fresh list outweighs the risk of a flaky GET, and the mutation has no full list to write.

Incident 2026-05-20 (distribute.you#1090): `useStopCampaign` only invalidated `["campaign", id]`. With api-service `GET /v1/campaigns/{id}` returning 500, single-click Stop appeared to do nothing — user had to click twice. Fix: `setQueryData(["campaign", id], data)` on success.

### Dynasty-First Display Rule (Workflows Only)

Always display `dynastyName` for workflows, never the versioned name. The only exception is settings/debug panels where the specific version matters — there, show the version number and versioned name alongside the dynasty name. This applies to page titles, table rows, cards, breadcrumbs, and any user-facing text.

Note: Features no longer have dynasty concepts. Features use `slug` and `name` directly.
