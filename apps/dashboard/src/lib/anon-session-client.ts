/**
 * Starting the signed-out session, from the browser.
 *
 * One call, made once, at the moment the wizard is about to create a brand. The
 * server decides everything — whether the website is one, whether somebody
 * already owns it, whether the org and its credit line could be brought into
 * being — and answers with a sentence to show if the answer is no.
 *
 * A refusal is NOT an error. It means the visitor gets the flow we shipped
 * before this existed, where the card comes first, so the caller renders the
 * sentence and sends them to signup rather than stopping them.
 */

import posthog from "posthog-js";

export interface AnonSessionStarted {
  started: true;
  domain: string | null;
}

/** One onboarding start = one anonymous org created. Recorded here, the single
 *  door both onboardings (v1 /onboarding, v2 /get-started) go through, so the
 *  weekly brief's PostHog count and client-service's anonymous orgs are the SAME
 *  population, joined on `org_id` (daily-update 04). A reused session created
 *  nothing and records nothing. */
export const ANON_ORG_CREATED_EVENT = "anonymous_org_created";

export interface AnonSessionRefused {
  started: false;
  /** Shown to the visitor verbatim. */
  message: string;
  /**
   * Why, in the server's own vocabulary (`claimed` / `bad-website` /
   * `cannot-verify`), read as a plain string so a reason the server adds later
   * parses. `unreachable` is ours: the request itself never completed. The one
   * reader that branches on it is the sign-up redirect, which needs to tell a
   * website somebody already holds apart from a website we could not check.
   */
  reason: string;
}

export type AnonSessionResult = AnonSessionStarted | AnonSessionRefused;

/** What a visitor is told when the request itself did not complete. Same
 *  outcome as every other refusal: they continue, with the card first. */
const UNREACHABLE = "We couldn't get set up just now. Continue and we'll get you started.";

export async function startAnonSession(
  website: string,
  opts?: { noWebsite?: boolean },
): Promise<AnonSessionResult> {
  // The visitor said they HAVE no website. Sent as its own flag rather than as
  // an empty `website`, because the server refuses a blank field as the typo it
  // usually is — the two cases look identical on the wire and are opposite in
  // meaning. See `StartInput.noWebsite`.
  const noWebsite = opts?.noWebsite === true;
  try {
    const res = await fetch("/api/anon/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(noWebsite ? { website: "", noWebsite: true } : { website }),
    });

    // The route answers 200 for a refusal too — from the visitor's side nothing
    // went wrong — so a non-ok status is a genuine failure of ours.
    if (!res.ok) {
      console.error(`[anon-session] start failed: ${res.status}`);
      return { started: false, message: UNREACHABLE, reason: "unreachable" };
    }

    const body = (await res.json()) as {
      started?: unknown;
      message?: unknown;
      domain?: unknown;
      reason?: unknown;
      created?: unknown;
      orgId?: unknown;
    };

    if (body.started === true) {
      const domain = typeof body.domain === "string" ? body.domain : null;
      if (body.created === true) {
        if (typeof body.orgId === "string") {
          posthog.capture(ANON_ORG_CREATED_EVENT, { org_id: body.orgId, domain });
        } else {
          console.error("[anon-session] created an org but the response carried no orgId", body);
        }
      }
      return { started: true, domain };
    }

    return {
      started: false,
      message: typeof body.message === "string" && body.message.length > 0
        ? body.message
        : UNREACHABLE,
      reason: typeof body.reason === "string" && body.reason.length > 0
        ? body.reason
        : "unreachable",
    };
  } catch (err) {
    console.error("[anon-session] start errored:", err);
    return { started: false, message: UNREACHABLE, reason: "unreachable" };
  }
}
