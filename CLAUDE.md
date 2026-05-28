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

**Next 16 `next lint` + `pnpm --filter` is broken.** `pnpm --filter @distribute/dashboard lint` fails with `Invalid project directory provided, no such directory: apps/dashboard/lint` — Next 16 misreads the forwarded script name as a positional dir arg. Run from the package dir instead: `cd apps/dashboard && npx next lint`. Direct invocation is clean (0/0). Same pattern applies to other Next apps in this repo.

**Shared workspace packages must be built before app tests/build.** Vitest + Vite resolve workspace deps via their `dist/` (per `package.json` exports), so an unbuilt `shared/*` package surfaces as `Failed to resolve entry for package "@distribute/<name>"` in unrelated test files. Run `pnpm -r build` (or `pnpm --filter @distribute/<name> build`) once after `pnpm install` or after pulling changes that touch `shared/`.

## Release flow (distribute.you specifics)

This monorepo does NOT use `release.sh hotfix` (the user-level release script targets Railway-deployed services with semver tags). Vercel deploys this repo on every `main` merge — no tag, no bump.

- **Hotfix** → branch from `origin/main`, PR target `main`, ship with `gh pr merge --auto --squash` (or hold for deploy-ordering blockers).
- **Bugfix / Feature** → branch from `origin/staging`, PR target `staging`, ship with `gh pr merge --auto --squash`. Promotion to `main` happens via the existing staging→main PR flow.
- **Observed exception (`apps/dashboard/` and `apps/landing/` only):** dashboard-only and landing-only PRs have been merging straight to `main` in recent practice (see #1146–1151, #1175, #1186). When touching ONLY those two app dirs, follow the convention of the last 5 merges on the file you're editing; when in doubt, ship to `staging` per the rule above. Cross-cutting changes (shared/, packages/, multi-app) MUST go through staging.
- **Base-branch prerequisite check (MANDATORY before `git checkout -b … origin/staging`).** If the feature builds on code that recently merged to `main` but has not yet been promoted to `staging` (typical for dashboard work given the exception above), the new branch MUST be cut from `origin/main` instead. Cheap check: `git log origin/main ^origin/staging -- <prerequisite-path>` — if it returns any commits, your prereq is missing on staging. Skipping this check silently produces "files don't exist" failures mid-execution and forces a `git stash + branch-recreate` recovery. Incident 2026-05-25 (distribute.you#1186): cut journalist manual-reply branch from staging by default; leads-side `EditLeadStatusModal` + `useManualQualifications` files were on main (#1175) but absent on staging. Required mid-execution recut to `origin/main` after `Glob` for the prerequisite returned no matches.

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

Incident 2026-05-28 (distribute.you#1213): `/campaigns/{id}/quote-pitches` + feature-level `/quote-pitches` crashed in prod with Next default global-error UI for active PR Expert user. Dashboard `QuotePitch` interface + `listQuotePitches` had been written against an aspirational shape (`{ pitches, total }` response, `pitchText` / `brandId` / `expertName` / `expertTitle` / `errorMessage` / `publishedUrl` / `publishedAt` / `selectedAt` fields, 6-value status enum, `brandId` query param). Deployed journalists-quotes-service GET `/orgs/quote-pitches` actually returns `{ quotePitches: [...] }` (no `total`), pitch shape uses `draft` / `brandIds[]` / `error` / `featuredArticleUrl` / `pitchCharCount` / `pitchAttempts` / `deliveryMethod`, 10-value status enum, `campaign_id` snake_case query param only. `data.pitches.length` threw `TypeError` at render, bubbled past every boundary into Next default global-error. **Three lessons**: (a) the existing "verify at type-creation time" rule isn't enough — when migrating a consumer of a service (here #1209 PR Expert HITL v0.8.1 migration touched `/orgs/opportunities/*` + removed `/draft`), audit ALL of that service's deployed endpoints in registry, not just the ones the migration touches. Adjacent endpoints rot in the same upstream refactor window. (b) `listQuoteRequests` + `listRankedOpportunities` survived this incident because they Zod-`safeParse` the response and throw on mismatch — the throw converts wire-shape-rot from a render-throw into a React Query error caught + shown as fetch error. `listQuotePitches` + `getQuotePitch` did NOT have safeParse → crashed. **Default to Zod safeParse on every list/get `apiCall<...>` wrapper that talks to an external service.** Per-field schemas live in the same file; cost is low, payoff is the difference between "page goes blank" and "page shows error state with stack". (c) Public report tree has `apps/dashboard/src/app/report/[orgId]/[brandId]/[featureSlug]/error.tsx` since 2026-05-25; authed dashboard tree did not until #1213. **Every authed Next app shell needs a route-segment `error.tsx` boundary.** Default Next global-error UI ("This page couldn't load. Reload to try again, or go back.") hides the root cause and forces hours of static analysis for what would be 30 seconds with the stack. New `apps/dashboard/src/app/(authed)/(dashboard)/error.tsx` mirrors the report-tree pattern.

### No Fallbacks — Fail Visibly

NEVER add fallback logic (|| alternatives, silent defaults, graceful degradation) when data is missing or doesn't match. Instead, log a clear `console.error` with the mismatched value and context so the bug surfaces immediately. If a required field is absent, show an error UI — don't hide the problem. This applies everywhere: lookups, field resolution, display logic.

**Exception — Vercel build-time prerender steps.** During `next build` static generation (sitemap.ts, generateStaticParams, dynamic OG routes), an unhandled throw aborts the entire deploy, not just the failing page. When the failure mode is data-shape (missing table, unreachable DB on a not-yet-migrated preview branch) rather than logic, prefer `try / console.error(loud) / continue with empty result` over throwing. The fix path is still to repair the data layer; the catch+log keeps the rest of the site shippable while you do. This applies ONLY to build-time prerender — runtime requests still follow the fail-loud rule. Incident 2026-05-22 (distribute.you#1120): sitemap.ts threw `relation "blog_articles" does not exist` during `/sitemap.xml` prerender, blocked the entire landing deploy across 16 pages. The existing `process.env.DATABASE_URL` guard checked the URL, not the schema; one missing table killed everything.

### React Query mutations: write the response to the cache, don't just invalidate

When a mutation returns the fresh entity (e.g. POST `/campaigns/{id}/stop` returns `{ campaign }` with the new status), write it into the single-entity cache via `queryClient.setQueryData(["entity", id], data)` instead of (or in addition to) `invalidateQueries`. The downstream GET endpoint can return 5xx, and with `placeholderData: keepPreviousData` an invalidate-then-failed-refetch leaves the cache holding the stale pre-mutation row. The user sees the button revert / status unchanged and concludes the click did nothing.

`invalidateQueries` is still correct for list caches the mutation cannot rebuild on its own (`["campaigns"]`, `["leads"]`, etc.) — there the upside of a fresh list outweighs the risk of a flaky GET, and the mutation has no full list to write.

Incident 2026-05-20 (distribute.you#1090): `useStopCampaign` only invalidated `["campaign", id]`. With api-service `GET /v1/campaigns/{id}` returning 500, single-click Stop appeared to do nothing — user had to click twice. Fix: `setQueryData(["campaign", id], data)` on success.

### Dashboard data fetching — ONE framework (homogeneous SWR via React Query v5)

Stack: TanStack React Query v5 on every client component. No SWR. No mixing. Server components for the shell only; everything interactive uses `useAuthQuery` / `useMutation`.

**Global config (`apps/dashboard/src/lib/query-provider.tsx`) — single source of truth:**
- `staleTime: 60_000` (1 min). Default `0` causes flash on every mount/window-focus.
- `gcTime: 5 * 60_000`.
- `placeholderData: keepPreviousData` (GLOBAL). Stale data stays on screen during refetch — true stale-while-revalidate. Never re-set per query.
- `refetchOnWindowFocus: true`, `refetchOnReconnect: true`.
- `retry: 1` (queries), `retry: 0` (mutations).

**Shared poll cadences (`apps/dashboard/src/lib/query-options.ts`):**
- `pollOptions` → 5s (default for active pages).
- `pollOptionsSlow` → 10s (quote-pitches, quote-requests, press-kits).
- `pollOptionsSlower` → 30s (visibility-runs, low-frequency).
- Import + pass to `useAuthQuery(..., pollOptions)`. Never declare a local `const pollOptions`.

**V5 status flags — render rule:**
- `isPending` → no data ever → render SKELETON.
- `isLoading` (= `isPending && isFetching`) → equivalent for initial load → render SKELETON.
- `isFetching && !isPending` → background refetch with cached data → render CONTENT, never skeleton.
- Skeleton condition is exclusively the "no data" case. Background refetches are SILENT — no top-bar, no spinner, no flash. Modern SWR philosophy: stale-while-revalidate is invisible by design (matches Linear, Vercel, GitHub). User-initiated refresh / mutations still surface via button-scoped spinners.

**Page composition:**
- Shell + nav + header render INSTANTLY (no query gates them).
- Each card/section owns its own `useAuthQuery` + skeleton. Parallel, never cascaded unless data truly depends.
- Skeleton must match the real layout (heights, columns) — zero layout shift on resolve.
- Spinner only for button-scoped actions (Save, Send). Never for content.
- `<Suspense>` is NOT used in dashboard pages (use `isPending` checks). Reserved for public marketing pages only.

**Mutations (extends incident #1090):**
- If the mutation returns the new entity → `queryClient.setQueryData(["entity", id], response)` FIRST.
- THEN `invalidateQueries({ queryKey: listKey })` for any list cache the mutation cannot rebuild.
- Return the invalidation promise from `onSuccess` so the button stays loading until lists refresh.

**Forbidden patterns:**
- Local `const pollOptions = {...}` (use shared module).
- `refetchIntervalInBackground: false` (it's the v5 default — drop).
- `placeholderData: keepPreviousData` in per-query options (now global default — drop).
- Skeleton on `isFetching` when data exists.
- `<Suspense>` for any dashboard content.

Incident 2026-05-26 (distribute.you): user reported "data flashes in/out and components arrive at staggered times" across the dashboard. Root cause was a combination of (a) no global `placeholderData: keepPreviousData`, so v5 dropped cached data to `undefined` on every refetch, and (b) 21 page files declaring redundant local `pollOptions` constants that drifted (3 included `keepPreviousData`, 18 omitted it). Fixed by lifting `keepPreviousData` to the global default + collapsing all pollOptions to a 3-variant shared module + dropping all `refetchIntervalInBackground: false` (default in v5).

Incident 2026-05-27 (distribute.you): initial fix shipped a faint top-bar `useIsFetching()` indicator as a "background-refresh affordance". User reported the bar flashed every ~5s on every poll cycle ("chiant de voir ça toutes les 5 secondes"). The affordance was the wrong default — modern SWR UX (Linear, Vercel, GitHub) keeps background refetches fully invisible because the cached content stays on screen the whole time. The top-bar was deleted; the rule was changed from "only background-refresh affordance" to "background refetches are SILENT". Skeletons remain for initial load; button spinners remain for mutations.

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

### Landing voice — sell scale, not solitude

The ICP (`/investors` page, "The Serial Builder") is a solo / 1–3-person team running 3–10 products in parallel. That's accurate audience targeting — keep "solo founder" as an SEO keyword and as the user persona we write for. **But never celebrate the solo lifestyle in landing copy.** The dream we sell is variable CAC + measurable channels + $1M MRR scale, NOT "you can stay alone forever". Phrases like "Stay solo. Go big.", "ride one product from $0 to $1M MRR — solo", "you don't need a team" are demotivating to a founder who actually wants to grow, and they undersell the platform — the value isn't headcount minimalism, it's CAC visibility per channel × per product across a portfolio. The investors-page dream quote stays explicit: "whether I stay 1 person or grow to 10." Match that framing everywhere customer-facing. Incident 2026-05-24 (distribute.you#1162): rewrote the landing "Stay solo. Go big." section to "Ship more. Scale what works.", merged the two paragraphs, and reframed the investors dream quote around CAC actionability.

### Landing logo discipline — borrow trust from upstream providers

distribute is the "Stripe of Distribution" — a thin wrapper over Apollo, Anthropic, Resend, LinkedIn, Muck Rack, Featured, Adobe, Gartner, etc. Wherever a provider, source, or upstream tool is named on a public marketing page, show its logo via the shared `apps/landing/src/components/provider-avatar.tsx` (`logo.dev` with `NEXT_PUBLIC_LOGO_DEV_TOKEN`, initial-letter fallback). Workflow primitives, channel cards, sourced stats, "under the hood" strips, study citations — all get logos. Borrowed trust is the moat: a user who already trusts Apollo / Claude / Resend will trust the same primitives orchestrated by distribute. NEVER hand-roll an SVG of a known provider's logo, NEVER ship the initial-letter fallback as the intended UI — set the env token in every env (preview, prod) and surface a build-time warning if it's missing. New provider mappings for the Channels grid live in `apps/landing/src/data/feature-providers.ts`; add an entry whenever a new feature lands so the grid card shows the provider stack. Stat-card / study-card mappings live next to the data (`SourcedStat.providerDomain`, `ExternalStudy.providerDomain`).

### Dynasty-First Display Rule (Workflows Only)

Always display `dynastyName` for workflows, never the versioned name. The only exception is settings/debug panels where the specific version matters — there, show the version number and versioned name alongside the dynasty name. This applies to page titles, table rows, cards, breadcrumbs, and any user-facing text.

Note: Features no longer have dynasty concepts. Features use `slug` and `name` directly.
