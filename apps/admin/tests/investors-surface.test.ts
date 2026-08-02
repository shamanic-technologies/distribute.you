import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const sidebar = read("src/components/context-sidebar.tsx");
const composer = read("src/components/investors/investor-update-composer.tsx");
const listView = read("src/components/investors/investor-list-view.tsx");
const api = read("src/lib/api.ts");

/** Measured to the closing brace of AppLevelSidebar; do not widen. */
function appLevelSidebar(): string {
  const at = sidebar.indexOf("function AppLevelSidebar(");
  expect(at).toBeGreaterThan(-1);
  const end = sidebar.indexOf("\n// Org Level Sidebar", at);
  expect(end).toBeGreaterThan(at);
  return sidebar.slice(at, end);
}

describe("admin sidebar", () => {
  it("puts Customer Success below the other blocks", () => {
    const block = appLevelSidebar();
    const cs = block.indexOf(">Customer Success<");
    const dashboard = block.indexOf(">Dashboard<");
    const audit = block.indexOf(">Audit<");
    const features = block.indexOf(">Features<");
    expect(cs).toBeGreaterThan(dashboard);
    expect(cs).toBeGreaterThan(audit);
    expect(cs).toBeGreaterThan(features);
  });

  it("puts the Investors section under Customer Success", () => {
    const block = appLevelSidebar();
    expect(block.indexOf(">Investors<")).toBeGreaterThan(block.indexOf(">Customer Success<"));
  });

  it("links both investor pages", () => {
    const block = appLevelSidebar();
    expect(block).toContain('href: "/investors"');
    expect(block).toContain('href: "/investors/update"');
  });

  it("keeps the list link exact so the update page does not light both", () => {
    expect(appLevelSidebar()).toContain('isActive={pathname === "/investors"}');
  });
});

describe("investor update composer", () => {
  it("previews the SAME string it sends — a second render path could disagree with the inbox", () => {
    // One `html` memo, passed to both the preview and the send.
    expect(composer).toContain("renderInvestorUpdateHtml(body)");
    expect(composer).toContain("dangerouslySetInnerHTML={{ __html: html }}");
    expect(composer).toContain("html,");
    // No second conversion anywhere in the component.
    expect(composer.match(/renderInvestorUpdateHtml\(/g) ?? []).toHaveLength(1);
  });

  it("counts only people who have not opted out — the list size would overstate the send", () => {
    expect(composer).toContain("filter(\n    (s) => !s.unsubscribed\n  ).length");
  });

  it("asks before sending rather than firing on the first click", () => {
    expect(composer).toContain("confirming");
    expect(composer).toContain("Yes, send to");
  });

  it("keeps the in-flight label at full opacity, per the mutation-button rule", () => {
    expect(composer).toContain('sending ? "cursor-wait" : "disabled:opacity-40');
  });

  it("never renders a raw err.message to the user", () => {
    expect(composer).not.toContain("err.message");
    expect(composer).not.toContain("error.message");
    expect(composer).toContain("console.error");
  });

  it("does not hand-write the image markdown syntax", () => {
    expect(composer).toContain("imageMarkdown(");
    expect(composer).not.toContain("`![");
  });
});

describe("investor list view", () => {
  it("shows unsubscribed state — a member the provider blocks must not read as subscribed", () => {
    expect(listView).toContain("Unsubscribed");
    expect(listView).toContain("s.unsubscribed");
  });

  it("never renders a raw err.message to the user", () => {
    expect(listView).not.toContain("err.message");
    expect(listView).toContain("console.error");
  });

  it("gates the add button on there being something valid to add", () => {
    expect(listView).toContain("parsed.accepted.length > 0");
  });

  it("reports rejects rather than dropping them quietly", () => {
    expect(listView).toContain("parsed.rejected.length");
  });
});

describe("investor api readers", () => {
  it("sends the update per recipient — never one blast with everyone in BCC", () => {
    const at = api.indexOf("export async function sendInvestorUpdate(");
    expect(at).toBeGreaterThan(-1);
    const body = api.slice(at, at + 420);
    expect(body).not.toContain("bcc");
    expect(body).not.toContain("Bcc");
  });

  it("carries a text part alongside the html", () => {
    expect(api).toContain("subject: string; html: string; text: string");
  });
});
