#!/usr/bin/env bash
# Writes the committed snapshot the article `cold-email-response-time` is rendered from.
#
#   ./fetch-reply-delay.sh > reply-delay.snapshot.json
#
# Copies the study `positive-reply-delay` exactly as features-service serves it to the staff
# Research page (GET /internal/research), read from inside its container on the box. Nothing is
# recomputed from a database: the article states the served study. Aggregates only: no text,
# no client, no lead, no campaign.
set -euo pipefail
ssh -i ~/.ssh/oracle-distribute root@167.233.196.79 \
  'docker exec distribute-features-service-1 node -e "fetch(\"http://localhost:8080/internal/research\",{headers:{\"x-api-key\":process.env.FEATURES_SERVICE_API_KEY}}).then(r=>{if(!r.ok)throw new Error(\"research \"+r.status);return r.json()}).then(d=>{const s=d.studies.find(x=>x.id===\"positive-reply-delay\");if(!s)throw new Error(\"no positive-reply-delay study\");process.stdout.write(JSON.stringify({computedAt:d.computedAt,study:s},null,2)+\"\\n\")})"'
