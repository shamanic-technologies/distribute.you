#!/usr/bin/env bash
# Pulls the cold-email fact tables the two data blog articles are derived from.
#
# Every figure in apps/landing/content/blog/{cost-per-click-cold-email,flash-vs-pro-llm-cold-email}
# comes out of these dumps. Re-run this, then the two derive-*.mjs scripts, to reproduce
# or to re-derive after a production data correction.
#
#   ./extract.sh <window-start> <window-end-exclusive> <out-dir>
#   ./extract.sh 2026-04-15 2026-09-12 /tmp/blog-data
#
# Requires ssh access to the Hetzner box. Every read is read-only.
set -euo pipefail

FROM="${1:?window start, e.g. 2026-04-15}"
TO="${2:?window end exclusive, e.g. 2026-09-12}"
OUT="${3:?output directory}"
BOX="${BLOG_DATA_BOX:-root@167.233.196.79}"
KEY="${BLOG_DATA_KEY:-$HOME/.ssh/oracle-distribute}"

mkdir -p "$OUT"

# The window travels with the dumps: derive.mjs reads its END as the moment outcomes stop being
# observed, which is what the maturation window is measured back from.
printf '{"from":"%s","to":"%s"}\n' "$FROM" "$TO" > "$OUT/window.json"

run() { # run <database> <sql> <outfile>
  ssh -i "$KEY" -o ConnectTimeout=20 "$BOX" 'bash -s' > "$OUT/$3" <<EOF
docker exec -i distribute-postgres-1 psql -U postgres -d "$1" -v ON_ERROR_STOP=1 --csv <<'SQL'
$2
SQL
EOF
  echo "  $3: $(( $(wc -l < "$OUT/$3") - 1 )) rows"
}

echo "window $FROM .. $TO (exclusive) -> $OUT"

# One row per email we sent. send_transport tells the two click pipelines apart:
# 'instantly' clicks come from the provider's webhook, 'smtp' clicks from our own
# /c/ redirect, which is the pipeline the scanner classifier filters.
run instantly_service "
SELECT e.campaign_id AS instantly_campaign_id,
       lower(e.lead_email) AS lead_email,
       e.step,
       e.timestamp AS sent_at,
       e.source,
       c.campaign_id AS platform_campaign_id,
       c.lead_id,
       c.org_id,
       c.workflow_slug,
       c.send_transport,
       c.timezone,
       c.reply_classification
FROM instantly_events e
JOIN instantly_campaigns c
  ON c.instantly_campaign_id = e.campaign_id
 AND lower(c.lead_email) = lower(e.lead_email)
WHERE e.event_type = 'email_sent'
  AND c.feature_slug = 'sales-cold-email-outreach'
  AND e.timestamp >= '$FROM' AND e.timestamp < '$TO'
" emails.csv

# The click the person made first, with the step that names which email carried it.
# Self-send clicks reach instantly_events only after the scanner classifier promotes
# them, so this set already excludes link-scanner prefetches.
run instantly_service "
SELECT DISTINCT ON (e.campaign_id, lower(e.lead_email))
       e.campaign_id AS instantly_campaign_id,
       lower(e.lead_email) AS lead_email,
       e.step,
       e.timestamp AS clicked_at,
       e.source
FROM instantly_events e
JOIN instantly_campaigns c
  ON c.instantly_campaign_id = e.campaign_id
 AND lower(c.lead_email) = lower(e.lead_email)
WHERE e.event_type = 'email_link_clicked'
  AND c.feature_slug = 'sales-cold-email-outreach'
  AND e.timestamp >= '$FROM' AND e.timestamp < '$TO'
ORDER BY e.campaign_id, lower(e.lead_email), e.timestamp
" clicks.csv

# A positive reply is the frozen classification on the sequence row, the same field
# features-service prices a positive reply on. Dated by the first inbound event.
run instantly_service "
SELECT c.instantly_campaign_id,
       lower(c.lead_email) AS lead_email,
       (SELECT min(e.timestamp) FROM instantly_events e
         WHERE e.campaign_id = c.instantly_campaign_id
           AND lower(e.lead_email) = lower(c.lead_email)
           AND e.event_type IN ('reply_received','lead_interested','lead_info_requested',
                                'lead_meeting_requested','lead_meeting_booked','lead_closed')
       ) AS replied_at
FROM instantly_campaigns c
WHERE c.feature_slug = 'sales-cold-email-outreach'
  AND c.reply_classification = 'positive'
" positive-replies.csv

