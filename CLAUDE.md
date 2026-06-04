# Project: MCP Factory

DFY (Done-For-You), BYOK (Bring Your Own Keys) automation platform on MCP. User gives URL + budget; the platform handles lead finding, outreach, email generation, reporting.

## Commands

```bash
pnpm dev                    # All services via Turbo
pnpm dev:dashboard          # Dashboard only (Next.js, port 3001)
pnpm dev:<service-name>     # Any individual service
pnpm build                  # Build all (Turbo-orchestrated)
pnpm lint                   # Lint all packages
pnpm generate:readme        # Regenerate README.md from shared/content

# Per-package testing — scripts use `test`/`test:unit`, NOT `vitest` directly
pnpm --filter @distribute/<package> test                              # all tests
pnpm --filter @distribute/<package> test:unit                         # unit only
pnpm --filter @distribute/<package> test tests/unit/specific.test.ts  # single file
```

**Verify frontend with `tsc --noEmit`, NOT lint — `next lint` is GONE in Next 16.** Any `next lint` invocation reads `lint` as a directory arg and fails; no standalone `eslint` binary in the repo. Real check: `cd apps/<app> && node_modules/.bin/tsc --noEmit -p tsconfig.json` (dashboard has ~3 pre-existing test-file `TS1501` regex errors — ignore, only care about your files). (#1223)

**Don't trust RTK's `next build` summary** — the hook replaces stdout with a `Errors: N | Warnings: M` one-liner that can be wrong (phantom `Errors: 1` on a clean run). Real run: `rtk proxy -- npx next build` (the `--` is required), trust the log + exit code.

**Build shared workspace packages before app tests/build.** Vitest/Vite resolve workspace deps via `dist/`; an unbuilt `shared/*` surfaces as `Failed to resolve entry for package "@distribute/<name>"`. Run `pnpm -r build` after install or after pulling `shared/` changes.

**Source-substring page tests: a `not.toMatch(/X/)` guard trips on the fix's own explanatory comment** (a comment that writes the forbidden literal fails the test). Reword the comment, or assert against a comment-stripped copy (`pr-expert-public-report.test.ts` ships `stripComments(src)`). (#1235, DIS-112)

**Run `pnpm --filter @distribute/dashboard test` before pushing a dashboard change — `tsc` alone misses source-substring guards** (many tests assert a page contains a literal expression/copy string). `tsc` stays green while the guard goes red in CI and silently blocks auto-merge. Run it (~3s, source-only) and update the matching guard in the same commit. (#1252)

## Dashboard UI iteration — real page + Vercel preview, not a standalone mockup

Default: edit the real page with the existing component vocabulary (`bg-white rounded-xl border border-gray-200` cards, `focus:ring-brand-300` inputs, brand-500, `SparklesIcon`, `SectionCard`/`ScoreCard`, the `bg-brand-50`+`border-brand-200` segmented toggle) and push for a Vercel preview. A standalone HTML mockup reads as "page vierge" and gets bounced — acceptable only as a fast layout sketch when explicitly asked, graduate to the real page ASAP. Dashboard project `distribute-dashboard` (`prj_nJn9Xr5D1fD5h7ug3eRPejEGsg2z`, team `team_lYmJIUH6q2rTY6dUfDiYtpAt`), preview alias `distribute-dashboard-git-<branch-hash>-blooming-generation.vercel.app`; find it via Vercel MCP `list_deployments` (query the dashboard project directly). When rewriting a section, inventory existing interactive affordances (AI panels, billing guard, "Edit with AI" → `CampaignAIPanel`) and preserve them — silently dropping one is a regression. (#1239, #1242)

## Release flow (distribute.you specifics)

No `release.sh hotfix` here (that targets Railway semver services). Vercel deploys on every `main` merge — no tag, no bump.

- **Hotfix** → branch from `origin/main`, PR → `main`, `gh pr merge --auto --squash`.
- **Bugfix / Feature** → branch from `origin/staging`, PR → `staging`. Promotion to `main` via the staging→main PR flow.
- **Exception (`apps/dashboard/` + `apps/landing/` only):** dashboard-only and landing-only PRs merge straight to `main` in recent practice. Touching ONLY those dirs → follow the last 5 merges on the file; when in doubt, staging. Cross-cutting (shared/, packages/, multi-app) MUST go through staging.
- **The protect-main hook allows dashboard→main ONLY while the branch descends from `origin/main`.** `origin/main` drifts as you work → hook flips to deny. Fix: `git fetch origin main && git merge origin/main --no-edit` (NOT rebase — force-push is blocked; a merge keeps the push fast-forward), confirm `git merge-base --is-ancestor origin/main HEAD`, push the same explicit refspec, then `gh pr create --base main`. Squash collapses the merge commit. Don't retarget staging (it's ~140 commits behind for dashboard work). (#1288)
- **Cut a NEW branch off `origin/main` before each change — never commit onto the just-merged branch.** `git fetch origin main && git checkout -b KevinLourd/<topic> origin/main`. Recovery if you slip: `git checkout -b <new> origin/main && git cherry-pick <sha>`. The branch tracks `origin/main` → push explicit refspec `git push origin HEAD:refs/heads/X` to dodge the hook. (#1248)
- **Base-branch prerequisite check before `checkout -b … origin/staging`:** if the feature builds on code merged to `main` but not yet promoted to `staging` (typical for dashboard), cut from `origin/main`. Check: `git log origin/main ^origin/staging -- <path>` returns commits → prereq missing on staging. (#1186)

## Architecture

**Monorepo** — pnpm workspaces + Turborepo. Roots: `apps/`, `packages/`, `shared/`.

**Apps:** `apps/dashboard/` (port 3001, Next.js 15 App Router, Clerk) · `apps/docs/` · `apps/landing/` · `apps/sales-cold-emails-landing/`.

**Extracted services (separate repos):** [api-service](https://github.com/shamanic-technologies/api-service) · [mcp](https://github.com/shamanic-technologies/mcp).

**Packages (published MCP servers, tsup ESM):** mcp-sales-outreach · mcp-google-ads · mcp-influencer-pitch · mcp-journalist-pitch · mcp-podcaster-pitch · mcp-reddit-ads · mcp-thought-leader (all `@distribute/*`).

**Shared libs:** `shared/auth` · `shared/content` · `shared/pictures` · `shared/runs-client` · `shared/types`.

**Content sync:** all marketing/docs content lives in `shared/content/src/` (`urls.ts`, `mcps.ts`, `pricing.ts`, `features.ts`, `brand.ts`); public surfaces import `@distribute/content`. When changing: update src → `pnpm generate:readme` → verify build → commit the regenerated README. **README.md is GENERATED — never edit directly.**

### Missing Backend Fields

If the dashboard needs a field/endpoint/capability the backend doesn't provide, NEVER work around it client-side (regex, slugify, name-derivation, aggregation heuristics). Draft a message for Kevin to forward to the backend team and block on the change.

### Verify backend shape before writing client types (wire-shape rot)

**Deployed openapi is ground truth. Before declaring ANY typed helper (`listX`/`getX`/response interface/Zod schema) for a backend endpoint, fetch the real shape via the `api-registry` / `api-registry-staging` MCP.** Never invent from "what feels right" or an aspirational PR description. **Live (MCP `call_api`) > source > local clone** — local clones (incl. a subagent's) go stale; verify a subagent's reported wire shape via the live MCP. Want a richer shape → file a backend request and block. Long-lived types rot silently when an upstream endpoint is refactored — re-check periodically, not just at creation. (#1079, #1094)

Sub-classes (all invisible to a "page loads" smoke test):
- **Data existing in SOME backend service ≠ the dashboard can reach it — `api-service` (the gateway) must PROXY the path first; confirm before scoping a consumer-only PR.** The dashboard only talks to `api-service` via `/api/v1`; a `/orgs/*` route owned by another service (e.g. a freshly-imported `ahref-service`) is unreachable until the gateway adds a transparent-proxy route. The registry `api` service lists ZERO endpoints (passthrough — the index doesn't enumerate its proxy table) and full-text search doesn't index downstream paths, so neither tells you whether the gateway forwards it. 30-sec probe — a live gateway call `mcp__api-registry__call_api(service:"api", GET "/v1/<path>")`: **404 "Not found" = route ABSENT** (CROSS-REPO: needs a new `api-service` proxy route + likely new `<SVC>_SERVICE_URL`/`_API_KEY` Railway vars before the dashboard can consume it) · **401 "Missing authentication" = route PRESENT** (reachable). Confirm via `git -C ~/conductor/repos/api-service grep "orgs/<thing>" origin/main`. Treating producer-shipped as dashboard-reachable turns a 1-PR task into a 3-part rollout. (#1299, DIS-200/212)
- **Audit ALL of a service's endpoints when migrating a consumer**, not just the ones the migration touches — adjacent endpoints rot in the same refactor window. (#1213)
- **`safeParse` every list/get `apiCall<…>` wrapper** that talks to an external service (per-field schemas in the same file) — converts wire-rot from a render-crash into a caught fetch-error. **Per-VERB schema:** a write response DTO is often NARROWER than its read sibling (omits computed fields like `isDefault`/`updatedAt`/counts) — reusing one schema turns every successful write into a false "invalid response shape". Too-loose → bad data renders + crashes (#1213); too-strict shared schema → false error on success (#1221, `.omit({ isDefault: true })`).
- **A too-narrow consumer `z.object()` SILENTLY STRIPS a newly-added backend field** (Zod drops undeclared keys) → `field` reads `undefined` at the call site though it's on the wire. Adding the TS type is not enough — add it to the Zod schema too. (#1282)
- **Free-form `variables`/`inputs` passthrough endpoints:** any JSON validates at the wire (TS/Zod can't catch); the variable-NAME contract is published separately as the template's `.variables` (`GET /v1/content/platform-prompts?type=<template>`). Map payload keys 1:1 or the model gets empty `{{...}}` and the failure is silent bad output (not a crash). Centralized in `lib/quote-pitch-variables.ts`. content-gen requires ALL declared vars non-empty (missing → 400) → thread a new OPTIONAL var as an EXTRA passthrough key or fold it into an existing free-form var, never as a new declared var. (#1215, #1280)
- **An openapi `description`'s PROSE (cache-key, "scoped by…", behavior) can lag the deployed CODE by months — treat as a hint, confirm against code/live before building a workaround.** A free-`string` field with `(e.g. 'x')` is NOT an enum and the example can be stale — verify actual values vs DB (`SELECT status, count(*)`), gate on the TERMINAL value (`!== "stopped"`) not an assumed running label. (#1268, #1280)
- **Every authed Next app shell needs a route-segment `error.tsx`** (`app/(authed)/(dashboard)/error.tsx`, mirrors the report tree) — default Next global-error UI hides the stack. (#1213)

**Public-report components (`components/report/*`, anything in the no-login `src/app/report/**` bundle) MUST NOT import `@/lib/api`** (the Clerk-authed client — no session on the public surface; guarded by `tests/pr-expert-public-report.test.ts`). Need a primitive from there → define it locally, or put shared pure logic in an api-free module (e.g. `lib/batch-quote-reply.ts`). (#1294)

### No Fallbacks — Fail Visibly

NEVER add fallback logic (`||` alternatives, silent defaults, graceful degradation) when data is missing/mismatched. Log a loud `console.error` with the value + context; show an error UI for a missing required field. Applies everywhere (lookups, field resolution, display). **Exception — Vercel build-time prerender** (sitemap.ts, generateStaticParams, OG routes): an unhandled throw aborts the whole deploy, so for data-shape failures prefer `try / console.error / continue empty` over throwing; fix the data layer but keep the site shippable. Runtime requests still fail loud. (#1120)

### React Query mutations: write the response to the cache, don't just invalidate

Mutation returns the fresh entity → `queryClient.setQueryData(["entity", id], data)` (not just `invalidateQueries`). The GET can 5xx, and with `placeholderData: keepPreviousData` an invalidate-then-failed-refetch leaves the stale pre-mutation row → user thinks the click did nothing. `invalidateQueries` still correct for LIST caches the mutation can't rebuild (`["campaigns"]`, `["leads"]`). (#1090)

### Dashboard data fetching — ONE framework (React Query v5 SWR)

TanStack React Query v5 on every client component. No SWR, no mixing. Server components for the shell only.

**Global config (`src/lib/query-provider.tsx`):** `staleTime: 60_000` · `gcTime: 30min` (= persister `maxAge`, see below) · `placeholderData: keepPreviousData` (GLOBAL — never re-set per query) · `refetchOnWindowFocus/Reconnect: true` · `retry: 1` queries / `0` mutations.

**Poll cadences (`src/lib/query-options.ts`):** `pollOptions` 5s · `pollOptionsSlow` 10s (quote-pitches, quote-requests, press-kits) · `pollOptionsSlower` 30s (visibility-runs). Import + pass; never a local `const pollOptions`.

**V5 render rule:** `isPending`/`isLoading` (no data) → SKELETON. `isFetching && !isPending` (background refetch with cached data) → CONTENT, never skeleton. Background refetches are SILENT — no top-bar/spinner/flash (matches Linear/Vercel/GitHub). Button-scoped spinner only for mutations.

**Page composition:** shell+nav+header render instantly (no query gates them). Each card owns its `useAuthQuery` + skeleton, parallel. Skeleton matches the real layout (zero shift). No `<Suspense>` for dashboard content (public marketing only).

**Mutations:** `setQueryData(["entity", id], response)` FIRST, then `invalidateQueries(listKey)`; return the invalidation promise from `onSuccess`.

**Forbidden:** local `const pollOptions` · `refetchIntervalInBackground: false` (v5 default) · per-query `placeholderData: keepPreviousData` · skeleton on `isFetching` when data exists · `<Suspense>` for dashboard content · **a gate that ANDs a WARM section (warm-cache, e.g. `["features"]`) with a COLD sibling** — group at the finest coherent level, barrier WITHIN a group, independent ACROSS groups. (#1257)

**Coordinated reveal** (`src/lib/use-coordinated-reveal.ts`) — reveal a coherent all-cold group together in one paint, then keep it revealed (a poll / token rotation / transient error must not send a shown group back to skeleton). The reveal-layer analog of `keepPreviousData`.
- `useCoordinatedReveal(readyFlags: boolean[]): boolean` — barrier (false until every flag true once) + monotonic latch (true stays true for the mount). Call unconditionally at top level (uses `useRef`).
- One flag per query: `data !== undefined` or `!isPending`. **A disabled query stays `isPending` forever** — gate its flag `!enabled || !isPending`.
- **Group at the finest COHERENT level, nest coarse→fine** (body group ⊃ sidebar nav-items group ⊃ badge-numbers sub-group). Never span warm+cold.
- **Prepend an inputs-loaded flag (`defsReady`) FIRST** when queries are conditionally enabled off another query — else the first paint has every query disabled, every flag true, the barrier passes instantly and latches an EMPTY group. `useCoordinatedReveal([defsReady, ...flags])`. (#1260)
- **Gate each section on the query that produces ITS data, never a context's coarse `loading`.** A shared context's single `loading` often tracks only its primary query; the list a page renders (`emails`, `leads`) resolves later → gate on `emailsLoading`/`leadsLoading`. (#1264)
- **Sidebar primitives** (`context-sidebar.tsx`): gate a nav level on `defsReady` + render `SidebarNavRowSkeleton`; reveal count badges together via `badgePending={!badgesRevealed}` on `SidebarLink`. (#1261)
- **Standard for every multi-query surface** — page bodies + all data-dependent sidebar levels (`BrandLevelSidebar`, `CampaignSidebar`/`McpSidebar`, `WorkflowLevelSidebar`, `AppFeatureLevelSidebar`). Static-only nav levels need no gate. ~40 pages still un-adopted = a phased sweep (first-load stagger only; the return-flash is fixed globally by persistence) — do NOT bundle into a hotfix. (#1259/#1260/#1261, DIS-133)

### Monotonic status latch (`useMonotonicStatuses`) — status-tab tables must not flap on a poll

Keeps a per-row derived bucket across refetch (the only family member addressing a valid CHANGING success). A status-tab page derives each row's tab from a delivery/engagement overlay re-fetched every poll; a transient drop (status under a different shape, or empty) sends every row back to "Processing", leaving the viewed tab → the table empties then repopulates. `keepPreviousData`/coordinated-reveal can't fix it (valid 200, content legitimately changed).
- `src/lib/use-monotonic-status.ts` → `useMonotonicStatuses(entries: {id, status}[], priority, label?)`: a per-mount latch on the page's "most-advanced-first" priority (`LEAD_STATUS_ORDER`, or `STATUS_PRIORITY` from `outlet-status.ts`). Outreach is append-only (`contacted→sent→delivered→opened→clicked→replied`) so a less-advanced later poll is a stale read — keep the most-advanced, `console.error` the suppressed downgrade (fail-loud, real invariant). The returned Map is the single source for tabs + row badge + detail panel.
- **Rule:** every CLIENT-POLLED status-tab surface MUST latch via `useMonotonicStatuses`. Static/ISR tables aren't susceptible. Wired into all 9 (feature/campaign/brand × leads/journalists/outlets) + added missing `safeParse` on `listBrandLeads`/`listCampaignLeads`. (#1270, DIS-149)

### Persisted query cache (`PersistQueryClientProvider`) — return to a page shows content INSTANTLY

4th "don't revert resolved state on a transient" layer; the only one that survives cache EVICTION (the first three keep warm-in-memory state across refetch only): 1. `keepPreviousData` (data) · 2. `useCoordinatedReveal` (reveal decision) · 3. `useMonotonicStatuses` (row bucket). None survive eviction (`gcTime` drop, reload, new tab) → cold full-screen skeleton.

Fix: persist the cache to client storage, restore on mount (industry consensus — TanStack/SWR both ship persistence; Linear goes local-first). Global change in `src/lib/query-provider.tsx`: `PersistQueryClientProvider` + `createSyncStoragePersister` (localStorage, sync restore = zero-frame). Helpers in `src/lib/persist-cache.ts` (`shouldPersistQuery`/`persisterStorageKey`/`cacheBuildId`), unit-tested.

**Five load-bearing rules:**
- **`gcTime` ≥ persister `maxAge`, both 30min** (`PERSIST_MAX_AGE_MS`). `gcTime < maxAge` → GC evicts before restore (TanStack #5169). But `gcTime` also bounds in-memory retention of every inactive query — NOT huge (24h kept multi-MB lists in the heap a day = the overflow). Tight: 30min.
- **Org-scope the storage KEY** (`distribute-dashboard-cache:{orgId}`) — query keys aren't org-scoped yet (DIS-143); a shared bucket restores org A's data under org B. **No-op while `orgId` is null** (gate `storage` on `orgId` truthy, not just `window`) — the `cache:anon` fallback bucket is the same cross-org bleed one layer down. (#1279)
- **`buster` = build id** (`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "dev"`) — a deploy busts stale shapes.
- **`retry: removeOldestQuery`** — handles the ~5MB quota (`QuotaExceededError`), NOT the per-write CPU (`dehydrate()` re-serializes the whole set on every mutation, TanStack #9775). Real defense = the allowlist.
- **`shouldDehydrateQuery` = success + non-sensitive + ALLOWLISTED (`PERSISTABLE_QUERY_ROOTS`).** Default OFF. Persist ONLY small slow-changing roots (nav/config/metadata/counters). EXCLUDE big/5s-polled lists (leads, emails, journalists, outlets, articles, opportunities, pitches, media-kits, runs, cost-breakdowns — re-serialize every poll, stale before restore) and secrets (`apiKeys`/`byokKeys`/`keySources` via `SENSITIVE_QUERY_ROOTS` — key material never on disk).

**Rule:** persistence is GLOBAL — don't add a second provider or a per-page persister. Restore a query instantly → add its root to `PERSISTABLE_QUERY_ROOTS` only if small AND slow-changing. Secret → `SENSITIVE_QUERY_ROOTS`. Change `gcTime` → keep ≥ `maxAge` AND tight. SSR guard (`window` undefined → no-op persister). (#1273; memory-overflow correction #1278/DIS-170 — 24h + persist-everything was wrong, allowlist + 30min fixed it; TanStack #9775 = don't persist large/volatile caches.)

### Public marketing pages — SEO + AI-scraper rendering

Public landing/marketing/docs (`apps/landing/`, `apps/sales-cold-emails-landing/`, `apps/docs/`): default **ISR + `unstable_cache` + edge cache**, NEVER Suspense streaming on indexable content. AI scrapers (GPTBot, ClaudeBot, PerplexityBot, Bingbot AI) parse raw HTML only — a Suspense fallback means they index the skeleton, not the data.
1. No `<Suspense>` on indexable content (hero, h1/h2, body, JSON-LD, leaderboards, tables, blog cards, stats — SSR-sync). Suspense only for user-specific non-indexable widgets.
2. Never combine `force-dynamic` with `revalidate` (force-dynamic wins, ISR silently off). Prefer ISR (`export const revalidate = N`) alone.
3. `headers()`/`cookies()` in a page forces dynamic rendering — drop them, resolve hostname from `NEXT_PUBLIC_*`.
4. Wrap every fetch/DB call in `unstable_cache` with explicit tags.
5. Invalidate via `revalidateTag(tag, profile)` — Next 16.2+ requires the 2nd arg (`"default"` for ordinary invalidations).
6. `unstable_cache` at module top level breaks vitest — mock `next/cache` globally in `tests/setup.ts` (identity pass-through; `revalidate*` → `vi.fn()`), declare `setupFiles` in `vitest.config.ts`.
7. Validate scraper output after any caching change: `apps/landing/scripts/seo-snapshot.sh` + `measure-ttfb.sh`; pre/post snapshots in the PR. (#1153)

### Public pages — no horizontal overflow on mobile

Every public app ships **`html { overflow-x: clip }`** in `globals.css` — never `overflow-x: hidden` (`hidden` makes html/body a scroll container, breaks `position: sticky`; `clip` doesn't). It's a safety net, NOT the fix — real spills are fixed at the element level. Wide legit content (code, perf tables) scrolls internally via its own `overflow-x-auto` (else `clip` HIDES it). Decorative `absolute -inset-N` glows must stay in-viewport: a full-bleed component whose `max-w-*` box reaches the edge bleeds the glow past it → body scroll; keep every home-page component inside the standard `max-w-* mx-auto px-4 sm:px-6 lg:px-8` container. Verify with `apps/landing/scripts/overflow-audit.mjs [BASE_URL] [--app=landing|sales|docs]` (headless Playwright at 360/390/414px, separates escaping spills from contained); subagent/static analysis is NOT reliable for overflow. (#1284)

### Landing voice — sell scale, not solitude

The ICP ("The Serial Builder", `/investors`) is a solo / 1–3-person team running 3–10 products — keep "solo founder" as an SEO keyword + persona. **But never celebrate the solo lifestyle in copy** ("Stay solo. Go big.", "$0→$1M MRR solo", "you don't need a team" demotivate a founder who wants to grow + undersell the platform). The dream we sell = variable CAC + measurable channels per product across a portfolio. The investors dream quote stays "whether I stay 1 person or grow to 10." (#1162)

### Landing logo discipline — borrow trust from providers

distribute = "Stripe of Distribution" (thin wrapper over Apollo, Anthropic, Resend, LinkedIn, Muck Rack, Featured, Adobe, Gartner…). Wherever a provider/source/tool is named on a public page, show its logo via `apps/landing/src/components/provider-avatar.tsx` (`logo.dev` + `NEXT_PUBLIC_LOGO_DEV_TOKEN`, initial-letter fallback). NEVER hand-roll a provider SVG, NEVER ship the initial fallback as the intended UI — set the token in every env. New Channels-grid mappings in `apps/landing/src/data/feature-providers.ts`; stat/study mappings via `SourcedStat.providerDomain` / `ExternalStudy.providerDomain`.

### Feature maturity gating (alpha / beta / ga) — dashboard

Immature features stay in prod but are hidden from non-staff via **PostHog feature flags**, NOT `NODE_ENV`. `alpha` → staff only (flag on person-property `email = kevin.lourd@gmail.com`) · `beta` → opt-in cohort · `ga` → everyone, NO flag.
- Single source: `src/lib/feature-gates.ts` `FEATURE_GATES` (surface key → `{ flag, maturity }`). Flag name `<maturity>-<surface>`.
- `useFeatureFlag(flag): boolean` (`src/lib/use-feature-flag.ts`) — **default-hidden** (false until PostHog loads → no flash); subscribes `posthog.onFeatureFlags` to re-resolve after `identify`.
- `<MaturityBadge level>` (`src/components/maturity-badge.tsx`) — amber alpha / violet beta.
- Pattern: call `useFeatureFlag` at component top (hooks rule), gate the render, attach the badge:
```tsx
const ok = useFeatureFlag(FEATURE_GATES["services-crm"].flag);
{ok && <SidebarLink item={{ ..., maturity: FEATURE_GATES["services-crm"].maturity }} />}
```
- Graduation = widen flag targeting in the PostHog UI (no redeploy). Flags created/edited via PostHog MCP (`mcp__posthog__exec` → `create/update-feature-flag`). "Disappear for everyone" = hard JSX removal, NOT a flag defaulted-off.
- Live flags: `alpha-services-crm` (195453), `alpha-keys` (195454), `alpha-brand-info` (195479, Brand Info), `alpha-brand-features` (195480, every feature except GA exceptions). GA-exception slugs in `feature-gates.ts` → `GA_BRAND_FEATURES` (`pr-cold-email-outreach`, `sales-cold-email-outreach`), consumed by both `BrandLevelSidebar` + `brands/[brandId]/page.tsx`.

### Auth / first-run gating — key on the real product signal, NOT org existence

**Routing/auth decisions belong at the EDGE (`proxy.ts`) via JWT claims — pre-paint, zero fetch. SWR is for DATA, never routing.** This governs EVERY landing/default redirect (onboarding, "last-visited brand", any "bare URL → entity" default): the FIRST move is the edge, not a client page. Remembered state goes in a **server-readable cookie** (the edge reads it pre-paint), NOT localStorage (client-only → client round-trip → flash). A client `useEffect`+fetch+`router.push` is the flash anti-pattern. A bounded client fallback is OK only where no remembered state exists yet (nothing to flash). (#1298: org-scoped `httpOnly` `last-brand-{orgId}` cookie set on brand URLs in `proxy.ts`, bare `/orgs/:orgId` redirects on it; the org Overview page is now an empty-org-only fallback — `return null` + redirect to last/first brand whenever the org has ≥1 brand. Don't restore an org-overview-first landing.)

**Don't gate on org existence** — a Clerk org is auto-created at signup, so `if (!hasOrg) router.push("/onboarding")` never fires. (#1229, DIS-91: 0 onboarding pageviews in 60d.)

**Current architecture (#1236, DIS-111):** the durable signal is `org.publicMetadata.onboardingComplete`, set on first brand via the in-repo server route `/api/onboarding/complete` (dashboard has `CLERK_SECRET_KEY`; `publicMetadata` is writable server-side, not from the browser). Surfaced as session claim `orgMeta = {{org.public_metadata}}`; `proxy.ts` redirects to `/onboarding` when `sessionClaims.orgMeta?.onboardingComplete !== true`. The same `orgMeta`/`email`/`firstName`/`lastName` claims drop the proxy's per-request `currentUser()`.

**Edge-claim gate migration — 3 traps:** (a) **Backfill** every existing entity that should pass BEFORE shipping (else claim-absent bounces all users; `apps/admin/scripts/backfill-onboarding-flag.mjs`). (b) **Stale token** — a claim is frozen at JWT mint, force `session.getToken({ skipCache: true })` before navigating. (c) **Exempt the loop + in-flight routes** (the onboarding route, all `/api/*`, the `?autoCreate` hop). Gate on "user COMPLETED the thing", not "container exists".

**Readiness gates MUST be monotonic** — never blank a mounted subtree on a transient auth-loading flip. Clerk's `isLoaded` flips back to `false` and `organization` blinks `null` during background JWT rotation (~1/min + focus/reconnect), so `show = !isLoading && hasOrg` blanks the body every rotation. Latch:
```ts
const resolved = useRef(false);
if (!isLoading && hasOrg) resolved.current = true;
const show = resolved.current || (!isLoading && hasOrg);
```
The data framework handles query data; a separate app-shell auth gate needs its own latch. (#1255)

### Org switching — cross-org isolation framework (defense-in-depth)

4th "don't act under the wrong context" member (after data/reveal/bucket). Keeps every API call + the whole cache bound to the viewed org. **Failure:** the proxy forwards the Clerk session active org (`auth().orgId`), decoupled from the URL `/orgs/[orgId]` (Clerk `organizationSyncOptions` syncs URL→session on page routes, NOT `/api/*`); after `setActive` the JWT rotates async → a lag window carrying the OLD org → a stale write commits under the old org (later 404) or a stale poll 404s. campaign-service isolation is correct; the 404 is the symptom. (DIS-143). Doctrine converges (Clerk + OWASP Multi-Tenant + tkdodo): derive tenant from JWT claims not client headers, validate every request, fail CLOSED, remount on switch.

Framework (every layer central, one file — never per-page):
1. **Server choke point — fail-closed proxy guard** (`src/lib/proxy-org.ts` `checkProxyOrg`): the client sends `x-active-org-id` (the URL org); the proxy compares it to `auth().orgId`, returns **409 `org_desync`** on mismatch, refuses to forward. The JWT stays the sole authority (client value detects the desync only — OWASP fail-closed, not trust-the-header). Applied to ALL proxy routes; a new route → call `checkProxyOrg` right after the `clerkOrgId` check. Constants in dependency-free `src/lib/org-desync.ts`.
2. **Client cache choke point — keyed remount** (`src/lib/query-provider.tsx`): inner `QueryClientProvider key={org.id}` → org switch = new client = empty cache atomically. REPLACES `queryClient.clear()` (raced). So `OrgCacheInvalidator` MUST mount ABOVE `QueryProvider` (else its `router.push` is eaten by the remount); it no longer touches the cache, only clears breadcrumb caches + navigates.
3. **Source — `await setActive`** (`breadcrumb-nav.tsx`) before `router.push` — closes the lag window so 1–2 rarely fire.
4. **Read gate** (`src/lib/use-auth-query.ts`): `enabled: caller && urlOrg === activeOrg` (strict `!urlOrgId || urlOrgId === activeOrgId` — NO `|| !activeOrgId` escape; a read under a null active org lands in a null-org cache entry, TanStack #3743). `useOrganization` import allowed here (powers the gate, not token-passing).

**Self-heal:** on 409 `org_desync`, `apiCall` waits 500ms + retries once. **Rule:** JWT authority server-side every request fail-closed; cache resets by remount not `clear()`; remount-surviving nav lives above `QueryProvider`. (DIS-143)

### Dashboard content width — content-driven, never cap-without-centering

No global width knob: the authed shell `<main>` is full-width; each page sets its OWN `max-w-*` wrapper. A cap WITHOUT `mx-auto` left-hugs with an asymmetric right gutter (the bug — brand overview was `max-w-4xl` = 896px, looked "stops short / weird"). Industry consensus (Atlassian fluid/fixed grid · Material body-region · Baymard/WCAG line-length) = width is **content-driven**:
- **Dense pages** (dashboards, card grids, lists, tables) → `p-4 md:p-8 max-w-7xl mx-auto` (fluid up to ~1280px ceiling, then centered). Tailwind v4 here → `max-w-7xl` is the largest named (`max-w-screen-2xl` was REMOVED in v4; use `max-w-7xl` or arbitrary `max-w-[96rem]`).
- **Reading / forms** → keep narrow (`max-w-2xl`/`max-w-3xl` ≈ 65–80ch) for line length — widening a form to 1280px hurts readability.
- ALWAYS `mx-auto` when capped (Material fluid-margins) so there's no asymmetric gutter.

Applied to the dense surfaces (brand overview, org overview, brands list, brand-info). Forms (`campaigns/new`, settings, billing, api-keys) stay narrow. (#1300-follow-up)

### Dashboard sidebars are SHARED per nav level — one edit covers every page at that level

`src/components/context-sidebar.tsx` → `ContextSidebar` switches on the URL to ONE sidebar per level. No per-page sidebar. A sidebar change on "the X page" applies to EVERY page at that level + usually a campaign-level analog — map all levels + surface the blast radius before scoping. (#1223)

| Level | Component | File | Groups |
|---|---|---|---|
| App / Org | `AppLevelSidebar` / `OrgLevelSidebar` | `context-sidebar.tsx` | — |
| Brand | `BrandLevelSidebar` | `context-sidebar.tsx` | Overview · **named feature groups** (Sales/Press/Investors/Hiring Outreach · Tools, via `BRAND_FEATURE_GROUPS`; unlisted slugs → trailing "Other") · **Database** (entity rows Outlets/Journalists/Articles/Leads/Emails, kept FLAT) · Brand Settings |
| Feature | `FeatureLevelSidebar` | `context-sidebar.tsx` | Campaigns · **Outcomes** · **Settings** · **Report** |
| Campaign | `CampaignSidebar` → `McpSidebar` | `campaign-sidebar.tsx` + `mcp-sidebar.tsx` | Overview · **Outcomes** (`outcomesItems`) · **Settings** (`settingsItems`) |

`McpSidebar`'s only consumer is `CampaignSidebar`. Section-header style `<h4 className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">`.

- **A surface that "mirrors the campaign sidebar" must enumerate BOTH Outcome entities AND Settings buttons** — `feature.entities` alone undercounts. `CampaignSidebar` = `outcomesItems` (entities × registry) PLUS `settingsExtra` slide-over buttons (e.g. `Prompt` → `CampaignPromptPanel`, `Inputs` gated on `featureInputs`). READ `campaign-sidebar.tsx` directly; don't infer from `feature.entities` or a subagent guess. (#1286)
- **Deleting a page route ⇒ delete its nav scaffolding in the SAME PR** or the link 404s (NOT caught by `error.tsx` — a missing route ≠ a render throw). `context-sidebar.tsx` wires each level in THREE places: the `SidebarItem` `href`, the `NavigationLevel` union member + its `getNavigationLevel` branch, the `XLevelSidebar` + its `switch` case. Invisible to `tsc` + source-substring tests. (#1226)
- **A backend-declared feature entity needs BOTH a feature-level AND a campaign-level route page** — both built from the same registry `pathSuffix` (`feature.entities` × `entityRegistry[name].pathSuffix`, features-service `stats-registry.ts`). Declaring an entity emits a feature-level link to a maybe-missing route → 404 (registry is backend-owned → blind to `tsc`/tests). Feature-level pages exist for `leads/emails/outlets/journalists/articles/quote-pitches/quote-requests/visibility-runs/prompts/competitors`; **still 404: `companies`** (blocked on a brand-scoped companies API) + **`press-kits`**. Both-level views SHARE one presentational component (differ by query scope + `basePath`). (#1276, DIS-104)
- **Entity-count badge MUST mirror its page's data source (`listingFallback`), not a feature-stat** — badge≠page is a DASHBOARD bug even when the empty page traces to an upstream gap. Resolution order: `listingFallback[entity.name]` (the page's count) → `fStats[entity.countKey]`. An entity missing from `listingFallback` falls through to a `countKey` counting a DIFFERENT data layer. Unify BOTH the page render AND both badges on ONE canonical endpoint. (#1231)
- **Canonical quote-requests reader = `listAllRankedOpportunities(brandId)`** — pages through the WHOLE `GET /orgs/opportunities` catalog (200/page). Never a hardcoded `limit:50`. All 4 surfaces (campaign+feature page, both sidebar badges) share queryKey `["rankedOpportunities",{brandId}]` → one fetch, badge==page. The public report mirrors it with a cap of 500 (ISR). (#1287)
- **A feature SLUG re-version (`-opportunities` → `-outreach`, any `X-v1`→`-v2`) rots EVERY hardcoded-slug consumer — gate the FAMILY via a shared helper, never a per-slug `===`.** ~9 slug special-cases across the authed + report trees (campaign HITL queue, `PROMPT_EDITABLE_SLUG`, report draft/reply handlers, report quote-requests page, `REDIRECT_TO_FIRST_ENTITY`, report sidebar, `REPORT_ENABLED_FEATURES`, report header labels). `tsc` + tests stay green on a stale literal. Fix: `grep -rn "<old-slug>" apps/dashboard/src`, replace with ONE helper (`slug.startsWith("<prefix>")`, e.g. `lib/expert-quote-feature.ts` → `isExpertQuoteFeature`) + a unit test over the whole family + a hypothetical `-v2`. Thread the REAL `featureSlug` (not a constant) into per-feature calls (prompt-fork) or the new feature uses the old prompt. (#1292, DIS-197)

### Dynasty-First Display Rule (Workflows Only)

Always display `dynastyName` for workflows, never the versioned name — exception: settings/debug panels (show the version + versioned name alongside). Applies to titles, rows, cards, breadcrumbs. Features have no dynasty — they use `slug` + `name` directly.
