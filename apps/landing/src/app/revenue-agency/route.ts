/**
 * The Agency page shipped here on 2026-10-29 and moved to `/gtm-agency` the same day
 * (owner: "revenue agency" searches are people looking for a tax office). A permanent
 * redirect keeps any link already pointing here. Relative `Location`: `request.url` is
 * the bind address on the box.
 */
export function GET() {
  return new Response(null, { status: 308, headers: { Location: "/gtm-agency" } });
}
