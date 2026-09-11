/**
 * The links inside an email body, so a reader can follow one.
 *
 * The lead panel draws every message — the copy we wrote, what actually went out,
 * and what the prospect wrote back — through ONE plain-text block. A destination
 * URL therefore rendered as inert text: a customer could read it and not click it,
 * and the tracking parameters we put on it sat in the middle of the sentence taking
 * up a line and a half. Reported as three complaints at once: the same email stated
 * twice, worded differently each time, with the link written differently in each.
 *
 * The de-duplication is lead-service's (the timeline sorts nothing, de-duplicates
 * nothing, and decides nothing of its own). What belongs HERE is the rendering: a
 * URL becomes a link.
 *
 * ⚠️ THE SPLIT IS THE SENDER'S OWN RULE, DELIBERATELY. instantly-service already
 * decides, at send time, that the link's visible TEXT drops its query string while
 * the href keeps the whole URL — so the prospect reads a clean address and the click
 * still carries every tracking parameter to the destination. Applying the identical
 * rule here means one grammar of link fleet-wide: what a reader sees in the panel is
 * what the prospect saw in their inbox, and hovering reveals the full destination in
 * the browser's status bar. A second rule would make the panel disagree with the mail.
 *
 * ⚠️ NOTHING IS INVENTED. A URL that carries no query renders its own text; a body
 * that carries no URL renders exactly as it did before. We never add a parameter a
 * body does not have, and we never rewrite a destination — a message read back off
 * the outreach provider legitimately carries a plainer URL than the copy we drafted,
 * and stating it as-is is the honest answer.
 *
 * Alias-free on purpose (no `@/…` import) so it carries real unit tests rather than
 * source-substring guards — keep it that way.
 */

/** One run of the body: prose, or a link a reader can follow. */
export type EmailBodySegment =
  | { kind: "text"; text: string }
  | { kind: "link"; text: string; href: string };

/**
 * A link as lead-service resolved it: what the prospect SAW, and where it truly leads.
 *
 * `href` is the destination WE wrote, tracking parameters included, resolved against
 * the copy we generated — so the outreach provider's click-tracking redirect can never
 * appear here, and following one from the dashboard cannot register a click the prospect
 * never made. `null` is a first-class answer meaning the producer could not resolve the
 * link to a URL we wrote (it matched none, or matched several parameterizations of one
 * page); it is never a guess.
 *
 * Structural on purpose, so this module stays alias-free: the producer owns the shape
 * and the reader's schema declares it.
 */
export interface MessageLink {
  text: string;
  href: string | null;
}

/**
 * Only `http` and `https`.
 *
 * A bare domain is NOT linkified: an email body is full of them (the signature, the
 * sender's own address, a company name written as `acme.com`) and turning those into
 * links would invent destinations nobody chose. And no other scheme is admitted at
 * all — `javascript:` in an anchor is script execution on click, and the whole point
 * of building segments rather than injecting markup is that no body can reach the DOM
 * as anything but text and href.
 */
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;

/**
 * Punctuation that ends a SENTENCE rather than a URL.
 *
 * A link at the end of a line is written `… works here: https://site.com/page.` and
 * the final stop belongs to the prose. Swallowing it into the href produces a
 * destination that 404s, which is worse than not linking at all.
 */
const TRAILING_PUNCTUATION = new Set([".", ",", ";", ":", "!", "?", "'", '"', "»", "…", "*", "_"]);

/** Closers that only belong to the URL when the URL opened them itself. */
const BRACKET_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
];

/**
 * Where the URL really ends.
 *
 * Applied repeatedly until stable, because a link can end on several of these at
 * once (`(see https://site.com/page.)`).
 */
export function trimUrlEnd(raw: string): string {
  let url = raw;
  for (;;) {
    const last = url.slice(-1);
    if (!last) return url;
    if (TRAILING_PUNCTUATION.has(last)) {
      url = url.slice(0, -1);
      continue;
    }
    const pair = BRACKET_PAIRS.find(([, close]) => close === last);
    if (pair) {
      const [open, close] = pair;
      const opened = url.split(open).length - 1;
      const closed = url.split(close).length - 1;
      if (closed > opened) {
        url = url.slice(0, -1);
        continue;
      }
    }
    return url;
  }
}

/**
 * What the reader SEES for a destination, which is the URL without its query.
 *
 * Byte-equal to the rule instantly-service applies when it composes the message, so
 * the panel and the inbox agree. The fragment is KEPT: it is part of the address a
 * person would read out, and the sender does not strip it either.
 */
export function linkDisplayText(href: string): string {
  const cut = href.indexOf("?");
  if (cut < 0) return href;
  const stripped = href.slice(0, cut);
  // A URL that is nothing BUT a query would render as a bare scheme, which states
  // less than the whole thing does. Then the full URL is the honest display.
  const authority = stripped.split("://")[1] ?? "";
  return authority.length > 0 ? stripped : href;
}

/**
 * The destination for each link text the producer could resolve.
 *
 * Keyed on the text because lead-service states one entry per LINK, not one per
 * occurrence — the same URL written twice in a body is one destination. An entry whose
 * `href` is null is deliberately absent from the map: the caller then falls through to
 * the URL as written, which is what the prospect saw and is the honest reading of a
 * destination nobody can resolve.
 */
function resolvedHrefs(links: readonly MessageLink[] | null | undefined): Map<string, string> {
  const byText = new Map<string, string>();
  for (const link of links ?? []) {
    if (link.href) byText.set(link.text, link.href);
  }
  return byText;
}

/**
 * Split a body into prose and links, in order.
 *
 * The caller renders each segment: a `text` run verbatim, a `link` as an anchor whose
 * label is `text` and whose destination is `href`. An empty body yields no segments,
 * so a caller cannot mistake "nothing to read" for "one empty line".
 *
 * `links` is what the producer resolved for a message we HOLD. Where it names a
 * destination, that destination wins — it carries the tracking parameters the sender
 * stripped out of the visible text, which is the whole reason a reader wants the link
 * rather than the string. Where it does not (a drafted body, an older payload, a link
 * the producer could not resolve), the URL as written is the destination, exactly as it
 * was before this existed. ⚠️ The producer trims a trailing bracket unconditionally
 * while this trims one the URL never opened, so a destination like `…/Foo_(bar)` is
 * spelled differently on the two sides and simply does not match — it then renders as
 * its own link, which is the same honest degrade.
 */
export function emailBodySegments(
  body: string,
  links?: readonly MessageLink[] | null,
): EmailBodySegment[] {
  if (!body) return [];
  const resolved = resolvedHrefs(links);
  const segments: EmailBodySegment[] = [];
  let cursor = 0;
  // A fresh regex per call: `lastIndex` on a module-level /g regex is shared state,
  // so two bodies rendered in the same pass would read each other's position.
  const pattern = new RegExp(URL_PATTERN.source, "gi");
  for (;;) {
    const match = pattern.exec(body);
    if (!match) break;
    const href = trimUrlEnd(match[0]);
    // Everything was punctuation — leave it as prose rather than emit an empty link.
    if (!href) continue;
    if (match.index > cursor) {
      segments.push({ kind: "text", text: body.slice(cursor, match.index) });
    }
    segments.push({
      kind: "link",
      text: linkDisplayText(href),
      href: resolved.get(href) ?? href,
    });
    cursor = match.index + href.length;
    // Re-anchor after the trim, so punctuation we handed back to the prose is not
    // skipped over by the next scan.
    pattern.lastIndex = cursor;
  }
  if (cursor < body.length) {
    segments.push({ kind: "text", text: body.slice(cursor) });
  }
  return segments;
}
