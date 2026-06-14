// Custom Clerk session-token claims (configured in Clerk Dashboard →
// Customize session token). Typing the global `CustomJwtSessionClaims`
// interface makes `auth().sessionClaims.<claim>` type-safe everywhere
// (middleware + route handlers). See DIS-111.
export {};

declare global {
  interface CustomJwtSessionClaims {
    /** `{{org.public_metadata}}` of the active org — present only when an org is active. */
    orgMeta?: {
      onboardingComplete?: boolean;
    };
    /** `{{user.primary_email_address}}` — forwarded to api-service as x-email. */
    email?: string;
    /** `{{user.first_name}}` — forwarded as x-first-name. */
    firstName?: string;
    /** `{{user.last_name}}` — forwarded as x-last-name. */
    lastName?: string;
  }
}