# The text of each step as it was queued for sending. Link detection, length,
# paragraph count and subject length are all measured on this.
run instantly_service "
SELECT s.instantly_campaign_id, s.step, s.subject, s.body_html
FROM sequence_steps s
JOIN instantly_campaigns c ON c.instantly_campaign_id = s.instantly_campaign_id
WHERE c.feature_slug = 'sales-cold-email-outreach'
" sequence-steps.csv

# The model that wrote each person's email, and the text of every step of their
# sequence, read per email from the generation record. Link detection, length,
# paragraph count and subject length are all measured on this text.
run content_generation_service "
SELECT g.campaign_id AS platform_campaign_id,
       g.lead_id,
       g.model,
       g.prompt_type,
       g.workflow_slug,
       coalesce((s.value->>'step')::int, 1) AS step,
       g.subject,
       g.client_company_name,
       coalesce(s.value->>'bodyText', g.body_text) AS body_text
FROM email_generations g
LEFT JOIN LATERAL jsonb_array_elements(coalesce(g.sequence, '[]'::jsonb)) s ON true
WHERE g.feature_slug = 'sales-cold-email-outreach'
  AND g.lead_id IS NOT NULL
  AND g.created_at >= '$FROM'::timestamptz - interval '45 days'
  AND g.created_at < '$TO'
" generations.csv

# Which DYNASTY each workflow version belongs to: the Research page compares dynasties, the
# lineage a workflow keeps across its versions, never a single version.
run workflow_service "
SELECT workflow_slug, workflow_dynasty_slug, workflow_dynasty_name
FROM workflows
WHERE feature_slug = 'sales-cold-email-outreach'
" workflows.csv

# Which LEG each campaign performs (campaign-service's leg_key). The Research page computes every
# figure over ONE leg of ONE channel: Herald reads start_to_conversation, Scout reads
# start_to_website_visit. A campaign stating no leg (the rows from before legs existed) belongs to
# neither crew. The articles ignore this file: they are fleet-wide on purpose.
run campaign_service "
SELECT id AS platform_campaign_id, coalesce(leg_key, '') AS leg_key
FROM campaigns
WHERE feature_slug = 'sales-cold-email-outreach'
" campaign-legs.csv

# Reader dimensions, from the lead enrichment record.
run lead_service "
SELECT l.id AS lead_id, l.country, l.seniority, l.timezone,
       o.industry, o.estimated_num_employees
FROM leads l
LEFT JOIN leads_organizations lo ON lo.lead_id = l.id AND lo.current = true
LEFT JOIN organizations o ON o.id = lo.organization_id
" leads.csv

# What the client was charged, per workflow, before per-account discounts.
run runs_service "
SELECT r.workflow_slug, sum(rc.total_cost_in_usd_cents) AS cents
FROM runs_costs rc
JOIN runs r ON r.id = rc.run_id
WHERE rc.cost_source = 'platform' AND rc.status = 'actual'
  AND r.feature_slug = 'sales-cold-email-outreach'
  AND rc.created_at >= '$FROM' AND rc.created_at < '$TO'
GROUP BY 1
" spend.csv

# What each price version cost US at the vendor, before our markup, as costs-service states it
# (its own /internal/vendor-costs read, from inside its container). The Research page's staff
# "Actual cost" basis prices every spend row through this, with the rule runs-service's vendor
# read uses: a row matches the version of its cost name whose billed unit price equals the one
# the row froze and which was being served when the row was written. A row no known version
# prices is UNPRICED: it is counted apart, never folded in at the billed price.
ssh -i "$KEY" -o ConnectTimeout=20 "$BOX" 'docker exec distribute-costs-service-1 node -e "fetch(\"http://127.0.0.1:8080/internal/vendor-costs\",{headers:{\"x-api-key\":process.env.COSTS_SERVICE_API_KEY}}).then(r=>{if(!r.ok)throw new Error(\"vendor-costs \"+r.status);return r.json()}).then(j=>console.log(JSON.stringify(j.versions.filter(v=>v.billedPricePerUnitInUsdCents!==null).map(v=>({cost_name:v.name,billed:v.billedPricePerUnitInUsdCents,vendor:v.vendorCostPerUnitInUsdCents,served_from:new Date(Math.max(Date.parse(v.effectiveFrom),Date.parse(v.createdAt))).toISOString()})))))" </dev/null' > "$OUT/vendor-versions.json"
[ -s "$OUT/vendor-versions.json" ] || { echo "vendor-versions.json is empty" >&2; exit 1; }
echo "  vendor-versions.json: $(wc -c < "$OUT/vendor-versions.json") bytes"
VERSIONS_JSON="$(cat "$OUT/vendor-versions.json")"
# The version table as MATCH WINDOWS (see runs-service routes/vendor-costs.ts versionWindowsSql).
VENDOR_WINDOWS="SELECT x.cost_name, x.billed, x.vendor, x.served_from AS valid_from,
       LEAD(x.served_from) OVER (PARTITION BY x.cost_name, x.billed ORDER BY x.served_from) AS valid_to
