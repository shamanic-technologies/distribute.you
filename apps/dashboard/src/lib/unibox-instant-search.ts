import type { Person } from "./people-conversations";

/**
 * The Unibox search answers on the first letter (owner 2026-10-13): while crm-service is
 * asked, the people ALREADY on screen are filtered in the browser on the fields their rows
 * carry (name, company, emails, phones, the served match lines). crm-service's answer then
 * replaces this list whole: it alone reads every page and every message.
 */

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function haystack(p: Person): string {
  const parts: (string | null | undefined)[] = [p.displayName, p.company, ...p.emails, ...p.phones];
  for (const m of p.matches ?? []) parts.push(m.value, m.subject, m.excerpt);
  for (const l of p.possibleLeads ?? []) parts.push(l.fullName, l.email, l.company);
  return fold(parts.filter(Boolean).join(" "));
}

/** Every word typed must appear somewhere on the row, accents and case ignored. */
export function instantMatch(p: Person, search: string): boolean {
  const words = fold(search).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = haystack(p);
  return words.every((w) => hay.includes(w));
}

/** The pools in order (what is on screen first), one row per person, filtered. */
export function instantPeople(pools: (Person[] | null | undefined)[], search: string): Person[] {
  const seen = new Set<string>();
  const out: Person[] = [];
  for (const pool of pools) {
    for (const p of pool ?? []) {
      if (seen.has(p.personKey)) continue;
      seen.add(p.personKey);
      if (instantMatch(p, search)) out.push(p);
    }
  }
  return out;
}
