/**
 * What the user just did on the dashboard, for the Copilot (owner 2026-10-15): the
 * pages they opened and the buttons/links they clicked, newest last. Sent in the
 * chat request's `context` on every turn (chat-service injects it into the prompt
 * and does not store it), so the Copilot understands what the user is trying to do.
 * Kept in memory for the tab only. Alias-free so its unit tests import it directly.
 */

export interface RecentAction {
  /** ISO time of the action. */
  at: string;
  kind: "page" | "click";
  /** The page path for `page`, the clicked control's visible name for `click`. */
  label: string;
  /** The page the action happened on. */
  page: string;
}

export const RECENT_ACTIONS_MAX = 20;
const LABEL_MAX = 80;

/** Appends `action`, keeping the newest RECENT_ACTIONS_MAX. A page already shown last is not repeated. */
export function pushRecentAction(list: readonly RecentAction[], action: RecentAction): RecentAction[] {
  const last = list[list.length - 1];
  if (action.kind === "page" && last?.kind === "page" && last.label === action.label) return [...list];
  return [...list, action].slice(-RECENT_ACTIONS_MAX);
}

/** Minimal element surface the click reader needs (a DOM Element satisfies it). */
export interface ClickTarget {
  closest(selector: string): ClickTarget | null;
  getAttribute(name: string): string | null;
  textContent: string | null;
}

const CONTROL = "button, a, [role=button], [role=tab], [role=menuitem], [role=option], summary";

/**
 * The visible name of the control a click landed on, or null when the click is not
 * on a control or happened inside the Copilot itself (its turns are already the
 * conversation).
 */
export function clickedControlLabel(target: ClickTarget | null): string | null {
  if (!target) return null;
  if (target.closest("[data-copilot]")) return null;
  const control = target.closest(CONTROL);
  if (!control) return null;
  const raw = control.getAttribute("aria-label") || control.getAttribute("title") || control.textContent || "";
  const label = raw.replace(/\s+/g, " ").trim();
  if (!label) return null;
  return label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1)}…` : label;
}
