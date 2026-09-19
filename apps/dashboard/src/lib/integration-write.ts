/**
 * Turning a refused connect or disconnect into a sentence a customer can act on.
 *
 * The thrown error's own message field is NEVER rendered: `apiCall` sets it to
 * the whole downstream response body verbatim, which is how a raw JSON blob once
 * reached a customer's screen. This reads the STATUS, and the producer's own
 * `error` string only where the producer wrote it for a person.
 *
 * (That field is named in prose rather than spelled here on purpose: the guard
 * that forbids rendering it is a source-substring scan, and it would match its
 * own explanation.)
 *
 * The vendor's refusal is the one message worth passing through in full. When a
 * token does not authenticate, or is bound to a different account than the id
 * that was typed, only the vendor knows why — crm-service forwards its words and
 * so do we. Replacing that with "Could not connect" throws away the one thing
 * that tells the customer which of the two fields to fix.
 *
 * Alias-free on purpose, so this carries REAL unit tests. Keep it that way.
 */

/** Longest producer sentence we will render before truncating. */
const MAX_UPSTREAM = 400;

function statusOf(err: unknown): number | null {
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : null;
}

function upstreamError(err: unknown): string | null {
  const body = (err as { body?: unknown } | null)?.body;
  if (!body || typeof body !== "object") return null;
  const e = (body as Record<string, unknown>).error;
  return typeof e === "string" && e.trim() ? e.trim().slice(0, MAX_UPSTREAM) : null;
}

/**
 * Why a connect attempt was refused.
 *
 * A 400 is the producer talking: it is either the vendor's own refusal forwarded
 * through, or a missing credential. Both are sentences written for a person, so
 * both are rendered as they are.
 */
export function connectErrorMessage(err: unknown): string {
  const status = statusOf(err);
  const upstream = upstreamError(err);

  if (status === 400 && upstream) return upstream;
  if (status === 401 || status === 403) {
    return "You do not have access to this brand.";
  }
  if (status === 404) return "This brand no longer exists.";
  if (status === 502 || status === 503) {
    return "We could not reach your CRM just now. Try again in a moment.";
  }
  if (upstream) return upstream;
  return "Could not connect your CRM. Try again.";
}

/** Why storing the credential itself failed, before any vendor call happened. */
export function credentialErrorMessage(err: unknown): string {
  const status = statusOf(err);
  const upstream = upstreamError(err);

  if (status === 400 && upstream) return upstream;
  if (status === 401 || status === 403) {
    return "You do not have access to this brand.";
  }
  return "Could not save your credential. Try again.";
}

/** Why a disconnect failed. */
export function disconnectErrorMessage(err: unknown): string {
  const status = statusOf(err);
  if (status === 404) {
    // Already gone is the state the customer asked for, so it is not a failure.
    return "";
  }
  const upstream = upstreamError(err);
  if (status === 400 && upstream) return upstream;
  return "Could not disconnect. Try again.";
}
