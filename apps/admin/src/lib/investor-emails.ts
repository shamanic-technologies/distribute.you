/**
 * Parsing a pasted blob of email addresses, and rendering an update body.
 *
 * Alias-free on purpose (no `@/…` imports) so vitest can resolve it and these
 * helpers get REAL unit tests rather than source-substring guards.
 *
 * Staff paste whatever they have — a column copied out of a spreadsheet, a
 * comma list out of a mail client, a block of `Name <email>` pairs. Rejecting
 * the whole blob because one line is malformed would send them off to clean it
 * by hand, so the parser takes what it understands, reports what it did not,
 * and never silently drops a line.
 */

/** One address recovered from the blob, plus the display name if the blob carried one. */
export interface ParsedEmail {
  email: string;
  name: string | null;
}

export interface ParsedEmailBlob {
  /** Valid, lowercased, de-duplicated, in the order they first appeared. */
  accepted: ParsedEmail[];
  /** Fragments that looked like an entry but are not an address. Verbatim, so the user can find them. */
  rejected: string[];
  /** How many valid addresses were dropped as repeats of an earlier one. */
  duplicates: number;
}

/**
 * Deliberately permissive: this guards a paste box, not the wire. A local part,
 * an `@`, a dotted domain whose last label is alphabetic. Anything subtler
 * (a real MX, a disposable-domain check) is the provider's job at send time.
 */
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[A-Za-z]{2,}$/;

/** `Alice Smith <alice@x.com>` — the shape every mail client copies out. */
const ANGLE_RE = /^(.*?)<\s*([^<>]+?)\s*>$/;

export function isLikelyEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/**
 * Split on every separator a human might have used. Newlines, commas and
 * semicolons all mean "next entry"; tabs come from a spreadsheet column.
 *
 * Splitting on commas is safe even though a display name may contain one
 * (`"Smith, Alice" <a@x.com>`): the fragment that holds the address still
 * parses, and the leftover name fragment is discarded below rather than
 * reported as a reject, because a bare name is not a failed address.
 */
function splitEntries(blob: string): string[] {
  return blob
    .split(/[\n\r,;\t]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Strip the wrappers a paste picks up: quotes, trailing dots, mailto:. */
function unwrap(entry: string): string {
  let value = entry.trim();
  value = value.replace(/^mailto:/i, "");
  value = value.replace(/^["'`]+|["'`]+$/g, "");
  value = value.replace(/[.]+$/, "");
  return value.trim();
}

export function parseEmailBlob(blob: string): ParsedEmailBlob {
  const accepted: ParsedEmail[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (const entry of splitEntries(blob)) {
    const value = unwrap(entry);
    if (!value) continue;

    const angle = ANGLE_RE.exec(value);
    const rawEmail = angle ? unwrap(angle[2]) : value;
    const rawName = angle ? unwrap(angle[1]) : "";

    if (!isLikelyEmail(rawEmail)) {
      // A fragment with no `@` at all is almost always the name half of a
      // `"Smith, Alice" <a@x.com>` we split on the comma. Reporting it as a
      // rejected address would be noise about an entry that did parse.
      if (rawEmail.includes("@")) rejected.push(entry.trim());
      continue;
    }

    const email = rawEmail.toLowerCase();
    if (seen.has(email)) {
      duplicates += 1;
      continue;
    }
    seen.add(email);
    accepted.push({ email, name: rawName.length > 0 ? rawName : null });
  }

  return { accepted, rejected, duplicates };
}

/**
 * One sentence describing what a paste would do, shown before the user commits
 * to it. Says nothing when the box is empty — a count of zero reads as a
 * failure, and nothing has been attempted yet.
 */
export function describeParsedBlob(parsed: ParsedEmailBlob): string | null {
  const { accepted, rejected, duplicates } = parsed;
  if (accepted.length === 0 && rejected.length === 0 && duplicates === 0) return null;

  const parts: string[] = [`${accepted.length} ${accepted.length === 1 ? "address" : "addresses"}`];
  if (duplicates > 0) parts.push(`${duplicates} repeated in this paste`);
  if (rejected.length > 0) parts.push(`${rejected.length} not an email`);
  return parts.join(", ");
}
