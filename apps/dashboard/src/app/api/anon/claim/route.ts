import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  ANON_COOKIE_OPTIONS,
  ANON_FLAG_COOKIE,
  ANON_SESSION_COOKIE,
  anonTokenFromCookieHeader,
} from "@/lib/anon-session-cookie";
import { ANON_PRINCIPAL, readAnonSession } from "@/lib/anon-session-token";
import { settleWelcomeOnSignup } from "@/lib/billing-service";
import { claimAnonymousOrg } from "@/lib/client-service";
import { rememberOrgName } from "@/lib/org-name";
import { isClerkAutoOrgName, orgNameFor } from "@/lib/org-name-rule";

/**
 * The moment the account exists: the org they have been building IS theirs.
 *
 * Nothing moves. client-service swaps the external identity underneath the same
 * internal org, so every brand, offer, audience, run and cost written while
 * they were signed out is already on the right org — there is no copy, no
 * cross-service migration, and nothing to lose on the one request that matters
 * most in the whole flow.
 *
 * FAIL LOUD, AND NEVER HALF-WAY. A claim that did not happen is reported as a
 * failure, never as a success with a note: a visitor told "you're all set" over
 * an org that is not theirs would find an empty dashboard, having paid.
 *
 * REPLAYING IS SUCCESS. client-service answers `alreadyClaimed` when the same
 * claim arrives twice, which is what a retried signup or a replayed request
 * looks like. Treating that as an error would break exactly the customer whose
 * network wobbled at the worst moment.
 */

const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

/**
 * The name of the brand the visitor built, read as the ANONYMOUS org (the same
 * identity the signed-out proxy uses), so it must run BEFORE the claim swaps
 * that identity. Naming is never worth a signup: a failed read is logged and
 * the org is named from the email instead.
 */
