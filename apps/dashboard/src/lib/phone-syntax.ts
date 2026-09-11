/**
 * Syntax check for the phone number a customer types in onboarding.
 *
 * This app OWNS this rule, which is why it lives here rather than being read off
 * a producer. The onboarding number is written to Clerk user `publicMetadata`
 * through our own route, so there is no service to ask and no second copy to
 * drift from. That is the opposite of the brand sales-rep number, whose rule
 * belongs to brand-service and is deliberately NOT re-implemented in the
 * dashboard: a second copy of somebody else's rule is how the two come to
 * disagree. Same reasoning, opposite conclusion, because the owner differs.
 *
 * SYNTAX only. It answers "could this string be a phone number at all", never
 * "does this number ring somebody" (that needs a carrier lookup) and never
 * "is this number assigned" (that needs a live registry). So it refuses what is
 * impossible and accepts everything else.
 *
 * An EMPTY number is valid: the step is optional and skipping is a real answer.
 * The caller decides whether an empty value means "do not write", not this
 * module.
 *
 * Precision is deliberately UNEVEN and says so. The North American Numbering
 * Plan publishes an exact shape, so a +1 number is checked against it, which is
 * what catches a mistyped US number. Every other country gets the E.164 length
 * bound alone: a per-country digit table would be a rule invented here, stale
 * the first time a country widens its numbering, and wrong in the direction that
 * refuses a real customer's real number.
 */

export type PhoneParts = { dialCode: string; national: string };

/** Punctuation a person types inside a phone number and means nothing by. */
const SEPARATORS = /[\s\-.()/]/g;

/** E.164 caps the whole number, country code included, at 15 digits. */
const E164_MAX_DIGITS = 15;

/** Shortest national number anywhere. Below this it cannot be a number at all. */
const MIN_NATIONAL_DIGITS = 4;

/** The North American Numbering Plan: US, Canada and much of the Caribbean. */
export function isNanpDialCode(dialCode: string): boolean {
  return dialCode.replace(/\D/g, "") === "1";
}

/**
 * The digits a person meant, with the separators they typed removed.
 * `null` when anything survives that is not a digit, which is the caller's
 * signal that the string is not a number rather than a short one.
 */
export function phoneDigits(national: string): string | null {
  const stripped = (national ?? "").replace(SEPARATORS, "");
  if (stripped === "") return "";
  return /^\d+$/.test(stripped) ? stripped : null;
}

/**
 * The one sentence to show the customer, or `null` when the number is fine.
 * Every branch names what to DO, because a refusal that only says "invalid"
 * makes the person guess which part we did not like.
 */
export function phoneSyntaxProblem({ dialCode, national }: PhoneParts): string | null {
  const typed = (national ?? "").trim();
  if (typed === "") return null;

  // A pasted international number. The country is already chosen on the left,
  // so this is a specific, recognisable mistake worth naming as one.
  if (typed.startsWith("+")) {
    return "Leave out the country code, it is already set on the left.";
  }

  const digits = phoneDigits(typed);
  if (digits === null) {
    return "Use digits only. Spaces, dashes and brackets are fine.";
  }
  if (digits === "") {
    // Separators and nothing else.
    return "Enter a phone number.";
  }

  if (isNanpDialCode(dialCode)) {
    const nanp = nanpProblem(digits);
    if (nanp) return nanp;
    return null;
  }

  if (digits.length < MIN_NATIONAL_DIGITS) {
    return "That is too short for a phone number.";
  }
  const countryDigits = dialCode.replace(/\D/g, "").length;
  if (countryDigits + digits.length > E164_MAX_DIGITS) {
    return `That is too long. A phone number holds at most ${E164_MAX_DIGITS} digits, country code included.`;
  }
  return null;
}

/**
 * The NANP's own shape: a 10-digit number as NPA (area code) then NXX (central
 * office) then four digits. Both NPA and NXX start 2 to 9, and neither may end
 * in 11, which is reserved for service codes like 911 and 411. Those are
 * published rules, not a guess about what looks plausible.
 */
function nanpProblem(digits: string): string | null {
  if (digits.length !== 10) {
    return "A US or Canadian number has 10 digits after the +1.";
  }
  const npa = digits.slice(0, 3);
  const nxx = digits.slice(3, 6);

  if (npa[0] === "0" || npa[0] === "1") {
    return "A US or Canadian area code cannot start with 0 or 1.";
  }
  if (npa.endsWith("11")) {
    return `${npa} is a service code, not an area code.`;
  }
  if (nxx[0] === "0" || nxx[0] === "1") {
    return "The three digits after the area code cannot start with 0 or 1.";
  }
  if (nxx.endsWith("11")) {
    return `${nxx} cannot follow an area code, it is a service code.`;
  }
  return null;
}

/**
 * Strict E.164 for storage. Returns `""` for an empty number, which is what a
 * skipped step stores. Callers check `phoneSyntaxProblem` first; this does no
 * validation of its own, so it never silently repairs a bad number.
 */
export function toE164({ dialCode, national }: PhoneParts): string {
  const digits = (national ?? "").replace(/\D/g, "");
  if (digits === "") return "";
  return `+${dialCode.replace(/\D/g, "")}${digits}`;
}
