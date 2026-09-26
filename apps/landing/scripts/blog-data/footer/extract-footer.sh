#!/usr/bin/env bash
# Reads the 2026-09-24 opt-out footer placement tests back out of the receiving mailboxes.
#
#   ./extract-footer.sh <out-file>
#   ./extract-footer.sh apps/landing/scripts/blog-data/footer/placement.snapshot.json
#
# Every message went to one of our own Google Workspace mailboxes, so the result lives in
# those mailboxes (INBOX or [Gmail]/Spam), not in a table. This ships read-placement.mjs and
# the private design file (sender and receiver addresses, kept on the box at
# $FOOTER_DESIGN) into the instantly-service container and runs it there. Read-only: it
# searches and fetches envelopes, it moves and deletes nothing.
#
# Gmail empties a spam folder after 30 days, so this can only reproduce the snapshot until
# about 2026-10-24. The committed snapshot is the record after that.
set -euo pipefail
OUT="${1:?output file}"
BOX="${BLOG_DATA_BOX:-root@167.233.196.79}"
KEY="${BLOG_DATA_KEY:-$HOME/.ssh/oracle-distribute}"
DESIGN="${FOOTER_DESIGN:-/root/blog-data/footer-design.json}"
HERE="$(cd "$(dirname "$0")" && pwd)"
scp -i "$KEY" -q "$HERE/read-placement.mjs" "$BOX:/tmp/blog-footer-read.mjs"
ssh -i "$KEY" "$BOX" "docker cp /tmp/blog-footer-read.mjs distribute-instantly-service-1:/app/blog-footer-read.mjs >/dev/null && docker cp $DESIGN distribute-instantly-service-1:/app/blog-footer-design.json >/dev/null && docker exec -w /app distribute-instantly-service-1 node /app/blog-footer-read.mjs /app/blog-footer-design.json </dev/null; rc=\$?; docker exec distribute-instantly-service-1 rm -f /app/blog-footer-read.mjs /app/blog-footer-design.json; rm -f /tmp/blog-footer-read.mjs; exit \$rc" > "$OUT.tmp"
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
echo "$OUT: $(wc -c < "$OUT") bytes"