FROM jsonb_to_recordset('$VERSIONS_JSON'::jsonb) AS x(cost_name text, billed numeric, vendor numeric, served_from timestamptz)"

# The same charge, per workflow version, per CAMPAIGN (so per leg) and per DAY, for the Research
# page: it prices a (workflow version, leg) on its own spend, windowed on the same days as the
# emails it divides (derive.mjs cuts both at the maturation cutoff). vendor_cents is the priced
# rows at vendor cost, unpriced_cents the billed amount of the rows no version prices.
run runs_service "
WITH v AS MATERIALIZED ($VENDOR_WINDOWS)
SELECT r.workflow_slug, r.campaign_id AS platform_campaign_id,
       (rc.created_at AT TIME ZONE 'UTC')::date AS day,
       sum(rc.total_cost_in_usd_cents) AS cents,
       coalesce(sum(rc.quantity * v.vendor) FILTER (WHERE v.vendor IS NOT NULL), 0) AS vendor_cents,
       coalesce(sum(rc.total_cost_in_usd_cents) FILTER (WHERE v.vendor IS NULL), 0) AS unpriced_cents
FROM runs_costs rc
JOIN runs r ON r.id = rc.run_id
LEFT JOIN v ON v.cost_name = rc.cost_name AND v.billed = rc.unit_cost_in_usd_cents
  AND rc.created_at >= v.valid_from AND (v.valid_to IS NULL OR rc.created_at < v.valid_to)
WHERE rc.cost_source = 'platform' AND rc.status = 'actual'
  AND r.feature_slug = 'sales-cold-email-outreach'
  AND rc.created_at >= '$FROM' AND rc.created_at < '$TO'
GROUP BY 1, 2, 3
" spend-legs.csv

# The link-scanner verdict on the clicks our OWN /c/ redirect recorded. Bronze holds every
# hit and promotes none; the sweep classifies each one and only a `human` verdict becomes the
# silver event the articles count. So this is what the correction DEMOTED, and the articles
# state it rather than carrying a figure someone typed once.
run instantly_service "
SELECT count(*) AS hits,
       count(*) FILTER (WHERE classification = 'human') AS human,
       count(*) FILTER (WHERE classification IS NOT NULL AND classification <> 'human') AS demoted,
       count(*) FILTER (WHERE classification IS NULL) AS undecided
FROM tracking_hits_raw
WHERE kind = 'click'
  AND received_at >= '$FROM' AND received_at < '$TO'
" scanner-hits.csv

# ---------- Research catalogue (workflow and template pages) ----------
# Every "last runs" list is per LEG: the campaign-to-leg map lives in another database, so it
# rides into each query as a VALUES list built from campaign-legs.csv.
LEGS_VALUES="$(awk -F, 'NR>1 && $2!="" {printf "%s(%c%s%c,%c%s%c)", (n++?",":""), 39, $1, 39, 39, $2, 39}' "$OUT/campaign-legs.csv")"
[ -n "$LEGS_VALUES" ] || { echo "campaign-legs.csv carries no leg" >&2; exit 1; }
# Each is ONE JSON value (json_agg), so text carrying commas, quotes and newlines needs no CSV.
runjson() { # runjson <database> <sql> <outfile>
  ssh -i "$KEY" -o ConnectTimeout=20 "$BOX" 'bash -s' > "$OUT/$3" <<EOF
docker exec -i distribute-postgres-1 psql -U postgres -d "$1" -v ON_ERROR_STOP=1 -At <<'SQL'
$2
SQL
EOF
  echo "  $3: $(wc -c < "$OUT/$3") bytes"
}

# The text of every cold-email template, as content-generation stores it. A versioned id never
# changes, so the text shown beside a template's figures is the one that wrote those emails.
runjson content_generation_service "
SELECT coalesce(json_agg(json_build_object('type', type, 'prompt', prompt) ORDER BY type), '[]')
FROM prompts
WHERE type ~ '^(cold-email|blind-discovery-email)'
" templates.json

