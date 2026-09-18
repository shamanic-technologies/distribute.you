import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { anonSessionStart } from "@/lib/anon-session-start";
import {
  ANON_COOKIE_OPTIONS,
  ANON_FLAG_COOKIE,
  ANON_SESSION_COOKIE,
} from "@/lib/anon-session-cookie";
import {
  ANON_ORG_PREFIX,
  ANON_PRINCIPAL,
  signAnonSession,
} from "@/lib/anon-session-token";
import { seedTrialCredit } from "@/lib/billing-service";
import { domainClaim } from "@/lib/brand-service";
import { createAnonymousOrg } from "@/lib/client-service";
import { extractDomain } from "@/lib/extract-domain";

/**
 * Where a signed-out visitor's setup begins.
 *
 * Four things happen, in this order, and the order is the design: each one is
 * harder to undo than the last, so the cheapest refusals come first.
 *
 *   1. Is this a website at all? The shared rule, so the field says the same
 *      thing here as everywhere else a URL is typed.
 *   2. Does somebody already own it? Asked BEFORE anything is created, because
 *      creating the brand is what scrapes a site that may be a customer's.
 *   3. Bring the org into being, DECLARING that it has no identity provider.
 *      That declaration is what makes it claimable at signup; an org created
 *      without it is stranded forever, and nothing would say so until the
 *      customer had already paid.
 *   4. Seed it. Until this lands the org can do nothing — every LLM call in the
 *      wizard is refused by the affordability gate — so a failure here refuses
 *      the whole session rather than handing somebody a wizard that hangs.
 *
 * REFUSING IS CHEAP AND MEANS ONE THING: the visitor gets the flow we shipped
 * before this existed, where the card comes first. Nobody is turned away, which
 * is what makes it safe to fail closed on every uncertain case.
 *
 * The BRAND is deliberately NOT created here. It is the wizard's own first step
 * against the session, through the allowlisted proxy, so there is exactly one
 * code path that creates a brand and it is the one the authed flow already uses.
 */

const isSecure = (req: NextRequest): boolean => new URL(req.url).protocol === "https:";

/** A refusal the caller renders verbatim. 200, not an error status: from the
 *  visitor's side nothing went wrong, they simply get the other flow. */
function refuse(req: NextRequest, message: string, reason: string): NextResponse {
  const res = NextResponse.json({ started: false, reason, message });
  const opts = { ...ANON_COOKIE_OPTIONS(isSecure(req)), maxAge: 0 };
  // Clear any stale session rather than leaving a browser holding one it is
  // about to stop using. `cookies.set`, never two header appends — see the note
  // on ANON_COOKIE_OPTIONS.
  res.cookies.set(ANON_SESSION_COOKIE, "", { ...opts, httpOnly: true });
  res.cookies.set(ANON_FLAG_COOKIE, "", opts);
  return res;
}

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_DISTRIBUTE_API_KEY;
  if (!secret) {
    console.error("[anon-session] ADMIN_DISTRIBUTE_API_KEY is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  let website = "";
  try {
    const body = (await req.json()) as { website?: unknown };
    website = typeof body.website === "string" ? body.website : "";
  } catch {
    return refuse(req, "We could not read that. Try again.", "bad-request");
  }

  const domain = extractDomain(website);
  // The claim question needs a domain to ask about. An unparseable one is the
  // visitor's own typo and the website rule below states it in its own words.
  const claim = domain ? await domainClaim(domain) : "unknown";

  const decision = anonSessionStart({ website, claim });
  if (!decision.start) {
    return refuse(req, decision.refusal.message, decision.refusal.reason);
  }

  const anonOrgId = `${ANON_ORG_PREFIX}${randomUUID()}`;

  try {
    // Declaring the org anonymous is the load-bearing half of this call. The
    // gateway resolves identity with a body of its own and cannot say it, so
    // this is the one create that does not go through the gateway.
    const { orgId } = await createAnonymousOrg(anonOrgId, ANON_PRINCIPAL);

    // Nothing works until this lands, so a failure refuses the session.
    await seedTrialCredit(orgId);

    const token = signAnonSession(
      {
        anonOrgId,
        orgId,
        // The wizard creates the brand as its first act against the session and
        // the allowlist binds every brand-scoped call to it, so the token is
        // re-minted with the real id then. Until then there is none, and an
        // empty brand id is refused by the allowlist rather than matching
        // anything — which is the correct state for a session that owns no
        // brand yet.
        brandId: "",
        domain: domain ?? "",
        issuedAt: Math.floor(Date.now() / 1000),
      },
      secret,
    );

    const res = NextResponse.json({ started: true, website: decision.website, domain });
    const opts = ANON_COOKIE_OPTIONS(isSecure(req));
    res.cookies.set(ANON_SESSION_COOKIE, token, { ...opts, httpOnly: true });
    res.cookies.set(ANON_FLAG_COOKIE, "1", opts);
    return res;
  } catch (err) {
    // Logged as the real failure it is, then degraded to the pay-first flow.
    // Never a session without credit, and never a session on an org nobody can
    // claim: both look like they work and fail after the customer has paid.
    console.error("[anon-session] could not start:", err);
    return refuse(
      req,
      "We couldn't get set up just now. Continue and we'll get you started.",
      "could-not-start",
    );
  }
}
