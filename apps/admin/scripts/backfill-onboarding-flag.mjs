#!/usr/bin/env node
// [admin] backfill-onboarding-flag — one-time migration for DIS-111.
//
// The edge onboarding gate (proxy.ts) redirects any org WITHOUT
// `publicMetadata.onboardingComplete === true` to /onboarding. Existing orgs
// that already have brands were created before the flag existed, so they must
// be backfilled BEFORE the gate ships — otherwise every existing user bounces
// to onboarding on their next page load.
//
// For each Clerk org: count its brands via api-service (same headers the
// dashboard proxy sends). If it has >=1 brand and the flag isn't already set,
// set `publicMetadata.onboardingComplete = true`. Orgs with 0 brands are left
// alone (correctly routed to onboarding).
//
// Usage:
//   CLERK_SECRET_KEY=sk_... ADMIN_DISTRIBUTE_API_KEY=... \
//     [NEXT_PUBLIC_DISTRIBUTE_API_URL=https://api.distribute.you] \
//     node apps/admin/scripts/backfill-onboarding-flag.mjs [--apply]
//
// Flags:
//   --apply   actually write the flag. Without it, the script is READ-ONLY
//             (dry-run) and only reports what it would change.

const CLERK_API = "https://api.clerk.com/v1";
const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const ADMIN_API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;
const APPLY = process.argv.includes("--apply");

if (!CLERK_SECRET_KEY) throw new Error("[admin] CLERK_SECRET_KEY is required");
if (!ADMIN_API_KEY) throw new Error("[admin] ADMIN_DISTRIBUTE_API_KEY is required");

async function clerk(path, init = {}) {
  const res = await fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`[admin] Clerk ${init.method || "GET"} ${path} -> ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// List every org (paginated).
async function listAllOrgs() {
  const orgs = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await clerk(`/organizations?limit=${limit}&offset=${offset}`);
    const data = Array.isArray(page) ? page : page.data || [];
    orgs.push(...data);
    if (data.length < limit) break;
  }
  return orgs;
}

// One member's user id — needed for the api-service identity header.
async function firstMemberUserId(orgId) {
  const page = await clerk(`/organizations/${orgId}/memberships?limit=1`);
  const data = Array.isArray(page) ? page : page.data || [];
  return data[0]?.public_user_data?.user_id || null;
}

// Count brands for an org via api-service — mirrors the dashboard proxy headers.
async function brandCount(orgId, userId) {
  const res = await fetch(`${API_URL}/v1/brands`, {
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": ADMIN_API_KEY,
      "x-external-org-id": orgId,
      "x-external-user-id": userId,
    },
  });
  if (!res.ok) {
    // Fail loud per org, but don't set the flag on an unconfirmed count.
    throw new Error(`brands GET -> ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return Array.isArray(body?.brands) ? body.brands.length : 0;
}

async function setFlag(orgId) {
  await clerk(`/organizations/${orgId}/metadata`, {
    method: "PATCH",
    body: JSON.stringify({ public_metadata: { onboardingComplete: true } }),
  });
}

async function main() {
  console.log(`[admin] backfill-onboarding-flag — ${APPLY ? "APPLY (writing)" : "DRY-RUN (read-only)"}`);
  console.log(`[admin] api-service: ${API_URL}`);
  const orgs = await listAllOrgs();
  console.log(`[admin] ${orgs.length} orgs total\n`);

  const summary = { already: 0, willSet: 0, set: 0, noBrands: 0, skipped: 0 };

  for (const org of orgs) {
    const tag = `${org.id} '${org.name}'`;
    if (org.public_metadata?.onboardingComplete === true) {
      summary.already++;
      console.log(`  ✓ ${tag} — already flagged`);
      continue;
    }
    const userId = await firstMemberUserId(org.id);
    if (!userId) {
      summary.skipped++;
      console.warn(`  ! ${tag} — no members, skipped`);
      continue;
    }
    let count;
    try {
      count = await brandCount(org.id, userId);
    } catch (e) {
      summary.skipped++;
      console.warn(`  ! ${tag} — brand count failed (${e.message}), skipped`);
      continue;
    }
    if (count === 0) {
      summary.noBrands++;
      console.log(`  · ${tag} — 0 brands, left for onboarding`);
      continue;
    }
    if (APPLY) {
      await setFlag(org.id);
      summary.set++;
      console.log(`  → ${tag} — ${count} brand(s) → flag SET`);
    } else {
      summary.willSet++;
      console.log(`  → ${tag} — ${count} brand(s) → would set flag`);
    }
  }

  console.log(`\n[admin] summary:`, JSON.stringify(summary));
  if (!APPLY && summary.willSet > 0) {
    console.log(`[admin] re-run with --apply to write ${summary.willSet} flag(s).`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
