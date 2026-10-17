/**
 * The email style the visitor picks in the `emails` arm of the get-started A/B (owner
 * 2026-10-17): Offer, Direct named, Direct unnamed, several allowed, at least one. Each style
 * is a features-service TACTIC Jev puts on every workflow (`offer-angle`, `named-angle`,
 * `blind-angle`); the pick is a STRATEGY on the cold email pipe, never a workflow: one style =
 * `<style>-emails-only`, two = `no-<the third>-emails`, all three = the pipe's default play.
 * features-service still runs the best ROI among the workflows the strategy allows.
 *
 * Alias-free so it carries real unit tests.
 */

export const EMAIL_ANGLES = [
  { key: "offer", label: "Offer", line: "Opens with something you give for free.", only: "offer-emails-only", without: "no-offer-emails" },
  { key: "named", label: "Direct, named", line: "Names your company and pitches it.", only: "named-emails-only", without: "no-named-emails" },
  { key: "blind", label: "Direct, unnamed", line: "Asks about their problem first, without naming you.", only: "blind-emails-only", without: "no-blind-emails" },
] as const;

export type EmailAngle = (typeof EMAIL_ANGLES)[number]["key"];

/** Every strategy an angle pick can name: a funnel on one of them runs only when asked for. */
export const ANGLE_STRATEGY_IDS: ReadonlySet<string> = new Set(EMAIL_ANGLES.flatMap((a) => [a.only, a.without]));

/** The cold email pipe whose play the pick sets. */
export const ANGLE_CHANNEL = "sales-cold-email-outreach";

/** The strategy a pick asks for, or null for the default play (every style ticked). Empty is refused upstream. */
export function angleStrategy(ticked: ReadonlySet<EmailAngle>): string | null {
  const on = EMAIL_ANGLES.filter((a) => ticked.has(a.key));
  if (on.length === 0 || on.length === EMAIL_ANGLES.length) return null;
  if (on.length === 1) return on[0].only;
  return EMAIL_ANGLES.find((a) => !ticked.has(a.key))!.without;
}

/** The strategy a funnel id runs on its cold email pipe (`…@sales-cold-email-outreach~<id>+…`), or null for its default play. */
export function coldEmailStrategyOf(funnelId: string): string | null {
  const m = funnelId.match(new RegExp(`@${ANGLE_CHANNEL}~([^+]+)`));
  return m ? m[1] : null;
}

/** True when a funnel runs exactly what the pick asks: the asked strategy, or no angle strategy at all. */
export function funnelFitsAngles(funnelId: string, strategy: string | null): boolean {
  const s = coldEmailStrategyOf(funnelId);
  return strategy ? s === strategy : s == null || !ANGLE_STRATEGY_IDS.has(s);
}

/** Toggling a style never leaves none ticked (at least one is required). */
export function toggleAngle(ticked: ReadonlySet<EmailAngle>, key: EmailAngle): Set<EmailAngle> {
  const next = new Set(ticked);
  if (next.has(key)) {
    if (next.size > 1) next.delete(key);
  } else next.add(key);
  return next;
}