async function anonBrandName(apiKey: string, anonOrgId: string, brandId: string): Promise<string | null> {
  try {
    const res = await fetch(new URL(`/v1/brands/${encodeURIComponent(brandId)}`, API_URL), {
      headers: {
        "X-API-Key": apiKey,
        "x-external-org-id": anonOrgId,
        "x-external-user-id": ANON_PRINCIPAL,
        "x-brand-id": brandId,
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.error(`[anon-claim] brand name read for ${brandId}: ${res.status}`);
      return null;
    }
    const body = (await res.json()) as { brand?: { name?: unknown } };
    return typeof body.brand?.name === "string" ? body.brand.name : null;
  } catch (err) {
    console.error(`[anon-claim] brand name read for ${brandId} errored:`, err);
    return null;
  }
}

/**
 * Name the Clerk org after the business (`lib/org-name-rule.ts`), but ONLY over the
 * name Clerk gave it on its own ("Personal" or the full name): a name the
 * person typed is theirs. Returns the name the org carries afterwards, so
 * client-service is told the same one. Not fatal: a failed rename is logged and
 * the claim goes on.
 */
async function nameClerkOrg(
  orgId: string,
  wanted: string | null,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): Promise<string | null> {
  try {
    const clerk = await clerkClient();
    const org = await clerk.organizations.getOrganization({ organizationId: orgId });
    if (!wanted || wanted === org.name || !isClerkAutoOrgName(org.name, firstName, lastName)) {
      return org.name;
    }
    await clerk.organizations.updateOrganization(orgId, { name: wanted });
    rememberOrgName(orgId, wanted);
    console.log(`[anon-claim] org ${orgId} renamed from Clerk's auto name to "${wanted}"`);
    return wanted;
  } catch (err) {
    console.error(`[anon-claim] naming org ${orgId} failed:`, err);
    return null;
  }
}

const isSecure = (req: NextRequest): boolean => new URL(req.url).protocol === "https:";

/** Both cookies, always together. A browser holding the flag and no session
 *  gets one 401 from the proxy, which clears both — but the claim is the
 *  moment the token genuinely stops being needed, so it goes here first. */
function cleared(req: NextRequest, res: NextResponse): NextResponse {
  const opts = { ...ANON_COOKIE_OPTIONS(isSecure(req)), maxAge: 0 };
  res.cookies.set(ANON_SESSION_COOKIE, "", { ...opts, httpOnly: true });
  res.cookies.set(ANON_FLAG_COOKIE, "", opts);
  return res;
}

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_DISTRIBUTE_API_KEY;
  if (!secret) {
    console.error("[anon-claim] ADMIN_DISTRIBUTE_API_KEY is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const { userId, orgId, orgSlug } = await auth();
  if (!userId || !orgId) {
    // Signing up is what creates both. Reaching here without them means the
    // caller ran too early, and claiming for a half-made session would attach
    // somebody's work to an identity that does not exist yet.
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { session, refusal } = readAnonSession(
    anonTokenFromCookieHeader(req.headers.get("cookie")),
    secret,
  );
  if (!session) {
    // No anonymous session to claim is NOT an error: somebody who signed up the
    // ordinary way has nothing to transfer, and their brand-new org is already
    // theirs. Answering 200 with `claimed: false` lets one signup path serve
    // both without the caller branching on how they arrived.
    console.error(`[anon-claim] no session to claim: ${refusal ?? "absent"}`);
    return cleared(req, NextResponse.json({ claimed: false, nothingToClaim: true }));
  }

  try {
    // Read the person's own details off Clerk so client-service can fill the
    // profile in the same write. Absent fields are simply not sent — this never
    // substitutes a placeholder for a name we do not have.
    const user = await currentUser().catch(() => null);
    const email = user?.primaryEmailAddress?.emailAddress ?? undefined;

    // Never "Personal": brand, else business email domain, else full name.
    // A session that never created a brand carries `brandId: ""` (legal).
    const brandName = session.brandId
      ? await anonBrandName(secret, session.anonOrgId, session.brandId)
      : null;
    const orgName = await nameClerkOrg(
      orgId,
      orgNameFor({ brandName, email, firstName: user?.firstName, lastName: user?.lastName }),
      user?.firstName,
      user?.lastName,
    );

    const outcome = await claimAnonymousOrg({
      orgId: session.orgId,
      externalOrgId: orgId,
      externalUserId: userId,
      ...(email ? { email } : {}),
      ...(user?.firstName ? { firstName: user.firstName } : {}),
      ...(user?.lastName ? { lastName: user.lastName } : {}),
      ...(orgSlug ? { orgSlug } : {}),
      ...(orgName ? { orgName } : {}),
    });

    if (!outcome.claimed) {
      // The token stays: the org is still unclaimed and a retry is the recovery.
      // Clearing it here would strand everything the visitor built with no way
      // back to it.
      return NextResponse.json(
        { claimed: false, reason: outcome.refusal },
        { status: 409 },
      );
    }

    // The org is theirs now, so its free credit lands on exactly the welcome
    // amount rather than the welcome amount PLUS what we seeded. Deliberately
    // AFTER the claim and deliberately not fatal: by this point the customer
    // has an account and an org full of their work, and losing the signup over
    // a credit settle would be the expensive mistake. Billing makes a retry
    // safe and an unseeded org is unaffected by the call either way.
    //
    // The welcome is once per PERSON (billing-service #507), so billing is told
    // who signed up: the internal user uuid client-service wrote in this very
    // claim. Absent, the settle still runs without it (logged loud inside).
    const settled = await settleWelcomeOnSignup(session.orgId, outcome.userId);

    return cleared(
      req,
      NextResponse.json({
        claimed: true,
        alreadyClaimed: outcome.alreadyClaimed,
        brandId: session.brandId,
        // Reported so the caller can log it. NEVER rendered: no customer-facing
        // surface states the seed, and a sentence about a credit settle would
        // be the first thing that does.
        creditSettled: settled,
      }),
    );
  } catch (err) {
    console.error("[anon-claim] claim failed:", err);
    return NextResponse.json({ error: "Could not finish setting up your account" }, { status: 502 });
  }
}
