import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  COPILOT_OPENER,
  choicesByTurn,
  copilotPageHref,
  copilotSessionStorageKey,
  isOpener,
  isThisBrandsSession,
  openPagesByTurn,
  isPanelLink,
} from "../src/lib/copilot";

const src = (f: string) => readFileSync(join(__dirname, "..", f), "utf-8");

describe("copilot rules", () => {
  it("opens only dashboard links under the widget", () => {
    expect(isPanelLink("/v2/orgs/o/brands/b/people")).toBe(true);
    expect(isPanelLink("https://example.com")).toBe(false);
    expect(isPanelLink("mailto:a@b.c")).toBe(false);
    expect(isPanelLink(undefined)).toBe(false);
  });

  it("keys the conversation per org and brand", () => {
    expect(copilotSessionStorageKey("o1", "b1")).not.toBe(copilotSessionStorageKey("o1", "b2"));
  });

  it("re-reads the stored cards of assistant turns only, rich choices before plain buttons", () => {
    const rich = { question: "Next?", choices: [{ label: "See replies", value: "See replies", visual: { type: "number" as const, value: 3, unit: "replies" } }] };
    const m = choicesByTurn([
      { id: "u", role: "user", buttons: [{ label: "x", value: "x" }] },
      { id: "a1", role: "assistant", buttons: [{ label: "Old", value: "Old" }], choices: rich },
      { id: "a2", role: "assistant", buttons: [{ label: "Plain", value: "Plain" }], choices: null },
      { id: "a3", role: "assistant" },
    ]);
    expect([...m.keys()]).toEqual(["a1", "a2"]);
    expect(m.get("a1")).toBe(rich);
    expect(m.get("a2")?.choices[0].label).toBe("Plain");
  });

  it("re-reads the pages each turn opened", () => {
    const m = openPagesByTurn([
      { id: "a1", role: "assistant", openPages: [{ page: "billing" }] },
      { id: "a2", role: "assistant", openPages: [] },
    ]);
    expect([...m.keys()]).toEqual(["a1"]);
  });

  it("resolves a page id to this brand's page, never a URL the model wrote", () => {
    expect(copilotPageHref("o", "b", { page: "billing" })).toBe("/v2/orgs/o/brands/b/billing");
    expect(copilotPageHref("o", "b", { page: "today" })).toBe("/v2/orgs/o/brands/b");
    expect(copilotPageHref("o", "b", { page: "outbound", brandId: "other" })).toBe("/v2/orgs/o/brands/b/sales-path");
    expect(copilotPageHref("o", "b", { page: "campaign", campaignId: "c1" })).toBe("/v2/orgs/o/brands/b/campaigns/c1");
    expect(copilotPageHref("o", "b", { page: "campaign" })).toBeNull();
    expect(copilotPageHref("o", "b", { page: "https://evil.example" })).toBeNull();
  });

  it("shows the latest session only when it was opened for this brand", () => {
    expect(isThisBrandsSession({ brandIds: ["b1"] }, "b1")).toBe(true);
    expect(isThisBrandsSession({ brandIds: ["b2"] }, "b1")).toBe(false);
    expect(isThisBrandsSession({ brandIds: null }, "b1")).toBe(false);
    expect(isThisBrandsSession(null, "b1")).toBe(false);
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
    expect(shell).toContain("{copilot && <CopilotPanel orgId=");
  });

  it("is a right panel beside the page, shown by default, hidden by its arrow, back from the top bar", () => {
    const panel = src("src/components/v2/copilot-panel.tsx");
    const dock = src("src/components/v2/copilot-dock.tsx");
    const ui = src("src/components/v2/ui.tsx");
    // Beside the page on desktop (owner 2026-10-10), not floating over it.
    expect(panel).toContain("lg:static");
    expect(panel).toContain("lg:w-[400px] lg:shrink-0");
    expect(dock).toContain("useState(true)");
    expect(panel).toContain("onClick={() => setOpen(false)}");
    expect(dock).toContain("onClick={() => setOpen(true)}");
    expect(ui).toContain("<CopilotShowButton />");
    // The choice survives a reload.
    expect(dock).toContain("localStorage.setItem(STORAGE_KEY");
    // Hidden = not displayed, never unmounted: an answer keeps streaming.
    expect(panel).toContain("inert={!open}");
    expect(shell).not.toContain("{copilot && open");
  });

  it("talks to the copilot config and sends the account figures as context", () => {
    expect(chat).toContain("configKey: COPILOT_CONFIG_KEY");
    expect(chat).toContain("account: figures");
  });

  it("runs on Claude Haiku 5.5 with the card, page and account-read tools", () => {
    const boot = src("src/instrumentation.ts");
    const at = boot.indexOf('key: "copilot"');
    const cfg = boot.slice(at, boot.indexOf("},", at));
    expect(cfg).toContain('provider: "anthropic"');
    expect(cfg).toContain('model: "haiku"');
    for (const t of ["present_choices", "open_page", "list_replies_to_handle", "get_offer_performance"]) {
      expect(boot).toContain(`"${t}"`);
    }
  });

  it("prints a cents figure in dollars, never the raw integer", () => {
    const cards = src("src/components/v2/copilot-cards.tsx");
    expect(cards).toContain('unit?.toLowerCase() === "cents"');
    expect(cards).toContain("formatCentsAsUsdAdaptive(n)");
    expect(src("src/instrumentation.ts")).toContain('with unit "cents"');
  });

  it("the proxy forwards the cards and the page events", () => {
    const route = src("src/app/(authed)/api/v1/chat/route.ts");
    expect(route).toContain('case "choices"');
    expect(route).toContain('"data-choices"');
    expect(route).toContain('case "open_page"');
    expect(route).toContain('"data-open-page"');
  });

  it("opens the page the model asked for in the panel", () => {
    expect(chat).toContain('data.type === "data-open-page"');
    expect(chat).toContain("routerRef.current.push(href)");
  });

  it("reads the user's latest conversation, and the proxy records the brand on it", () => {
    expect(chat).toContain("getLatestChatSession(COPILOT_CONFIG_KEY)");
    expect(chat).toContain("isThisBrandsSession(latest, brandId)");
    const route = src("src/app/(authed)/api/v1/chat/route.ts");
    expect(route).toContain('headers["x-brand-id"] = context.brandId');
  });

  it("restores the stored conversation and offers a new one", () => {
    expect(chat).toContain("getChatSessionHistory(localSid)");
    expect(chat).toContain("New chat");
  });
});
