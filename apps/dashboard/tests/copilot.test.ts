import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  COPILOT_OPENER,
  PANEL_PCT_DEFAULT,
  PANEL_PCT_MAX,
  PANEL_PCT_MIN,
  choicesByTurn,
  clampPanelPct,
  copilotSessionStorageKey,
  isOpener,
  isPanelLink,
  parseStoredPanelPct,
} from "../src/lib/copilot";

const src = (f: string) => readFileSync(join(__dirname, "..", f), "utf-8");

describe("copilot rules", () => {
  it("keeps the page panel inside its bounds, a third by default", () => {
    expect(PANEL_PCT_DEFAULT).toBe(33);
    expect(clampPanelPct(5)).toBe(PANEL_PCT_MIN);
    expect(clampPanelPct(95)).toBe(PANEL_PCT_MAX);
    expect(clampPanelPct(40.4)).toBe(40);
    expect(clampPanelPct(Number.NaN)).toBe(PANEL_PCT_DEFAULT);
  });

  it("reads a stored width, and the default when nothing usable is stored", () => {
    expect(parseStoredPanelPct(null)).toBe(PANEL_PCT_DEFAULT);
    expect(parseStoredPanelPct("")).toBe(PANEL_PCT_DEFAULT);
    expect(parseStoredPanelPct("abc")).toBe(PANEL_PCT_DEFAULT);
    expect(parseStoredPanelPct("50")).toBe(50);
  });

  it("opens only dashboard links in the panel", () => {
    expect(isPanelLink("/v2/orgs/o/brands/b/people")).toBe(true);
    expect(isPanelLink("https://example.com")).toBe(false);
    expect(isPanelLink("mailto:a@b.c")).toBe(false);
    expect(isPanelLink(undefined)).toBe(false);
  });

  it("keys the conversation per org and brand", () => {
    expect(copilotSessionStorageKey("o1", "b1")).not.toBe(copilotSessionStorageKey("o1", "b2"));
  });

  it("re-reads the stored choices of assistant turns only", () => {
    const m = choicesByTurn([
      { id: "u", role: "user", buttons: [{ label: "x", value: "x" }] },
      { id: "a1", role: "assistant", buttons: [{ label: "See replies", value: "See replies" }] },
      { id: "a2", role: "assistant", buttons: null },
      { id: "a3", role: "assistant" },
    ]);
    expect([...m.keys()]).toEqual(["a1"]);
  });

  it("never prints the opener", () => {
    expect(isOpener(COPILOT_OPENER)).toBe(true);
    expect(isOpener(` ${COPILOT_OPENER}\n`)).toBe(true);
    expect(isOpener("hello")).toBe(false);
  });
});

describe("copilot wiring", () => {
  const shell = src("src/components/v2/v2-shell.tsx");
  const chat = src("src/components/v2/copilot-chat.tsx");

  it("is staff mode only, on a brand page", () => {
    expect(shell).toContain("const copilot = staffMode && hasBrand");
    expect(shell).toContain("<CopilotFrame orgId=");
  });

  it("talks to the copilot config and sends the account figures as context", () => {
    expect(chat).toContain("configKey: COPILOT_CONFIG_KEY");
    expect(chat).toContain("account: figures");
  });

  it("restores the stored conversation and offers a new one", () => {
    expect(chat).toContain("getChatSessionHistory(sid)");
    expect(chat).toContain("New chat");
  });
});
