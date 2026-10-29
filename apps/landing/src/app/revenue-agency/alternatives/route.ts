/** Moved with the Agency page to `/gtm-agency` (see `../route.ts`). */
export function GET() {
  return new Response(null, { status: 308, headers: { Location: "/gtm-agency/alternatives" } });
}
