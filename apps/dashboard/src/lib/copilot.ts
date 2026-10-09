/**
 * The staff Copilot: a chat in the middle of the v2 frame, the page it talks about on the
 * right (owner 2026-10-09, Conductor's layout). Pure rules only, alias-free, so they unit-test.
 */

import { v2CampaignHref, v2Href, type V2Section } from "./v2/routes";

/** The chat-service config this surface talks to (registered at boot, instrumentation.ts). */
export const COPILOT_CONFIG_KEY = "copilot";

/**
 * The first message of a new chat. Sent for the user, never shown: it asks the model for
 * the account's opening read and its choices, grounded on the figures in the context.
 */
export const COPILOT_OPENER = "Open a new chat for this account: what matters right now, and what should I do next?";

/** Where the browser keeps the conversation it shows, per brand (the history lives in chat-service). */
export function copilotSessionStorageKey(orgId: string, brandId: string): string {
  return `copilot-session:${orgId}:${brandId}`;
}

/**
 * The page panel's share of the space right of the sidebar, in percent. Conductor's split
 * measured on the owner's screenshot (2026-10-09): sidebar ~15%, chat ~57%, panel ~28% of
 * the window, so the panel takes about a third of what the sidebar leaves.
 */
export const PANEL_PCT_DEFAULT = 33;
export const PANEL_PCT_MIN = 25;
export const PANEL_PCT_MAX = 65;
export const PANEL_PCT_STORAGE_KEY = "copilot-panel-pct";

export function clampPanelPct(pct: number): number {
  if (!Number.isFinite(pct)) return PANEL_PCT_DEFAULT;
  return Math.min(PANEL_PCT_MAX, Math.max(PANEL_PCT_MIN, Math.round(pct)));
}

/** A stored width, or the default when nothing (or garbage) is stored. */
export function parseStoredPanelPct(raw: string | null): number {
  if (raw == null || raw.trim() === "") return PANEL_PCT_DEFAULT;
  return clampPanelPct(Number(raw));
}

/**
 * A link the model wrote that opens a dashboard page: it opens in the right panel (client
 * navigation), the chat stays. Anything else (another site, a mail link) opens as a link.
 */
export function isPanelLink(href: string | null | undefined): href is string {
  return typeof href === "string" && href.startsWith("/v2/");
}

/** A card's optional visual, as chat-service's `present_choices` serves it. */
export type CopilotVisual =
  | { type: "icon"; icon: string }
  | { type: "image"; imageUrl: string }
  | { type: "number"; value: number | string; unit?: string }
  | { type: "chart"; series: number[]; unit?: string };

export interface CopilotChoice {
  label: string;
  value: string;
  description?: string;
  visual?: CopilotVisual;
}

/** One `choices` event (or a plain `buttons` one, read as cards with no visual). */
export interface CopilotChoices {
  question?: string | null;
  choices: CopilotChoice[];
}

/** An `open_page` event: a page id the client resolves, never a URL. */
export interface CopilotOpenPage {
  page: string;
  brandId?: string;
  offerId?: string;
  campaignId?: string;
  audienceId?: string;
  leadId?: string;
  title?: string;
}

/** One stored turn, the fields the cards and pages are read from (chat-service session history). */
export interface CopilotHistoryTurn {
  id: string;
  role: string;
  buttons?: { label: string; value: string }[] | null;
  choices?: CopilotChoices | null;
  openPages?: CopilotOpenPage[] | null;
}

/** The cards chat-service stored on each assistant turn, by turn id (rich choices win over plain buttons). */
export function choicesByTurn(turns: CopilotHistoryTurn[]): Map<string, CopilotChoices> {
  const out = new Map<string, CopilotChoices>();
  for (const t of turns) {
    if (t.role !== "assistant") continue;
    if (t.choices && t.choices.choices.length > 0) out.set(t.id, t.choices);
    else if (t.buttons && t.buttons.length > 0) out.set(t.id, { choices: t.buttons });
  }
  return out;
}

/** The pages each stored assistant turn opened, by turn id. */
export function openPagesByTurn(turns: CopilotHistoryTurn[]): Map<string, CopilotOpenPage[]> {
  const out = new Map<string, CopilotOpenPage[]>();
  for (const t of turns) {
    if (t.role === "assistant" && t.openPages && t.openPages.length > 0) out.set(t.id, t.openPages);
  }
  return out;
}

/**
 * The pages the model may open, by id: the list its system prompt carries (instrumentation.ts
 * reads it, so the two cannot drift). `campaign` needs a `campaignId`.
 */
export const COPILOT_PAGES: Record<string, { section: V2Section | null; what: string }> = {
  today: { section: "today", what: "the account's figures since it started" },
  people: { section: "people", what: "every person reached, with who replied" },
  unibox: { section: "unibox", what: "every conversation, hot leads first" },
  deals: { section: "deals", what: "the people moving toward a sale" },
  outbound: { section: "sales-path", what: "the campaigns, their return, status and budget" },
  sourcing: { section: "sourcing", what: "how new people are found" },
  targeting: { section: "targeting", what: "who we write to" },
  offer: { section: "offers", what: "what the brand sells" },
  billing: { section: "billing", what: "balance, payments and spend" },
  integrations: { section: "integrations", what: "connected tools" },
  settings: { section: "settings", what: "brand settings" },
  campaign: { section: null, what: "one campaign's page (needs campaignId)" },
};

/** The URL a page id opens, or null with the reason logged (an unknown id, a missing id). */
export function copilotPageHref(orgId: string, brandId: string, rec: CopilotOpenPage): string | null {
  const def = COPILOT_PAGES[rec.page];
  if (!def) {
    console.error("[copilot] open_page named a page the dashboard does not know", rec);
    return null;
  }
  // The panel shows the brand the chat is about: a brand id the model names is not followed.
  if (def.section) return v2Href(orgId, brandId, def.section);
  if (!rec.campaignId) {
    console.error("[copilot] open_page campaign without a campaignId", rec);
    return null;
  }
  return v2CampaignHref(orgId, brandId, rec.campaignId);
}

/**
 * The latest session chat-service holds for the user is per org, not per brand: it is this
 * chat's conversation only when it was opened for this brand (the proxy sends `x-brand-id`).
 */
export function isThisBrandsSession(session: { brandIds?: string[] | null } | null, brandId: string): boolean {
  return Boolean(session?.brandIds?.includes(brandId));
}

/** The opener is the user's turn on paper only: it never prints. */
export function isOpener(text: string | null | undefined): boolean {
  return (text ?? "").trim() === COPILOT_OPENER;
}
