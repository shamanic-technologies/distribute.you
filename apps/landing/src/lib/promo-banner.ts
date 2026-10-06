/**
 * Time-boxed promotions on a served page. A promo is wrapped in
 * `<!--promo:until=YYYY-MM-DD-->…<!--/promo-->` and is removed from the response from
 * that day on (00:00 UTC), so an expired offer is never promised, with no deploy.
 * Owner 2026-10-06: "we match your first $100" runs until October 31, 2026 as a
 * banner only, never in the tagline or the pricing section.
 *
 * Alias-free and pure so it carries real unit tests.
 */
const PROMO = /<!--promo:until=(\d{4}-\d{2}-\d{2})-->([\s\S]*?)<!--\/promo-->\n?/g;

export function applyPromoBanners(html: string, now: Date): string {
  return html.replace(PROMO, (block, until: string) => {
    const end = Date.parse(`${until}T00:00:00Z`);
    if (Number.isNaN(end)) throw new Error(`[landing] promo with an unreadable end date: ${until}`);
    return now.getTime() >= end ? "" : block;
  });
}
