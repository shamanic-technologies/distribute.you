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

export interface AnonSessionStarted {
  started: true;
  domain: string | null;
}

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

export async function startAnonSession(website: string): Promise<AnonSessionResult> {
  try {
    const res = await fetch("/api/anon/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website }),
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
    };

    if (body.started === true) {
      return { started: true, domain: typeof body.domain === "string" ? body.domain : null };
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
