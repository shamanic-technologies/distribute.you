/**
 * The offer's Channels tab (beta): one section per leg the offer's sales path has
 * VALIDATED, one row per channel that can work that leg, and in each row that
 * channel's own settings.
 *
 * Nothing here is a new model. The legs are brand-service's saved sales path
 * (`legKeys`), named and ordered by features-service's public catalogue; the
 * channels per leg are the catalogue's `legsByChannel`, narrowed to the channels the
 * Sales path tab offers, so the two tabs agree on what can work a leg. The only
 * settings today are cold email's two give lists, stored as the offer's
 * `giveForFree` / `neverGive` user-fields: what content-generation reads on every email.
 *
 * Alias-free on purpose (no runtime `@/` import, only the relative alias-free
 * `./brand-conversion-rates`) so it carries REAL unit tests.
 */

import { isLegRatePct } from "./brand-conversion-rates";
import { legKeyTwin, sameLegKey } from "./outbound-leg-key";

export interface ChannelLegSection {
  legKey: string;
  /** null for an entry leg (the lead was on no step before it). */
  fromKey: string | null;
  toKey: string;
  /** The channels that can work this leg, in catalogue order. Empty = the brand's own team. */
  channels: string[];
}

/**
 * The sections, in catalogue order: every SAVED leg the catalogue knows. A saved leg
 * the catalogue does not list is returned in `unknown` (the page logs it loudly)
 * rather than drawn under a name nobody published.
 */
export function validatedLegSections(
  catalogue: {
    legs: ReadonlyMap<string, { legKey: string; fromKey: string | null; toKey: string }>;
    legsByChannel: ReadonlyMap<string, readonly string[]>;
  },
  savedLegKeys: readonly string[],
  channelSlugs: Iterable<string>,
): { sections: ChannelLegSection[]; unknown: string[] } {
  const saved = new Set(savedLegKeys);
  const ours = new Set(channelSlugs);
  const byLeg = new Map<string, string[]>();
  for (const [slug, keys] of catalogue.legsByChannel) {
    if (!ours.has(slug)) continue;
    for (const k of keys) byLeg.set(k, [...(byLeg.get(k) ?? []), slug]);
  }
  const sections: ChannelLegSection[] = [];
  for (const leg of catalogue.legs.values()) {
    // brand-service and the catalogue may spell an outbound leg apart while they migrate.
    if (!saved.has(leg.legKey) && !saved.has(legKeyTwin(leg.legKey) ?? "")) continue;
    sections.push({ legKey: leg.legKey, fromKey: leg.fromKey, toKey: leg.toKey, channels: byLeg.get(leg.legKey) ?? [] });
  }
  const unknown = savedLegKeys.filter((k) => !catalogue.legs.has(k) && !catalogue.legs.has(legKeyTwin(k) ?? ""));
  return { sections, unknown };
}

/** One channel of the offer's Channels table, with every validated leg it works. */
export interface ChannelRow {
  slug: string;
  legs: { legKey: string; fromKey: string | null; toKey: string }[];
}

/**
 * The Channels table: one row per channel that works at least one validated leg, in
 * the order the sections first name it; its legs in catalogue order. A leg only the
 * brand's own team works (no channel) makes no row.
 */
export function channelRows(sections: readonly ChannelLegSection[]): ChannelRow[] {
  const rows = new Map<string, ChannelRow>();
  for (const s of sections) {
    for (const slug of s.channels) {
      const row = rows.get(slug) ?? { slug, legs: [] };
      row.legs.push({ legKey: s.legKey, fromKey: s.fromKey, toKey: s.toKey });
      rows.set(slug, row);
    }
  }
  return [...rows.values()];
}

/** The two give lists, by their brand-service user-field keys. */
export type GiveLists = { giveForFree: string[]; neverGive: string[] };

/**
 * A stored give list as lines. brand-service stores it as `string[]`; a bare string
 * (an older or hand-written row) is one item per LINE. Commas are kept: "a free
 * audit, a short call" is one promise, not two.
 */
export function giveListLines(value: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : [];
  return raw.map((l) => l.trim()).filter((l) => l.length > 0);
}

/** Textarea text back to lines: one item per line, list markers dropped, blanks dropped. */
export function parseGiveListText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter((l) => l.length > 0);
}

export function giveListsEqual(a: GiveLists, b: GiveLists): boolean {
  const same = (x: string[], y: string[]) => x.length === y.length && x.every((v, i) => v === y[i]);
  return same(a.giveForFree, b.giveForFree) && same(a.neverGive, b.neverGive);
}

/**
 * The PUT body for a save: BOTH keys, always. A key omitted from the PUT is left as
 * stored, so a list the user emptied must go out as `[]` or clearing it would be
 * impossible.
 */
export function giveListsPayload(lists: GiveLists): { giveForFree: string[]; neverGive: string[] } {
  return { giveForFree: [...lists.giveForFree], neverGive: [...lists.neverGive] };
}

/**
 * The brand's conversion rate on one leg, from features-service's effective rates. A
 * rate is per (brand, leg) and shared by every offer. Joined on the catalogue's `legKey`,
 * which the producer serves on each row; its step labels may differ from the catalogue's
 * and are only sent back verbatim on a write. `undefined` = no row (its bug, never guessed).
 */
export function legRateFor<R extends { legKey?: string | null }>(rates: readonly R[], legKey: string): R | undefined {
  return rates.find((r) => sameLegKey(r.legKey, legKey));
}

/** What the user typed in a rate field: empty clears it, else a percentage in (0, 100]. */
export function parseRatePct(text: string): { ok: true; value: number | null } | { ok: false } {
  const t = text.replace("%", "").replace(",", ".").trim();
  if (t === "") return { ok: true, value: null };
  const n = Number(t);
  if (n <= 0 || !isLegRatePct(n)) return { ok: false };
  return { ok: true, value: n };
}
