import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  RECENT_ACTIONS_MAX,
  clickedControlLabel,
  pushRecentAction,
  type ClickTarget,
  type RecentAction,
} from "../src/lib/recent-actions";

const page = (label: string): RecentAction => ({ at: "2026-10-15T10:00:00Z", kind: "page", label, page: label });
const click = (label: string): RecentAction => ({ at: "2026-10-15T10:00:01Z", kind: "click", label, page: "/x" });

/** A fake element: `matches` lists the selectors `closest` answers for, with the node it returns. */
function el(opts: { attrs?: Record<string, string>; text?: string; inCopilot?: boolean; control?: boolean }): ClickTarget {
  const self: ClickTarget = {
    closest: (sel) => {
      if (sel === "[data-copilot]") return opts.inCopilot ? self : null;
      return opts.control === false ? null : self;
    },
    getAttribute: (name) => opts.attrs?.[name] ?? null,
    textContent: opts.text ?? null,
  };
  return self;
}

describe("pushRecentAction", () => {
  it("keeps the newest RECENT_ACTIONS_MAX actions", () => {
    let list: RecentAction[] = [];
    for (let i = 0; i < RECENT_ACTIONS_MAX + 5; i++) list = pushRecentAction(list, click(`b${i}`));
    expect(list).toHaveLength(RECENT_ACTIONS_MAX);
    expect(list[0].label).toBe("b5");
    expect(list[list.length - 1].label).toBe(`b${RECENT_ACTIONS_MAX + 4}`);
  });

  it("does not repeat the page already shown last", () => {
    const list = pushRecentAction([page("/a")], page("/a"));
    expect(list).toHaveLength(1);
  });

  it("records a return to a page after other actions", () => {
    const list = [page("/a"), page("/b"), page("/a")].reduce(pushRecentAction, [] as RecentAction[]);
    expect(list.map((a) => a.label)).toEqual(["/a", "/b", "/a"]);
  });
});

describe("clickedControlLabel", () => {
  it("reads the control's visible text, whitespace collapsed", () => {
    expect(clickedControlLabel(el({ text: "  Raise\n  budget " }))).toBe("Raise budget");
  });

  it("prefers aria-label over the text", () => {
    expect(clickedControlLabel(el({ attrs: { "aria-label": "Hide the copilot" }, text: "»" }))).toBe("Hide the copilot");
  });

  it("ignores clicks inside the Copilot", () => {
    expect(clickedControlLabel(el({ text: "Send", inCopilot: true }))).toBeNull();
  });

  it("ignores clicks that are not on a control", () => {
    expect(clickedControlLabel(el({ text: "plain text", control: false }))).toBeNull();
    expect(clickedControlLabel(null)).toBeNull();
  });

  it("ignores a control with no name and caps long names", () => {
    expect(clickedControlLabel(el({ text: "   " }))).toBeNull();
    const long = clickedControlLabel(el({ text: "x".repeat(200) }));
    expect(long).toHaveLength(80);
    expect(long?.endsWith("…")).toBe(true);
  });
});

describe("Copilot call sites", () => {
  const chat = readFileSync(new URL("../src/components/v2/copilot-chat.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../src/components/v2/copilot-panel.tsx", import.meta.url), "utf8");

  it("sends the recent actions in every chat request's context", () => {
    const at = chat.indexOf("prepareSendMessagesRequest");
    expect(at).toBeGreaterThan(-1);
    expect(chat.slice(at, chat.indexOf("useChat(", at))).toContain("recentActions: recentActionsRef.current");
  });

  it("records page changes and clicks", () => {
    expect(chat).toContain("pushRecentAction(");
    expect(chat).toContain("clickedControlLabel(");
    expect(chat).toMatch(/addEventListener\("click", [a-zA-Z]+, true\)/);
  });

  it("marks the panel so its own clicks are not recorded", () => {
    expect(panel).toContain("data-copilot");
  });
});
