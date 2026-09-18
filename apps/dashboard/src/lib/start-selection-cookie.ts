// WHAT THE VISITOR PICKED BEFORE THEY HAD AN ACCOUNT, carried across signup.
//
// The signed-out screens run before there is an account, so nothing they
// answer is in any database yet. Clerk's signup is a REDIRECT, and a query param does not
// survive it — `?url=` learned that the expensive way and needed a cookie of its
// own (`landing-url-cookie.ts`) for exactly this reason. A client store is no
// better: the picks have to be readable by the server render of the first
// authed screen, and IndexedDB restores after paint.
//
// So the selection rides a cookie. It is NOT httpOnly: the screens that write it
// are the signed-out ones, which are client components, and it carries no
// secret -- three lists of slugs the visitor is looking at.
//
// Only value imports that carry no "@" alias live here, so this module stays
// directly unit-testable (vitest does not resolve the alias).

export const START_SELECTION_COOKIE = "distribute-start";

/** Bumped only on an INCOMPATIBLE shape change. A visitor mid-signup when a
 *  deploy lands reads a version they do not recognise and simply starts the
 *  picks again -- which is correct, and far better than the server reading
 *  fields that mean something else now. */
const VERSION = 1;

/** A week. An abandoned selection older than that is better re-picked: the
 *  catalogue moves, and a funnel they chose may no longer be sold by a channel
 *  they kept. */
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** The cookie rides EVERY request to the origin, including each `/api/v1/*`
 *  proxy call, so the payload is capped hard. Forty of each is far past any
 *  real selection (production publishes 42 channels and 4 funnels) while
 *  keeping the header small. */
const MAX_ITEMS = 40;
/** Belt and braces on total size: a hand-edited cookie must not be able to make
 *  every request carry kilobytes. */
const MAX_VALUE_BYTES = 2048;

export interface StartSelection {
  /** Step keys the visitor wants to buy. */
  outcomes: string[];
  /**
   * Channel slugs the funnels run through.
   *
   * STATED rather than picked: we run one channel, so the screen that asked
   * which ones to keep offered a single real answer. The field survives because
   * what is bought is a (funnel x channel) pair -- the identity billing keys its
   * ceiling on -- and the payment and brand screens resolve those pairs out of
   * this cookie. A selection stored while the question existed can name other
   * channels; the readers narrow rather than refusing it.
   */
  channels: string[];
  /** Revenue funnel keys they want us to run. */
  funnels: string[];
  /**
   * Funnel keys already PAID for.
   *
   * Payment happens before there is a brand to attach a budget to -- the domain
   * is asked for afterwards -- so between the charge and the brand's creation
   * this is the only record that the money was taken. It is additive on purpose
   * and read tolerantly: a cookie written before this field existed reads as
   * "nothing paid yet", which is exactly right for a visitor who never reached
   * a payment screen, and does NOT warrant a version bump that would strand
   * somebody mid-flow.
   */
  paid: string[];
}

export const EMPTY_SELECTION: StartSelection = {
  outcomes: [],
  channels: [],
  funnels: [],
  paid: [],
};

/** A slug or key we are willing to store. Deliberately narrow: this value comes
 *  from a cookie a visitor can edit, and every one of these strings is later
 *  compared against the catalogue anyway, so anything outside the shape our own
 *  producers use is dropped rather than carried.
 *
 *  TWO SHAPES, because what is bought is a PAIR. A funnel and a channel joined by
 *  `::` is the identity billing keys its ceiling on (`startPairKey`), and it is
 *  what `funnels` and `paid` have named since the flow moved to pairs -- while
 *  this pattern still only admitted a bare slug, so EVERY pair key was silently
 *  dropped on the way to the cookie. In memory the payment screen carried on
 *  (`remember` sets state as well as the cookie), so the break only showed at the
 *  handoff: `/onboarding/build` reads the cookie fresh, found nothing paid, and
 *  sent somebody who had just been charged back to "pick what you want us to run".
 *  A widening needs no version bump -- every cookie that read before still reads. */
const SLUG = "[a-z0-9][a-z0-9_-]{0,63}";
const TOKEN = new RegExp(`^${SLUG}(::${SLUG})?$`);

function cleanList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string" || !TOKEN.test(v)) continue;
    if (!out.includes(v)) out.push(v);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/** Serialize a selection for the cookie. Returns the VALUE only — the caller
 *  owns how it is set, because the client and the server set cookies through
 *  different APIs. */
export function encodeStartSelection(selection: StartSelection): string {
  const payload = {
    v: VERSION,
    o: cleanList(selection.outcomes),
    c: cleanList(selection.channels),
    f: cleanList(selection.funnels),
    p: cleanList(selection.paid),
  };
  return encodeURIComponent(JSON.stringify(payload));
}

/**
 * Read a selection back.
 *
 * Anything unreadable — absent, malformed, a version we do not know, a field of
 * the wrong type — is an EMPTY selection, never a partial guess. The screens
 * then ask again, which is the honest outcome: a half-restored selection would
 * put the visitor on a payment screen for funnels they may not have chosen.
 */
export function decodeStartSelection(raw: string | undefined | null): StartSelection {
  if (!raw) return EMPTY_SELECTION;
  if (raw.length > MAX_VALUE_BYTES) return EMPTY_SELECTION;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || parsed.v !== VERSION) return EMPTY_SELECTION;
    return {
      outcomes: cleanList(parsed.o),
      channels: cleanList(parsed.c),
      funnels: cleanList(parsed.f),
      paid: cleanList(parsed.p),
    };
  } catch {
    return EMPTY_SELECTION;
  }
}

/** True when there is enough here to charge somebody for. A selection with no
 *  funnel buys nothing, so the payment screens must never open on one. */
export function selectionIsPayable(selection: StartSelection): boolean {
  return selection.funnels.length > 0 && selection.channels.length > 0;
}

/** True once money has actually been taken. The brand-building screens open on
 *  THIS, never on `selectionIsPayable`: a visitor who picked funnels and paid
 *  for none of them has bought nothing, and sending them past the payment step
 *  would hand them a brand nothing runs against. */
export function selectionIsPaid(selection: StartSelection): boolean {
  return selection.paid.length > 0;
}

/** The `document.cookie` assignment the signed-out screens write. Built here
 *  rather than at the call sites so the attributes cannot drift between them —
 *  the same split `tenant-identity-cookie.ts` uses. */
export function startSelectionCookieAssignment(selection: StartSelection): string {
  return [
    `${START_SELECTION_COOKIE}=${encodeStartSelection(selection)}`,
    "path=/",
    `max-age=${MAX_AGE_SECONDS}`,
    "samesite=lax",
  ].join("; ");
}

/** Clearing it is its own assignment, so no caller hand-writes an expiry. */
export function clearStartSelectionCookieAssignment(): string {
  return `${START_SELECTION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
