/**
 * The staff Copilot: a chat in the middle of the v2 frame, the page it talks about on the
 * right (owner 2026-10-09, Conductor's layout). Pure rules only, alias-free, so they unit-test.
 */

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

export interface CopilotChoice {
  label: string;
  value: string;
}

/** One stored turn, the fields the choices are read from (chat-service session history). */
export interface CopilotHistoryTurn {
  id: string;
  role: string;
  buttons?: CopilotChoice[] | null;
}

/** The choices chat-service stored on each assistant turn, by turn id. */
export function choicesByTurn(turns: CopilotHistoryTurn[]): Map<string, CopilotChoice[]> {
  const out = new Map<string, CopilotChoice[]>();
  for (const t of turns) {
    if (t.role === "assistant" && t.buttons && t.buttons.length > 0) out.set(t.id, t.buttons);
  }
  return out;
}

/** The opener is the user's turn on paper only: it never prints. */
export function isOpener(text: string | null | undefined): boolean {
  return (text ?? "").trim() === COPILOT_OPENER;
}
