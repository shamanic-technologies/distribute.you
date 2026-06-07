#!/usr/bin/env bash
# Verify AI scrapers / search bots receive complete indexable HTML.
# Counts <h1>, <h2>, <article>, <main>, and application/ld+json blocks
# under a curl impersonating GPTBot / ClaudeBot / Googlebot.
# Run pre and post any caching / ISR change to confirm SEO surface is intact.
#
# Usage: ./seo-snapshot.sh [BASE_URL]
#   BASE_URL defaults to https://distribute.you

set -euo pipefail

BASE="${1:-https://distribute.you}"
UA="${UA:-GPTBot/1.0 (+https://openai.com/gptbot)}"

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

printf "User-Agent: %s\n\n" "$UA"
printf "%-30s %5s %5s %8s %5s %4s\n" "ROUTE" "H1" "H2" "ARTICLE" "JSON" "SIZE"
printf "%-30s %5s %5s %8s %5s %4s\n" "-----" "--" "--" "-------" "----" "----"

for route in "${ROUTES[@]}"; do
  url="${BASE}${route}"
  html=$(curl -s -A "$UA" --max-time 30 "$url" 2>/dev/null || echo "")
  if [ -z "$html" ]; then
    printf "%-30s %5s %5s %8s %5s %4s\n" "$route" "ERR" "-" "-" "-" "-"
    continue
  fi
  # grep -oE prints each match on its own line; wc -l counts occurrences.
  # `{ ...; } || true` swallows grep's exit 1 (no match) under `set -e`/pipefail.
  h1=$(printf "%s" "$html" | { grep -oE "<h1[ >]" || true; } | wc -l | tr -d ' ')
  h2=$(printf "%s" "$html" | { grep -oE "<h2[ >]" || true; } | wc -l | tr -d ' ')
  article=$(printf "%s" "$html" | { grep -oE "<article[ >]" || true; } | wc -l | tr -d ' ')
  jsonld=$(printf "%s" "$html" | { grep -oE 'type="application/ld\+json"' || true; } | wc -l | tr -d ' ')
  size=$(printf "%s" "$html" | wc -c | tr -d ' ')
  printf "%-30s %5s %5s %8s %5s %4s\n" "$route" "$h1" "$h2" "$article" "$jsonld" "$size"
done
