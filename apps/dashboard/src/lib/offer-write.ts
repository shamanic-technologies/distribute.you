// What to tell a customer when brand-service refuses to create, rename or draw an offer.
//
// The message is chosen from the HTTP STATUS and nothing else. `apiCall` sets the
// thrown Error's `message` to the whole downstream body verbatim, so rendering it
// puts a JSON blob in front of a real customer — the reason travels in the status,
// the details go to the console.
//
// brand-service owns the name rules (at most 2 words, at most 20 characters, unique
// within the brand) and its refusal is the answer, so nothing is pre-empted client
// side. What this module owns is only how the refusal READS.
//
// Alias-free on purpose — the caller extracts the status (`err instanceof ApiError
// ? err.status : null`) and passes a number, so this file carries real unit tests.
// Keep it that way; a runtime `@/...` import here turns them into resolution
// failures.

export type OfferWriteKind = "create" | "rename" | "generate";

/** The name rules, stated the way brand-service enforces them. */
export const OFFER_NAME_RULES = "at most 2 words and 20 characters";

export function offerWriteErrorMessage(status: number | null, kind: OfferWriteKind): string {
  // The image write carries no name, so the three name-shaped refusals cannot
  // reach it — it answers on access, on the offer being gone, and on everything
  // else. A 402 never gets here at all: `apiCall` opens the billing-guard modal on
  // that status, and a second sentence under it describes one refusal twice.
  if (kind === "generate") {
    if (status === 403) return "You do not have access to this offer.";
    if (status === 404) return "This offer no longer exists.";
    return "We could not draw this offer. Try again in a moment.";
  }
  if (status === 409) {
    return kind === "create"
      ? "This brand already sells something under that name. Pick another one."
      : "Another offer of this brand already uses that name. Pick another one.";
  }
  if (status === 400) {
    // NOT a generic "check your input". The only thing brand-service validates on
    // this body is the name, and it validates it three ways at once — saying which
    // three is the difference between a customer fixing it and re-typing the same
    // thing.
    return `That name is not allowed. An offer name is ${OFFER_NAME_RULES}.`;
  }
  if (status === 403) {
    return kind === "create"
      ? "You do not have access to this brand."
      : "You do not have access to this offer.";
  }
  if (status === 404) {
    return kind === "create"
      ? "This brand no longer exists."
      : "This offer no longer exists.";
  }
  return kind === "create"
    ? "We could not create this offer. Try again in a moment."
    : "We could not rename this offer. Try again in a moment.";
}
