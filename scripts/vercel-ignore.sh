#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" for this monorepo.
#
# Vercel's exit-code convention is inverted from the shell norm:
#   exit 1 -> build proceeds
#   exit 0 -> build is skipped (deployment is marked CANCELED, costs 0 build minutes)
#
# Every app project points its `ignoreCommand` at this script with its workspace
# name, so one file governs all of them. Turbo decides: it walks the package
# dependency graph, so a change in a workspace an app depends on (shared/content)
# rebuilds that app, while a root-only change (CLAUDE.md) rebuilds nothing.
#
# Fail-safe: every uncertain path exits 1 (build). A skipped build that should
# have run means code silently never reaches production, so ambiguity always
# resolves toward building.
#
# Usage: scripts/vercel-ignore.sh @distribute/<workspace>

set -uo pipefail

PKG="${1:-}"
if [ -z "$PKG" ]; then
  echo "vercel-ignore: no workspace argument given -> building" >&2
  exit 1
fi

# `website` is an orphan branch that must never deploy. This preserves the guard
# that previously lived in each project's Ignored Build Step setting.
if [ "${VERCEL_GIT_COMMIT_REF:-}" = "website" ]; then
  echo "vercel-ignore: branch is 'website' -> skipping" >&2
  exit 0
fi

# Vercel sets this to the SHA of the last *successful* deployment for this
# project and branch. It is absent on a branch's first deployment.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$BASE" ]; then
  echo "vercel-ignore: no previous successful deployment -> building" >&2
  exit 1
fi

# Vercel clones shallow (depth 10). If the base commit is not in the checkout,
# turbo cannot diff against it.
if ! git cat-file -e "${BASE}^{commit}" 2>/dev/null; then
  echo "vercel-ignore: base ${BASE} not in shallow clone -> building" >&2
  exit 1
fi

# Pinned to the version in the root package.json. The ignore step runs before
# `install`, so there is no local turbo binary to reuse.
TURBO_VERSION="2.8.0"

if ! DRY_RUN=$(npx --yes "turbo@${TURBO_VERSION}" run build \
      --filter="${PKG}...[${BASE}]" --dry=json 2>/dev/null); then
  echo "vercel-ignore: turbo failed -> building" >&2
  exit 1
fi

# turbo lists the packages its filter matched. Non-empty means this app, or
# something it depends on, changed since the last successful deployment.
printf '%s' "$DRY_RUN" | node -e '
let raw = "";
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  let packages;
  try {
    packages = JSON.parse(raw).packages;
  } catch {
    console.error("vercel-ignore: could not parse turbo output -> building");
    process.exit(1);
  }
  if (!Array.isArray(packages)) {
    console.error("vercel-ignore: unexpected turbo output -> building");
    process.exit(1);
  }
  if (packages.length > 0) {
    console.error(`vercel-ignore: affected (${packages.join(", ")}) -> building`);
    process.exit(1);
  }
  console.error("vercel-ignore: nothing affected -> skipping");
  process.exit(0);
});
'
