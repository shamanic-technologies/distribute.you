#!/usr/bin/env node
// [admin] teardown-org — quick tenant teardown for debug/test iteration.
//
// Fully deletes a tenant's Clerk org (+ optional user) and its Stripe customer
// (cancel subscriptions, then delete the customer). It does NOT purge service
// database rows — those are left orphaned, which is harmless: a fresh signup
// gets a brand-new orgId, so stale rows keyed on the old orgId never collide.
//
// For the full cascade purge (every service DB + Stripe + Clerk), use the
// api-service endpoint: DELETE /internal/admin/orgs/:orgId.
//
// Usage:
//   CLERK_SECRET_KEY=sk_... STRIPE_SECRET_KEY=sk_... \
//     node apps/admin/scripts/teardown-org.mjs --org org_xxx \
//       [--email a@b.com | --user user_xxx] [--yes] [--dry-run] \
//       [--skip-stripe] [--stripe-meta-key orgId]
//
// Flags:
//   --org              (required) Clerk organization id to delete.
//   --email / --user   also delete the Clerk user (frees the email for re-test).
//   --yes              skip the type-the-org-name confirmation prompt.
//   --dry-run          read-only: show what would be deleted, mutate nothing.
//   --skip-stripe      delete Clerk only (no STRIPE_SECRET_KEY needed).
//   --stripe-meta-key  Stripe customer metadata key holding the orgId (default "orgId").

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const CLERK_API = "https://api.clerk.com/v1";
const STRIPE_API = "https://api.stripe.com/v1";

export function parseArgs(argv) {
  const args = { yes: false, dryRun: false, skipStripe: false, stripeMetaKey: "orgId" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--org") args.orgId = argv[++i];
    else if (a === "--email") args.email = argv[++i];
    else if (a === "--user") args.userId = argv[++i];
    else if (a === "--stripe-meta-key") args.stripeMetaKey = argv[++i];
    else if (a === "--yes") args.yes = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--skip-stripe") args.skipStripe = true;
    else throw new Error(`[admin] Unknown argument: ${a}`);
  }
  if (!args.orgId) throw new Error("[admin] --org <clerkOrgId> is required");
  return args;
}

// Refuse to guess when Stripe matches more than one customer for the org.
export function pickStripeCustomer(customers) {
  if (!Array.isArray(customers) || customers.length === 0) return null;
  if (customers.length > 1) {
    throw new Error(
      `[admin] Stripe returned ${customers.length} customers for this org — refusing to guess. ` +
        `Resolve manually (ids: ${customers.map((c) => c.id).join(", ")}).`,
    );
  }
  return customers[0];
}

