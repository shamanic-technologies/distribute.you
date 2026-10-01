# CRM (dashboard): connect, mirror, merge

## Connect the CRM the brand already runs on (`/orgs/:orgId/brands/:brandId/crm`, `components/crm/`; Integrations card `components/settings/brand-integrations-card.tsx`)
- BETA on BOTH nav entry (`context-sidebar.tsx`) AND page body (a nav-only gate is a hidden link). `useFeatureFlag` is false for everyone here: gate is `useIsBetaUser`, badge on the nav entry.
- **Credential lives in key-service scoped to (org, BRAND); the using service stores nothing** (owner 2026-09-19). Agency orgs hold many brands with separate accounts: `/keys/brands/{brandId}`. Absent = 404, NEVER an org fallback.
- **Connecting is TWO writes**: credential to key-service, connection to crm-service (resolves the credential itself and PROVES it against the vendor). A wrong token is refused in the vendor's own words; `integration-write.ts` passes a 400's `error` through, never the thrown error's message (carries the whole upstream body). Stored credential without connect is inert and overwritten on retry; the card says so.
- **Middle state must offer a way to finish**: `unfinished = credentialStored && !connection` shows the forward (Connect) button BESIDE the way out, never replacing it (the slot was a single ternary and left only "Disconnect" on something never connected). Remove button names what it removes (disconnect vs remove credential).
- **A retry keeps the stored credential**: `missingFields(def, values, {credentialStored})` forgives a blank SECRET only; connect SKIPS the credential write rather than overwrite with empty. A typed value wins. Sub-account id is not readable back: asked every time.
- Guard `tests/crm-unfinished-connection.test.ts`.

## Mirror page re-derives nothing
- crm-service serves the pipeline ALREADY GROUPED (pipelines, stages in their own order, `count`/`totalValue` per stage and pipeline) plus `ungrouped`. Guard forbids `.reduce(` in `lib/crm-view.ts` and the board. Ask what a producer will serve grouped/aggregated before writing client derivation.
- Contacts: serve `company`, `location`, `record` (type, leadSource, tags, createdAt, updatedAt, origin) groups; render the grouping. Company is a COLUMN (455 of 2,694 contacts have one, 454 with no email). Everything else opens on ONE person (Enter/Space open; `hidden md:table-cell` fold + `md:` floor move together).
- Their free text (`type`, `leadSource`, tags) is never mapped (guard bans `*_LABEL` / `normalize*` in `crm-view.ts`). The three groups are REQUIRED with nullable leaves (null = "their CRM does not hold this" in words). `tags` is `z.array(z.string())`. Only `http(s)` rendered as anchors.
- **No currency stated** (none mirrored): `formatAmount` writes a plain grouped number; exception to the adaptive-USD rule.
- **Never writes back**: no `draggable`/`onDrop`/`useBoardDrag`/`useMutation`/`apiCall`/`fetch(` in the board/components; gateway proxies neither credential-decrypt nor crm-service `/internal/*` sync triggers; no "Sync now" button, the page states when it last read.
- `lib/crm-view.ts`, `lib/integrations.ts`, `lib/integration-write.ts` alias-free. Roots `brandKeys`, `crmConnections`, `crmContacts`, `crmPipeline` in `PERSISTABLE_QUERY_ROOTS`. Contacts table shows ONE page and says so (search is local). Guards `tests/crm-view.test.ts`, `tests/crm-beta-gate.test.ts`.

## Second sidebar: Raw vs Merged (`crm/layout.tsx` `CrmSidebar`, both beta-badged)
`/crm` = Raw; `/crm/merged` = `components/crm/crm-merged-page.tsx`, staff debug over lead-service pairings: one row per THEIR contact, our lead beside it when paired.
- Counts served (`/v1/leads/crm-pairing-counts`, crm-service `.../contacts/origins`); nothing summed here.
- Table reads `state=` on `/v1/leads/crm-pairings` server-side; `nextOffset` is a POSITION in their list, so Previous walks a stack of offsets. Opens on `paired`; only a set including `unconfirmed` spends.
- "Aligned" (`lib/crm-pairings.ts` `alignmentFor`, alias-free) compares only fixed-meaning fields: their deal STATE vs our STANDING; stage names never mapped. `behind` (closed-won there, no sale here) is the point.
- Doubt counts as ours, a person settles it (lead-service v0.81.18): hesitant Jev judgment PAIRS with `pairing.toConfirm: true` (`pairedToConfirm`, `?toConfirm=true`); **To confirm** section on top, `needsConfirmation` sorts first. `unconfirmed` = model could not answer yet ("Not judged yet", stat only when non-zero).
- Rulings (Same person / Not the same person / Take back) via `setCrmPairingRuling` / `withdrawCrmPairingRuling`, re-read page + counts before the button releases; denying deletes nothing; refusals render from STATUS. Guard `tests/crm-merged-view.test.ts`.

## CRM source = ONE crm-service CSV upload = ONE human-service audience via `crmUploadId`
For `sales-crm-email-outreach` (slug only in `apps/admin/src/lib/crm-outreach-feature.ts`, gate `isCrmOutreachFeature`).
- Source = `GET /v1/orgs/contacts/uploads?brandId=`; contacts carry `sourceUploadId`. Audience `crmUploadId` (human-service v0.33.0): set at CREATION only, immutable, validated against the brand's uploads (400), `null` = whole imported list. Per-source gives per-file cost-per-outcome and independent pause.
- crm-service `serve-next` / `serve-stats` take optional `uploadIds`; narrows candidates only, suppression stays brand-wide (`contact_serves UNIQUE(brand_id, email)`).
- api-service `/v1/orgs/audiences*` forwards body raw: no gateway work.
- Staff UI: `components/settings/crm-source-audiences-card.tsx` + `lib/crm-source-audiences.ts` on `features/[featureSlug]/settings`. ON creates-or-reactivates, OFF pauses; unbound active CRM audience shows a WARNING; no filename => cannot switch on. Names unique per (org, brand): surface the 409, never suffix.
- `listAudiences` / `createAudience` / `setAudienceStatus` live in BOTH `apps/admin/src/lib/api.ts` and `apps/dashboard/src/lib/api.ts`: migrate together.
