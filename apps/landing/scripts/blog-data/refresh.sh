#!/usr/bin/env bash
# The nightly Research refresh: re-reads production, recomputes every study (and its verdict:
# conclusion / signal / noise, verdict.mjs), and opens a PR to main with auto-merge armed.
# Runs ON the Hetzner box from /root/distribute/research-refresh-cron.sh, in a dedicated clone of
# this repo; never by hand on a laptop (the refresh-research skill is the manual path).
#
#   GITHUB_TOKEN=... ./refresh.sh <data-dir>
#
# No LLM anywhere: SQL, then plain JavaScript statistics. The dashboard CI (dashboard tests +
# build) gates the merge, so a snapshot that breaks a research guard never reaches the page.
#
# MEMORY: the box has ~3 GB free at rest and the OOM killer picks postgres. derive.mjs fits a
# 2 GB heap (measured 2026-10-10: 1.5 GB resident, output byte-equal to an 8 GB heap), so node
# runs in a container capped at 2.5 GB: a run that outgrows it dies alone, postgres untouched.
set -euo pipefail

DATA="${1:?data directory}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN (push + PR on distribute.you)}"
REPO="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
BD="$REPO/apps/landing/scripts/blog-data"
LIB="$REPO/apps/dashboard/src/lib/research"
GH_REPO=shamanic-technologies/distribute.you
BRANCH=research/nightly-refresh
TODAY="$(date -u +%F)"
CUTOFF="$(date -u -d "$TODAY - 21 days" +%F)"

# Node exists only inside containers on the box. Same absolute paths inside and out, so every
# script's own paths (and research.mjs calling node on derive-pixel.mjs) resolve unchanged.
node() {
  docker run --rm -i --memory 2500m --memory-swap 2500m --cpu-shares 256 \
    -v "$REPO:$REPO" -v "$DATA:$DATA" -w "$PWD" node:20-slim node "$@"
}
export -f node
export REPO DATA

rm -rf "$DATA" && mkdir -p "$DATA"
cd "$REPO"
cp "$LIB/research.json" "$DATA/old-research.json"

echo "== extract $TODAY (rule cutoff $CUTOFF)"
BLOG_DATA_LOCAL=1 "$BD/extract.sh" 2026-04-15 "$TODAY" "$DATA"
BLOG_DATA_LOCAL=1 "$BD/pixel/extract-pixel.sh" "$CUTOFF" "$BD/pixel/pixel.research.snapshot.json"

echo "== derive (billed)"
node --max-old-space-size=2048 "$BD/derive.mjs" "$DATA" > "$DATA/facts.json"
node "$BD/research.mjs" "$DATA/facts.json" "$LIB" > "$DATA/research.json"
mv "$DATA/research.json" "$LIB/research.json"

echo "== derive (actual vendor cost, staff twin)"
COST_BASIS=actual node --max-old-space-size=2048 "$BD/derive.mjs" "$DATA" > "$DATA/facts-actual.json"
node "$BD/research.mjs" "$DATA/facts-actual.json" "$LIB/actual" > "$DATA/ra.json"
mv "$DATA/ra.json" "$LIB/actual/research.json"
rm -f "$LIB/actual/research-templates.json"

node "$BD/research-diff.mjs" "$DATA/old-research.json" "$LIB/research.json" > "$DATA/diff.md"
cat "$DATA/diff.md"

FILES=(
  apps/dashboard/src/lib/research/research.json
  apps/dashboard/src/lib/research/research-catalog.json
  apps/dashboard/src/lib/research/research-templates.json
  apps/dashboard/src/lib/research/actual/research.json
  apps/dashboard/src/lib/research/actual/research-catalog.json
  apps/landing/scripts/blog-data/pixel/pixel.research.snapshot.json
)
# Anything else the run touched is a bug in this script, not something to ship.
STRAY="$(git status --porcelain | awk '{print $2}' | grep -vxF -f <(printf '%s\n' "${FILES[@]}") || true)"
[ -z "$STRAY" ] || { echo "refresh touched files it must not ship: $STRAY" >&2; exit 1; }
if git diff --quiet -- "${FILES[@]}"; then echo "== nothing changed"; exit 0; fi
# REFRESH_DRY_RUN=1: compute and print the diff, publish nothing (rehearsal on the box).
if [ -n "${REFRESH_DRY_RUN:-}" ]; then echo "== dry run: nothing pushed"; exit 0; fi

git checkout -q -B "$BRANCH"
git add -- "${FILES[@]}"
git -c user.email=box@distribute.you -c user.name="distribute box" \
  commit -q -m "chore(research): nightly refresh to $TODAY" -m "$(cat "$DATA/diff.md")"
# One branch for every night: a PR still waiting on CI is updated in place, never duplicated.
git push -q -f "https://x-access-token:${GITHUB_TOKEN}@github.com/${GH_REPO}.git" "HEAD:refs/heads/$BRANCH"

# Open (or reuse) the PR and arm auto-merge. python3 is on the box; jq and gh are not.
python3 - "$GH_REPO" "$BRANCH" "$TODAY" "$DATA/diff.md" <<'PY'
import json, os, sys, urllib.request
repo, branch, today, diff_path = sys.argv[1:5]
token = os.environ["GITHUB_TOKEN"]
def call(method, url, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req) as r:
        return json.load(r)
owner = repo.split("/")[0]
body = open(diff_path).read() + "\n\nAutomated nightly refresh (apps/landing/scripts/blog-data/refresh.sh on the box). No LLM: SQL and statistics only.\n"
title = f"chore(research): nightly refresh to {today}"
open_prs = call("GET", f"https://api.github.com/repos/{repo}/pulls?state=open&head={owner}:{branch}")
if open_prs:
    pr = call("PATCH", f"https://api.github.com/repos/{repo}/pulls/{open_prs[0]['number']}", {"title": title, "body": body})
else:
    pr = call("POST", f"https://api.github.com/repos/{repo}/pulls", {"title": title, "head": branch, "base": "main", "body": body})
q = "mutation($id:ID!){enablePullRequestAutoMerge(input:{pullRequestId:$id,mergeMethod:SQUASH}){pullRequest{number}}}"
res = call("POST", "https://api.github.com/graphql", {"query": q, "variables": {"id": pr["node_id"]}})
if res.get("errors"):
    raise SystemExit(f"PR #{pr['number']} opened but auto-merge not armed: {res['errors']}")
print(f"== PR #{pr['number']} auto-merge armed: {pr['html_url']}")
PY