# The last 12 executions of every workflow version, with what each cost (every descendant run's
# actual cost). No org, no lead: the page states fleet-wide facts only.
runjson runs_service "
WITH RECURSIVE v AS MATERIALIZED ($VENDOR_WINDOWS), top AS (
  SELECT id, workflow_slug, leg, status, started_at, completed_at FROM (
    SELECT r.id, r.workflow_slug, l.leg, r.status, r.started_at, r.completed_at,
           row_number() OVER (PARTITION BY r.workflow_slug, l.leg ORDER BY r.started_at DESC) AS rn
    FROM runs r
    JOIN (VALUES $LEGS_VALUES) AS l(campaign_id, leg) ON l.campaign_id = r.campaign_id::text
    WHERE r.task_name = 'execute-workflow' AND r.feature_slug = 'sales-cold-email-outreach'
      AND r.workflow_slug IS NOT NULL AND r.started_at < '$TO'
  ) x WHERE rn <= 12
), tree AS (
  SELECT id AS root, id FROM top
  UNION ALL
  SELECT t.root, c.id FROM tree t JOIN runs c ON c.parent_run_id = t.id
), priced AS (
  SELECT top.workflow_slug, top.leg, top.status, top.started_at, top.completed_at,
         coalesce(sum(rc.total_cost_in_usd_cents) FILTER (WHERE rc.status = 'actual'), 0) AS cents,
         coalesce(sum(rc.quantity * v.vendor) FILTER (WHERE rc.status = 'actual' AND v.vendor IS NOT NULL), 0) AS vendor_cents,
         coalesce(sum(rc.total_cost_in_usd_cents) FILTER (WHERE rc.status = 'actual' AND rc.id IS NOT NULL AND v.vendor IS NULL), 0) AS unpriced_cents
  FROM top JOIN tree ON tree.root = top.id
  LEFT JOIN runs_costs rc ON rc.run_id = tree.id
  LEFT JOIN v ON v.cost_name = rc.cost_name AND v.billed = rc.unit_cost_in_usd_cents
    AND rc.created_at >= v.valid_from AND (v.valid_to IS NULL OR rc.created_at < v.valid_to)
  GROUP BY 1, 2, 3, 4, 5
)
SELECT coalesce(json_agg(json_build_object('workflowSlug', workflow_slug, 'leg', leg, 'status', status,
  'startedAt', started_at, 'completedAt', completed_at, 'cents', round(cents, 2),
  'vendorCents', round(vendor_cents, 4), 'unpricedCents', round(unpriced_cents, 2)) ORDER BY started_at DESC), '[]')
FROM priced
" workflow-runs.json

# The last 12 emails every template wrote: when, with which model, under which workflow version.
runjson content_generation_service "
SELECT coalesce(json_agg(json_build_object('template', prompt_type, 'leg', leg, 'createdAt', created_at,
  'model', model, 'workflowSlug', workflow_slug, 'tokensIn', tokens_input, 'tokensOut', tokens_output)
  ORDER BY created_at DESC), '[]')
FROM (
  SELECT g.*, l.leg, row_number() OVER (PARTITION BY g.prompt_type, l.leg ORDER BY g.created_at DESC) AS rn
  FROM email_generations g
  JOIN (VALUES $LEGS_VALUES) AS l(campaign_id, leg) ON l.campaign_id = g.campaign_id::text
  WHERE g.feature_slug = 'sales-cold-email-outreach' AND g.prompt_type IS NOT NULL AND g.created_at < '$TO'
) x WHERE rn <= 12
" template-runs.json

# The last 12 emails every model wrote: when, under which template and workflow version.
runjson content_generation_service "
SELECT coalesce(json_agg(json_build_object('model', model, 'leg', leg, 'createdAt', created_at,
  'template', prompt_type, 'workflowSlug', workflow_slug, 'tokensIn', tokens_input, 'tokensOut', tokens_output)
  ORDER BY created_at DESC), '[]')
FROM (
  SELECT g.*, l.leg, row_number() OVER (PARTITION BY g.model, l.leg ORDER BY g.created_at DESC) AS rn
  FROM email_generations g
  JOIN (VALUES $LEGS_VALUES) AS l(campaign_id, leg) ON l.campaign_id = g.campaign_id::text
  WHERE g.feature_slug = 'sales-cold-email-outreach' AND g.model IS NOT NULL AND g.created_at < '$TO'
) x WHERE rn <= 12
" model-runs.json

echo "done"
