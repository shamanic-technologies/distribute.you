#!/usr/bin/env bash
# The nightly Research refresh: re-reads production, recomputes every study (and its verdict:
# conclusion / signal / noise, verdict.mjs), and publishes the snapshot to main once CI is green.
# Runs ON the Hetzner box from /root/distribute/research-refresh-cron.sh, in a dedicated clone of
# this repo; never by hand on a laptop (the refresh-research skill is the manual path).
#
#   ./refresh.sh compute <data-dir>                   # extract + derive + commit on the branch
#   GITHUB_TOKEN=... ./refresh.sh publish <data-dir>  # push the branch, wait for CI, push to main
#
# Two phases because only `compute` needs the box's memory: the cron holds the deploy lock for it
# and releases it before `publish` waits on CI.
#
# No LLM anywhere: SQL, then plain JavaScript statistics.
#
# WHY NO PR: neither token on the box may open one (fine-grained PATs without pull-request write,
# and Actions may not create PRs on this repo). So the gate is run by hand: the branch push
# triggers test.yml, and main only receives the commit once build, test-dashboard and lint are
# green on it. The commit body carries what changed (research-diff.mjs).
#
# MEMORY: the box has ~3 GB free at rest and the OOM killer picks postgres. derive.mjs peaks at
# 1.2 GB (measured 2026-10-10, output byte-equal to an 8 GB heap), so node runs in a container
# capped at 2.5 GB: a run that outgrows it dies alone (exit 137, mailed), postgres untouched.
set -euo pipefail

PHASE="${1:?compute | publish}"
DATA="${2:?data directory}"
REPO="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
BD="$REPO/apps/landing/scripts/blog-data"
LIB="$REPO/apps/dashboard/src/lib/research"
GH_REPO=shamanic-technologies/distribute.you
BRANCH=research/nightly-refresh
TODAY="$(date -u +%F)"
CUTOFF="$(date -u -d "$TODAY - 21 days" +%F)"

# Node exists only inside containers on the box. Same absolute paths inside and out, so every
# script's own paths (and research.mjs calling node on derive-pixel.mjs) resolve unchanged.
# `-e COST_BASIS` forwards the cost basis when set (the actual-cost twin); unset stays unset.
node() {
  docker run --rm -i --memory 2500m --memory-swap 2500m --cpu-shares 256 -e COST_BASIS \
    -v "$REPO:$REPO" -v "$DATA:$DATA" -w "$PWD" node:20-slim node "$@"
}
export -f node
export REPO DATA

cd "$REPO"

if [ "$PHASE" = publish ]; then
  : "${GITHUB_TOKEN:?GITHUB_TOKEN (push on distribute.you)}"
  [ -f "$DATA/committed" ] || { echo "== nothing to publish"; exit 0; }
  REMOTE="https://x-access-token:${GITHUB_TOKEN}@github.com/${GH_REPO}.git"
  SHA="$(git rev-parse HEAD)"
  git push -q -f "$REMOTE" "HEAD:refs/heads/$BRANCH"
  echo "== pushed $SHA to $BRANCH, waiting for CI"
  python3 - "$GH_REPO" "$SHA" <<'PY'
import json, os, sys, time, urllib.request
repo, sha = sys.argv[1:3]
need = {"build", "test-dashboard", "lint"}
def runs():
    req = urllib.request.Request(f"https://api.github.com/repos/{repo}/commits/{sha}/check-runs?per_page=100",
        headers={"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}", "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req) as r:
        return {c["name"]: c for c in json.load(r)["check_runs"]}
deadline = time.time() + 45 * 60
while time.time() < deadline:
    seen = runs()
    bad = [n for n in need if n in seen and seen[n]["status"] == "completed" and seen[n]["conclusion"] != "success"]
    if bad:
        raise SystemExit(f"CI failed on {sha}: {', '.join(bad)} ({seen[bad[0]]['html_url']})")
    if all(n in seen and seen[n]["conclusion"] == "success" for n in need):
        print(f"== CI green on {sha}")
        sys.exit(0)
    time.sleep(30)
raise SystemExit(f"CI did not finish on {sha} within 45 minutes")
PY
  # main may have moved during CI: the snapshot files are ours alone, so replay the commit on top.
  git fetch -q "$REMOTE" main
  git rebase -q FETCH_HEAD
  git push -q "$REMOTE" "HEAD:refs/heads/main"
  echo "== published $(git rev-parse HEAD) to main"
  rm -f "$DATA/committed"
  exit 0
fi
[ "$PHASE" = compute ] || { echo "unknown phase $PHASE" >&2; exit 1; }

rm -rf "$DATA" && mkdir -p "$DATA"
cp "$LIB/research.json" "$DATA/old-research.json"

echo "== extract $TODAY (rule cutoff $CUTOFF)"
BLOG_DATA_LOCAL=1 "$BD/extract.sh" 2026-04-15 "$TODAY" "$DATA"
BLOG_DATA_LOCAL=1 "$BD/pixel/extract-pixel.sh" "$CUTOFF" "$BD/pixel/pixel.research.snapshot.json"

echo "== derive (billed)"
node --max-old-space-size=1536 "$BD/derive.mjs" "$DATA" > "$DATA/facts.json"
node "$BD/research.mjs" "$DATA/facts.json" "$LIB" > "$DATA/research.json"
mv "$DATA/research.json" "$LIB/research.json"

echo "== derive (actual vendor cost, staff twin)"
COST_BASIS=actual node --max-old-space-size=1536 "$BD/derive.mjs" "$DATA" > "$DATA/facts-actual.json"
node "$BD/research.mjs" "$DATA/facts-actual.json" "$LIB/actual" > "$DATA/ra.json"
grep -q '"costBasis": "actual"' "$DATA/ra.json" || { echo "the actual-cost twin came out on another basis" >&2; exit 1; }
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
touch "$DATA/committed"
echo "== committed $(git rev-parse HEAD) on $BRANCH"