async function apiFetch(fetchFn, url, { method = "GET", key }) {
  const res = await fetchFn(url, { method, headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[admin] ${method} ${url} -> ${res.status} ${body}`);
  }
  return res.json();
}

export async function teardownStripe({
  orgId,
  stripeKey,
  metaKey = "orgId",
  fetchFn = fetch,
  dryRun = false,
  log = console.log,
}) {
  if (!stripeKey) throw new Error("[admin] STRIPE_SECRET_KEY is required for Stripe teardown");

  const query = `metadata['${metaKey}']:'${orgId}'`;
  const search = await apiFetch(
    fetchFn,
    `${STRIPE_API}/customers/search?query=${encodeURIComponent(query)}`,
    { key: stripeKey },
  );
  const customer = pickStripeCustomer(search.data);
  if (!customer) {
    log(`[admin] No Stripe customer with metadata['${metaKey}']='${orgId}' — skipping Stripe (nothing to delete).`);
    return { skipped: true, reason: "no-customer", metaKey };
  }
  log(`[admin] Stripe customer ${customer.id} matched.`);

  const subsRes = await apiFetch(
    fetchFn,
    `${STRIPE_API}/subscriptions?customer=${customer.id}&status=all&limit=100`,
    { key: stripeKey },
  );
  if (!Array.isArray(subsRes.data)) {
    throw new Error(`[admin] Stripe subscriptions list returned no data array for ${customer.id}`);
  }
  const subs = subsRes.data;

  if (dryRun) {
    log(`[admin] [dry-run] would cancel ${subs.length} subscription(s) and delete customer ${customer.id}.`);
    return { customerId: customer.id, subsCancelled: subs.length, deleted: false, dryRun: true };
  }

  for (const sub of subs) {
    await apiFetch(fetchFn, `${STRIPE_API}/subscriptions/${sub.id}`, { method: "DELETE", key: stripeKey });
    log(`[admin] Cancelled subscription ${sub.id}.`);
  }
  const del = await apiFetch(fetchFn, `${STRIPE_API}/customers/${customer.id}`, { method: "DELETE", key: stripeKey });
  log(`[admin] Deleted Stripe customer ${customer.id}.`);
  return { customerId: customer.id, subsCancelled: subs.length, deleted: del.deleted === true };
}

export async function teardownClerk({
  orgId,
  userId,
  clerkKey,
  fetchFn = fetch,
  dryRun = false,
  log = console.log,
}) {
  if (!clerkKey) throw new Error("[admin] CLERK_SECRET_KEY is required for Clerk teardown");

  if (dryRun) {
    const org = await apiFetch(fetchFn, `${CLERK_API}/organizations/${orgId}`, { key: clerkKey });
    log(`[admin] [dry-run] would delete Clerk org ${orgId} ("${org.name}")${userId ? ` and user ${userId}` : ""}.`);
    return { orgDeleted: false, userDeleted: false, dryRun: true, orgName: org.name };
  }

  await apiFetch(fetchFn, `${CLERK_API}/organizations/${orgId}`, { method: "DELETE", key: clerkKey });
  log(`[admin] Deleted Clerk org ${orgId}.`);

  let userDeleted = false;
  if (userId) {
    await apiFetch(fetchFn, `${CLERK_API}/users/${userId}`, { method: "DELETE", key: clerkKey });
    log(`[admin] Deleted Clerk user ${userId}.`);
    userDeleted = true;
  }
  return { orgDeleted: true, userDeleted };
}

// Resolve a single Clerk user id from an email, failing loud on 0 or >1 matches.
export async function resolveClerkUserId({ email, clerkKey, fetchFn = fetch }) {
  const res = await apiFetch(
    fetchFn,
    `${CLERK_API}/users?email_address=${encodeURIComponent(email)}`,
    { key: clerkKey },
  );
  const users = Array.isArray(res) ? res : res.data;
  if (!Array.isArray(users) || users.length !== 1) {
    throw new Error(`[admin] Expected exactly 1 Clerk user for ${email}, got ${users?.length ?? 0}`);
  }
  return users[0].id;
}

export async function confirmOrgName({ expectedName, yes, readLine }) {
  if (yes) return true;
  const ask =
    readLine ??
    (async (q) => {
      const rl = createInterface({ input, output });
      const ans = await rl.question(q);
      rl.close();
      return ans;
    });
  const ans = await ask(`[admin] Type the org name "${expectedName}" to confirm deletion: `);
  return ans.trim() === expectedName;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const clerkKey = process.env.CLERK_SECRET_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!clerkKey) throw new Error("[admin] CLERK_SECRET_KEY env var is required");
  if (!stripeKey && !args.skipStripe) {
    throw new Error("[admin] STRIPE_SECRET_KEY env var is required (or pass --skip-stripe)");
  }

  const org = await apiFetch(fetch, `${CLERK_API}/organizations/${args.orgId}`, { key: clerkKey });
  console.log(
    `[admin] Org: ${org.name} (${org.id}) — members: ${org.members_count ?? "?"} — created_at: ${org.created_at}`,
  );
  const alsoUser = Boolean(args.userId || args.email);
  console.warn(
    `[admin] This permanently deletes the Clerk org${alsoUser ? " + user" : ""}` +
      `${args.skipStripe ? "" : " and the Stripe customer"}. This is IRREVERSIBLE.`,
  );

  const ok = await confirmOrgName({ expectedName: org.name, yes: args.yes });
  if (!ok) {
    console.log("[admin] Name did not match — aborted. Nothing was deleted.");
    process.exit(1);
  }

  let userId = args.userId;
  if (!userId && args.email) {
    userId = await resolveClerkUserId({ email: args.email, clerkKey });
  }

  const stripeSummary = args.skipStripe
    ? { skipped: true, reason: "skip-stripe" }
    : await teardownStripe({ orgId: args.orgId, stripeKey, metaKey: args.stripeMetaKey, dryRun: args.dryRun });

  const clerkSummary = await teardownClerk({ orgId: args.orgId, userId, clerkKey, dryRun: args.dryRun });

  console.log(
    "[admin] Teardown summary:",
    JSON.stringify({ org: args.orgId, stripe: stripeSummary, clerk: clerkSummary, dryRun: args.dryRun }, null, 2),
  );
  console.log(
    "[admin] NOTE: service DB rows for this org were NOT purged (orphaned, harmless — a new signup gets a fresh orgId). " +
      "For the full cascade, use api-service DELETE /internal/admin/orgs/:orgId.",
  );
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  });
}
