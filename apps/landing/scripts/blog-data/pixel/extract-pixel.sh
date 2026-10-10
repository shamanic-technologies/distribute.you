#!/usr/bin/env bash
# Reads the open-tracking comparison out of production, one aggregate row per arm.
#
#   ./extract-pixel.sh <cutoff YYYY-MM-DD, exclusive> <out-file>
#   ./extract-pixel.sh 2026-09-13 apps/landing/scripts/blog-data/pixel/pixel.research.snapshot.json
#
# Read-only, over ssh to the Hetzner box. The query (pixel.sql) aggregates inside the
# database, so the snapshot carries counts only: no address, no lead, no campaign id.
set -euo pipefail
CUTOFF="${1:?cutoff date (exclusive)}"
OUT="${2:?output file}"
BOX="${BLOG_DATA_BOX:-root@167.233.196.79}"
KEY="${BLOG_DATA_KEY:-$HOME/.ssh/oracle-distribute}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PSQL="docker exec -i distribute-postgres-1 psql -U postgres -d instantly_service -At -v ON_ERROR_STOP=1 -v cutoff=$CUTOFF"
# BLOG_DATA_LOCAL=1: already on the box (the nightly refresh, refresh.sh), no ssh to itself.
if [ -n "${BLOG_DATA_LOCAL:-}" ]; then $PSQL < "$HERE/pixel.sql" > "$OUT.tmp"; else ssh -i "$KEY" "$BOX" "$PSQL" < "$HERE/pixel.sql" > "$OUT.tmp"; fi
node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));fs.writeFileSync(process.argv[1],JSON.stringify(j,null,1)+"\n")' "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
echo "$OUT: $(wc -c < "$OUT") bytes"
