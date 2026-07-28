/**
 * Shared Clerk error helpers for the custom auth pages (sign-in, sign-up,
 * forgot-password).
 *
 * These pages each used to carry their own copy of `clerkErrorMessage` /
 * `clerkErrorCode` / `isGoogleOnlyAccountError`, which drifted. One home.
 *
 * The analytics side matters as much as the display side: when Clerk rejects a
 * sign-up we used to capture only "it failed", so a stuck user was impossible to
 * diagnose after the fact. `authFailureProps` attaches the Clerk error CODE (a
 * fixed enum: `form_code_incorrect`, `form_identifier_not_found`, ...) and
 * nothing else, so the event is diagnosable and PII-free by construction.
 */

type ClerkErrorEntry = {
  code?: string;
  message?: string;
  longMessage?: string;
};

type ClerkErrorLike = {
  errors?: Array<ClerkErrorEntry>;
};

const entries = (err: unknown): Array<ClerkErrorEntry> => {
  const list = (err as ClerkErrorLike)?.errors;
  return Array.isArray(list) ? list : [];
};

/** Human-facing message for the error banner. */
export function clerkErrorMessage(err: unknown): string {
  const first = entries(err)[0];
  return (
    first?.longMessage ||
    first?.message ||
    "Something went wrong. Please try again."
  );
}

/** The first Clerk error code, or undefined when the throw is not from Clerk. */
export function clerkErrorCode(err: unknown): string | undefined {
  return entries(err)[0]?.code;
}

/**
 * Every Clerk error code, comma-joined. Clerk can return several at once (a
 * malformed field plus a rejected value); the first one alone hides the rest.
 */
export function clerkErrorCodes(err: unknown): string | undefined {
  const codes = entries(err)
    .map((e) => e.code)
    .filter((c): c is string => Boolean(c));
  return codes.length > 0 ? codes.join(",") : undefined;
}

/**
 * Clerk returns `strategy_for_user_invalid` ("The verification strategy is not
 * valid for this account") when the identified account has no password factor,
 * i.e. it was created via Google OAuth. This instance only offers Google and
 * email/password, so a password-less account is always a Google account.
 */
export function isGoogleOnlyAccountError(err: unknown): boolean {
  const first = entries(err)[0];
  return (
    first?.code === "strategy_for_user_invalid" ||
    /verification strategy is not valid/i.test(first?.message ?? "")
  );
}

/**
 * PostHog payload for an auth failure.
 *
 * Only ever emits the Clerk error code plus the caller's own context (stage,
 * provider). Never the message: Clerk interpolates the identifier into it
 * ("Couldn't find your account for x@y.com"), so forwarding the message would
 * ship an email address into analytics.
 *
 * A non-Clerk throw (network drop, CORS) reports `unknown` rather than omitting
 * the field, so "we could not classify this" stays visible in the funnel instead
 * of blending into the events that predate this instrumentation.
 */
export function authFailureProps(
  err: unknown,
  context?: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  return {
    ...context,
    code: clerkErrorCode(err) ?? "unknown",
    codes: clerkErrorCodes(err) ?? "unknown",
  };
}

/** Clerk email verification and password-reset codes are always 6 digits. */
export const VERIFICATION_CODE_LENGTH = 6;

/**
 * Normalize a typed or pasted verification code.
 *
 * A code copied out of a mail client routinely carries a trailing space or
 * newline, and some mobile keyboards insert spaces between digits. Clerk
 * compares the string verbatim and answers "Incorrect code", which reads to the
 * user as a broken product. Stripping the non-digits cannot mask a real error:
 * the field only ever holds a 6-digit number.
 */
export function sanitizeVerificationCode(raw: string): string {
  return raw.replace(/\D+/g, "").slice(0, VERIFICATION_CODE_LENGTH);
}
