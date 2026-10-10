/**
 * The Copilot (GA 2026-10-10): a chat panel on the right beside the page it talks about
 * (owner 2026-10-09). Pure rules only, alias-free, so they unit-test.
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
 * A link the model wrote that opens a dashboard page: it opens under the widget (client
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
  creditsRequired?: CopilotCreditsRequired | null;
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

/** The "Add credits" action stored on out-of-credits assistant turns, by turn id. */
export function creditsRequiredByTurn(turns: CopilotHistoryTurn[]): Map<string, CopilotCreditsRequired> {
  const out = new Map<string, CopilotCreditsRequired>();
  for (const t of turns) {
    if (t.role === "assistant" && t.creditsRequired) out.set(t.id, t.creditsRequired);
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
  campaigns: { section: "campaigns", what: "the campaigns, their status, max budget and max volume" },
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

/**
 * chat-service's `credits_required` event (owner 2026-10-10): billing refused the turn for lack of
 * credits, the model was not called, the text says so. The dashboard draws the button that opens
 * the credit top-up (the Billing page). Null when the data is not that event.
 */
export interface CopilotCreditsRequired {
  message: string;
  action: "add_credits";
  label: string;
}

export function readCreditsRequired(data: unknown): CopilotCreditsRequired | null {
  const d = data as Partial<CopilotCreditsRequired> | null | undefined;
  if (!d || d.action !== "add_credits" || typeof d.label !== "string" || typeof d.message !== "string") {
    console.error("[copilot] a credits_required event the dashboard cannot read", data);
    return null;
  }
  return { message: d.message, action: "add_credits", label: d.label };
}

/** Where "Add credits" goes: the Billing page, where the top-up lives. */
export function addCreditsHref(orgId: string, brandId: string): string | null {
  return copilotPageHref(orgId, brandId, { page: "billing" });
}

/** The opener is the user's turn on paper only: it never prints. */
export function isOpener(text: string | null | undefined): boolean {
  return (text ?? "").trim() === COPILOT_OPENER;
}
