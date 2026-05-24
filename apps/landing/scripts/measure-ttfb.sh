#!/usr/bin/env bash
# Measure TTFB on every public landing route. Run twice per URL (cold + warm).
# Usage: ./measure-ttfb.sh [BASE_URL]
#   BASE_URL defaults to https://distribute.you
#
# Use post-deploy on staging or prod to confirm edge cache + ISR are healthy.
# Goal after this PR: warm TTFB < 200ms on every route.

set -euo pipefail

BASE="${1:-https://distribute.you}"

ROUTES=(
  "/"
  "/pricing"
  "/blog"
  "/benchmarks"
  "/performance"
  "/performance/brands"
  "/performance/models"
  "/investors"
)

printf "%-45s %12s %12s\n" "ROUTE" "TTFB_COLD" "TTFB_WARM"
printf "%-45s %12s %12s\n" "-----" "---------" "---------"

for route in "${ROUTES[@]}"; do
  url="${BASE}${route}"
  cold=$(curl -s -o /dev/null -w "%{time_starttransfer}" --max-time 30 "$url" 2>/dev/null || echo "ERR")
  warm=$(curl -s -o /dev/null -w "%{time_starttransfer}" --max-time 30 "$url" 2>/dev/null || echo "ERR")
  printf "%-45s %12s %12s\n" "$route" "${cold}s" "${warm}s"
done
