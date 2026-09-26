import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { anonSessionStart, canReuseAnonSession } from "@/lib/anon-session-start";
import { websiteInputProblem } from "@/lib/website-input";
import {
  ANON_COOKIE_OPTIONS,
  ANON_FLAG_COOKIE,
  ANON_SESSION_COOKIE,
} from "@/lib/anon-session-cookie";
import {
  ANON_ORG_PREFIX,
  ANON_PRINCIPAL,
  readAnonSession,
  signAnonSession,
} from "@/lib/anon-session-token";
import { seedTrialCredit } from "@/lib/billing-service";
import { domainClaim } from "@/lib/brand-service";
import { createAnonymousOrg, recordAcquisition } from "@/lib/client-service";
import { firstTouchForHandover } from "@/lib/first-touch";
import { extractDomain } from "@/lib/extract-domain";

/**
 * Where a signed-out visitor's setup begins.
 *
 * Five things happen, in this order, and the order is the design: each one is
 * harder to undo than the last, so the cheapest refusals come first.
 *
 *   1. Is this a website at all? The shared rule, so the field says the same
 *      thing here as everywhere else a URL is typed. It does NOT clear a held
 *      session: a typo must not cost somebody the walk they are in the middle
 *      of, and destroying it here would make the retry mint a duplicate.
 *   1b. Is this browser already walking this exact domain? Then it is the same
 *      walk and it keeps the org it has. Nothing is asked and nothing is
 *      created — the cheapest outcome of all, and the common one: a reload, a
 *      back button, or typing the same website twice.
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
function refuse(
  req: NextRequest,
  message: string,
  reason: string,
  { clearSession = true }: { clearSession?: boolean } = {},
): NextResponse {
  const res = NextResponse.json({ started: false, reason, message });
  if (!clearSession) return res;
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
  let noWebsite = false;
  try {
    const body = (await req.json()) as { website?: unknown; noWebsite?: unknown };
    website = typeof body.website === "string" ? body.website : "";
    // DECLARED, never inferred from an empty `website` — see the note on
    // StartInput. A blank field is a typo and keeps being refused as one.
    noWebsite = body.noWebsite === true;
  } catch {
    return refuse(req, "We could not read that. Try again.", "bad-request");
  }

  // No website means no domain, which means the website rule has nothing to
  // judge and the claim question has nothing to ask about. Both are skipped
  // deliberately below rather than being handed an empty string, which they
  // would correctly refuse.
  const domain = noWebsite ? null : extractDomain(website);

  // The website rule runs FIRST, and ahead of the reuse branch, because a typo
  // is a typo whatever session is held: `extractDomain` is looser than the rule
  // (it reads `kevin@acme.com` as `acme.com`), so a held session for acme.com
  // would otherwise make a refused input succeed. Same function the decision
  // below calls — one rule, asked at each point that needs it, never a copy.
  //
  // It does NOT clear the session: the held walk is for a DIFFERENT, valid
  // website and is still usable, and destroying it would cost the visitor their
  // org for a keystroke — after which retyping correctly mints the duplicate
  // this whole branch exists to prevent.
  const badWebsite = noWebsite ? null : websiteInputProblem(website);
  if (badWebsite) return refuse(req, badWebsite, "bad-website", { clearSession: false });

  // Is this browser already walking this exact domain? Then it is the same
  // walk, and it keeps the org it already has. Checked BEFORE the claim
  // question because a reused session asks nobody anything: no claim lookup, no
  // org, no seed, and nothing the visitor already built is orphaned.
  //
  // The token is verified (signature + expiry) by `readAnonSession`, so getting
  // a session back here is proof this browser minted that org. A refused token
  // simply falls through to the ordinary path and mints a fresh one.
  const held = readAnonSession(req.cookies.get(ANON_SESSION_COOKIE)?.value, secret).session;
  if (canReuseAnonSession(held, domain, noWebsite)) {
    // Re-set the SAME token rather than minting one. Re-signing would move
    // `issuedAt` and turn a bounded session into a rolling credential, which is
    // the one thing its own expiry exists to prevent; re-setting repairs a
    // missing flag cookie and costs nothing.
    const res = NextResponse.json({ started: true, website: website.trim(), domain, reused: true });
    const opts = ANON_COOKIE_OPTIONS(isSecure(req));
    res.cookies.set(ANON_SESSION_COOKIE, req.cookies.get(ANON_SESSION_COOKIE)!.value, {
      ...opts,
      httpOnly: true,
    });
    res.cookies.set(ANON_FLAG_COOKIE, "1", opts);
    return res;
  }

  // The claim question needs a domain to ask about. An unparseable one is the
  // visitor's own typo and the website rule below states it in its own words.
  // Not asked at all on the no-website path: there is no domain to ask about,
  // and `unknown` is read as "could not verify", which would refuse everyone.
  const claim = noWebsite ? "unclaimed" : domain ? await domainClaim(domain) : "unknown";

  const decision = anonSessionStart({ website, claim, noWebsite });
  if (!decision.start) {
    return refuse(req, decision.refusal.message, decision.refusal.reason);
  }

  const anonOrgId = `${ANON_ORG_PREFIX}${randomUUID()}`;

  try {
    // Declaring the org anonymous is the load-bearing half of this call. The
    // gateway resolves identity with a body of its own and cannot say it, so
    // this is the one create that does not go through the gateway.
    const { orgId } = await createAnonymousOrg(anonOrgId, ANON_PRINCIPAL);

    // Which channel brought this visitor, recorded on the org while it is
    // still anonymous: the claim keeps the internal uuid, so the credit
    // survives signup. Awaited (the org must carry it before anything else
    // can) but never fatal — it logs its own failure.
    await recordAcquisition({ orgId }, firstTouchForHandover(req.headers.get("cookie")));

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
