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
# features-service prices a sales interest on. Dated by the first inbound event.
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

echo "done"
