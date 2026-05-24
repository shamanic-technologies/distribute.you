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

Incident 2026-05-21 (distribute.you#1094): `BrandDetail` declared `brandUrl` + `bio`/`mission`/`location`/`categories`/`elevatorPitch`. Brand-service had refactored `/internal/brands/:id` (and `/internal/brands?ids=`) to a minimal `{ id, domain, url, name, logoUrl, createdAt, updatedAt }` shape months ago — none of the extras are returned and `brandUrl` is now just `url`. Dashboard's old type silently rotted; `brand?.brandUrl` resolved to `undefined`, `resolvedBrandUrl = ""`, Go button stayed disabled on campaign creation even with a budget typed in. The matching `?? ""` silent-fallback at the use site is what hid this for so long. Two lessons: (a) when an endpoint is refactored in another repo, the consumer-side type isn't auto-invalidated — schedule a periodic re-check of long-lived response types against the live registry, not just at type-creation time. (b) calling `mcp__api-registry__call_api` (or the brand-service direct `/internal/brands/:id`) is faster and more accurate than reading source from a local clone of the upstream repo — local clones go stale and a subagent inspecting them will confidently report the wrong wire shape. Live > source > local clone.

When an investigator subagent reports on a different repo's wire shape, prefer the live MCP call (`mcp__api-registry__call_api` or `mcp__api-registry-staging__call_api`) as the verification step before trusting the report. The investigator's local clone may be behind `origin/main` and surface an obsolete schema.

### No Fallbacks — Fail Visibly

NEVER add fallback logic (|| alternatives, silent defaults, graceful degradation) when data is missing or doesn't match. Instead, log a clear `console.error` with the mismatched value and context so the bug surfaces immediately. If a required field is absent, show an error UI — don't hide the problem. This applies everywhere: lookups, field resolution, display logic.

**Exception — Vercel build-time prerender steps.** During `next build` static generation (sitemap.ts, generateStaticParams, dynamic OG routes), an unhandled throw aborts the entire deploy, not just the failing page. When the failure mode is data-shape (missing table, unreachable DB on a not-yet-migrated preview branch) rather than logic, prefer `try / console.error(loud) / continue with empty result` over throwing. The fix path is still to repair the data layer; the catch+log keeps the rest of the site shippable while you do. This applies ONLY to build-time prerender — runtime requests still follow the fail-loud rule. Incident 2026-05-22 (distribute.you#1120): sitemap.ts threw `relation "blog_articles" does not exist` during `/sitemap.xml` prerender, blocked the entire landing deploy across 16 pages. The existing `process.env.DATABASE_URL` guard checked the URL, not the schema; one missing table killed everything.

### React Query mutations: write the response to the cache, don't just invalidate

When a mutation returns the fresh entity (e.g. POST `/campaigns/{id}/stop` returns `{ campaign }` with the new status), write it into the single-entity cache via `queryClient.setQueryData(["entity", id], data)` instead of (or in addition to) `invalidateQueries`. The downstream GET endpoint can return 5xx, and with `placeholderData: keepPreviousData` an invalidate-then-failed-refetch leaves the cache holding the stale pre-mutation row. The user sees the button revert / status unchanged and concludes the click did nothing.

`invalidateQueries` is still correct for list caches the mutation cannot rebuild on its own (`["campaigns"]`, `["leads"]`, etc.) — there the upside of a fresh list outweighs the risk of a flaky GET, and the mutation has no full list to write.

Incident 2026-05-20 (distribute.you#1090): `useStopCampaign` only invalidated `["campaign", id]`. With api-service `GET /v1/campaigns/{id}` returning 500, single-click Stop appeared to do nothing — user had to click twice. Fix: `setQueryData(["campaign", id], data)` on success.

### Public marketing pages — SEO + AI-scraper rendering

For any public landing/marketing/docs page (anything under `apps/landing/`, `apps/sales-cold-emails-landing/`, `apps/docs/`), the default rendering strategy is **ISR + `unstable_cache` + edge cache**, NEVER Suspense streaming on indexable content.

Why: Next.js streaming SSR injects content into `<template>` blocks resolved by client-side JS. Googlebot (Chromium-headless) executes JS and sees the resolved content, but **AI scrapers (GPTBot, ClaudeBot, PerplexityBot, Bingbot AI, curl-like crawlers) parse raw HTML only** — they receive the skeleton fallback, not the data. Putting leaderboards, benchmarks, blog lists, stats behind `<Suspense>` kills AI Search indexing for the very content that earns AI Search traffic.

Concrete rules:

1. **No `<Suspense>` on indexable content.** Hero copy, h1/h2, body text, JSON-LD blocks, leaderboards, benchmark tables, blog cards, stats — all SSR-sync in the byte stream. Suspense reserved for user-specific, non-indexable widgets (logged-in dashboards, real-time counters, chat).
2. **Never combine `force-dynamic` with `revalidate`.** `force-dynamic` wins and ISR is silently disabled. Prefer ISR (`export const revalidate = N`) alone; let `unstable_cache` + graceful build-time empty-result handle the missing-config case.
3. **Calling `headers()` or `cookies()` in a page forces dynamic rendering** even with `revalidate` set. Drop them if the page can be ISR-prerendered (resolve hostname-dependent URLs from `NEXT_PUBLIC_*` env vars instead).
4. **Wrap every fetch / DB call used by a public page in `unstable_cache`** with explicit tags. Edge cache (`s-maxage / stale-while-revalidate`) provides instant HTML; `unstable_cache` provides instant data on the rebuild after invalidation. Both stack.
5. **Invalidate via `revalidateTag(tag, profile)`** in the publish/update flow (webhooks, admin forms). Next 16.2+ requires the 2nd arg `profile: 'default' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'max' | CacheLifeConfig`. Pass `"default"` for ordinary invalidations.
6. **`unstable_cache` at module top level breaks vitest** because the wrapping runs at import time before `vi.doMock` can intercept. Mock `next/cache` globally via `apps/landing/tests/setup.ts` (`unstable_cache` → pass-through identity, `revalidatePath` / `revalidateTag` → `vi.fn()`); declare `setupFiles: ["tests/setup.ts"]` in `vitest.config.ts`.
7. **Validate scraper output after any caching change** with `apps/landing/scripts/seo-snapshot.sh [BASE_URL]` (counts `<h1>`, `<h2>`, `<article>`, JSON-LD blocks under a `GPTBot` user-agent) and `apps/landing/scripts/measure-ttfb.sh [BASE_URL]` (warm/cold TTFB per route). Both pre- and post-change snapshots in the PR description.

Incident 2026-05-24 (distribute.you#1153): pre-refactor, `/blog` TTFB was 1.5–2.3s because `force-dynamic` overrode `revalidate = 60` and every visit hit Neon directly. `/benchmarks` was dynamic because `headers()` was called for hostname resolution. `/investors` took 6–8s end-to-end because metrics were `cache: "no-store"`. Three loading.tsx files existed but were never reachable (page components weren't async-suspended). Single PR flipped 8+ routes from `ƒ Dynamic` to `○ Static` ISR with `unstable_cache` + tag invalidation; no Suspense or skeleton was added on any indexable content.

### Dynasty-First Display Rule (Workflows Only)

Always display `dynastyName` for workflows, never the versioned name. The only exception is settings/debug panels where the specific version matters — there, show the version number and versioned name alongside the dynasty name. This applies to page titles, table rows, cards, breadcrumbs, and any user-facing text.

Note: Features no longer have dynasty concepts. Features use `slug` and `name` directly.
