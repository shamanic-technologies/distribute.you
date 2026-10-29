/** Moved with the Agency page to `/gtm-agency` (see `../../route.ts`); an unknown slug 404s there. */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  return new Response(null, { status: 308, headers: { Location: `/gtm-agency/vs/${encodeURIComponent(slug)}` } });
}
