/**
 * How the CRM page reads what crm-service serves. It derives no figure of its own.
 *
 * The page shows a client their own customer records, read out of the system they
 * already run on. Everything here is presentation: what a person is called when
 * they gave us no name, how an amount is written, which of the loaded rows a
 * search matched. Nothing on this page is a metric OF OURS — a cost, a rate, a
 * return — and nothing here may compute one.
 *
 * ⚠️ THE GROUPING IS THE PRODUCER'S. crm-service serves the pipeline already
 * grouped (pipelines, then stages, in the stage order their own system states),
 * with the per-stage and per-pipeline `count` and `totalValue` computed there.
 * An earlier cut of this module regrouped a flat list here; that duplicated the
 * producer and is exactly the re-derivation this repo bans. Render the served
 * structure, and if a figure is missing from it, ask crm-service for it.
 *
 * ⚠️ NO CURRENCY IS MIRRORED. GoHighLevel reports a whole-currency amount and
 * crm-service stores it as a numeric string, with no currency code anywhere in
 * any of the tables involved. So an amount is written as a plain number and
 * never with a symbol: printing `$` would state a currency nobody reported, on
 * money that is very often not dollars.
 *
 * Alias-free on purpose, so this carries REAL unit tests. Keep it that way.
 */

/** One person, as their own CRM holds them. Field names are crm-service's. */
export interface CrmContact {
  id: string;
  externalId: string;
  primaryEmail: string | null;
  phoneE164: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  unsubscribed: boolean;
  lastRebuiltAt: string | null;
}

/** One deal, as crm-service serves it inside its stage. */
export interface CrmOpportunity {
  id: string;
  externalId: string;
  name: string;
  status: string | null;
  /** Whole-currency amount as a numeric string. No currency code exists. */
  monetaryValue: string | null;
  contactName: string | null;
  contactEmail: string | null;
}

export interface CrmStage {
  id: string;
  name: string | null;
  position: number | null;
  count: number;
  totalValue: string;
  opportunities: CrmOpportunity[];
}

export interface CrmPipeline {
  id: string;
  name: string;
  count: number;
  totalValue: string;
  stages: CrmStage[];
}

export interface CrmPipelineRead {
  pipelines: CrmPipeline[];
  /** Deals their system placed in a pipeline we have not mirrored, or in none. */
  ungrouped: CrmOpportunity[];
  totalOpportunities: number;
}

/** Which field a person ended up being named by, so no surface repeats it. */
export type ContactNameSource = "name" | "email" | "phone" | "none";

export interface ContactIdentity {
  label: string;
  source: ContactNameSource;
}

/**
 * What to call a person their own CRM left half-filled, AND which field that
 * came from.
 *
 * Their system serves a `fullName` as well as the two halves, so that is
 * preferred; then the halves, then the email, then the phone. Never a fabricated
 * label and never an id: a row we cannot name says so, in the one word that is
 * true of it.
 *
 * The SOURCE is what stops a row stating one value twice. A contact holding only
 * a phone is named by that phone, and a surface that then also prints the phone
 * underneath says the same thing in two places on one line, which reads as a bug
 * rather than as a fallback.
 */
export function contactIdentity(c: {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  primaryEmail: string | null;
  phoneE164: string | null;
}): ContactIdentity {
  const full = (c.fullName ?? "").trim();
  if (full) return { label: full, source: "name" };
  const halves = [c.firstName, c.lastName]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (halves) return { label: halves, source: "name" };
  const email = (c.primaryEmail ?? "").trim();
  if (email) return { label: email, source: "email" };
  const phone = (c.phoneE164 ?? "").trim();
  if (phone) return { label: phone, source: "phone" };
  return { label: "No name", source: "none" };
}

/** The label alone, for a surface with nothing to de-duplicate against. */
export function contactDisplayName(c: Parameters<typeof contactIdentity>[0]): string {
  return contactIdentity(c).label;
}

/**
 * An amount their system reported, written as a plain grouped number.
 *
 * No symbol, because no currency is mirrored in any of the tables involved
 * (see the module note). Null in, nothing out: a deal their system priced at
 * nothing is not a deal worth zero, and printing a zero would say it was. A
 * value that does not parse is also nothing rather than a guess.
 */
export function formatAmount(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/**
 * Narrow the contacts on screen to what was typed.
 *
 * A LOCAL filter over the page in hand, never presented as a search of the whole
 * population: the count beside it says how many of the LOADED rows matched, so a
 * reader is never told a person does not exist when they simply are not on this
 * page. Every field is coalesced before `toLowerCase` — their CRM leaves most of
 * them null, and a raw call would take the page down on the first keystroke.
 */
export function filterContacts(rows: CrmContact[], query: string): CrmContact[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((c) =>
    [c.fullName, c.firstName, c.lastName, c.primaryEmail, c.phoneE164]
      .map((v) => (v ?? "").toLowerCase())
      .some((v) => v.includes(q)),
  );
}
