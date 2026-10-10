// The outbound leg rename (owner 2026-10-09): campaign-service now stores
//     start_to_conversation   ->  lead_found_to_conversation
//     start_to_website_visit  ->  lead_found_to_website_visit
// and features-service serves both spellings as one identity. Every leg key read into the
// Research pipeline goes through canonicalLeg, so a row stored before the rename and one stored
// after are the same leg. Without it the Research page read ZERO emails on both legs the day
// campaign-service migrated its rows (2026-10-10). Twin of apps/dashboard/src/lib/outbound-leg-key.ts.
export const HERALD_LEG = "lead_found_to_conversation";
export const SCOUT_LEG = "lead_found_to_website_visit";
const LEGACY = { start_to_conversation: HERALD_LEG, start_to_website_visit: SCOUT_LEG };
export const canonicalLeg = (key) => (key ? (LEGACY[key] ?? key) : null);
