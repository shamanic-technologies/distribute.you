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
  it("sends the markdown and lets the producer render it — rendering here would duplicate the unsubscribe footer", () => {
    // Scoped to the mutation: `__html:` is legitimate elsewhere in this file
    // (the preview and the history both render HTML), so a file-wide check
    // would assert something we do not mean. Measured at 1046 chars from the
    // mutation to the line after it; do not widen.
    const at = composer.indexOf("  const sendMutation = useMutation({");
    expect(at).toBeGreaterThan(-1);
    const body = composer.slice(at, at + 1046);
    expect(body).toContain("sendMailingListUpdate(INVESTOR_LIST_SLUG, { subject: subject.trim(), body })");
    expect(body).not.toContain("html");
  });

  it("previews with the producer's own renderer, so the preview cannot flatter the inbox", () => {
    expect(composer).toContain("renderInvestorUpdatePreviewHtml(body)");
    expect(composer).toContain("dangerouslySetInnerHTML={{ __html: previewHtml }}");
    // One conversion, not a second lookalike path.
    expect(composer.match(/renderInvestorUpdatePreviewHtml\(/g) ?? []).toHaveLength(1);
  });

  it("says the unsubscribe is appended on send rather than drawing one it does not control", () => {
    expect(composer).toContain("UNSUBSCRIBE_PREVIEW_NOTE");
  });

  it("renders a past update from the body as SENT, not by re-rendering the markdown", () => {
    expect(composer).toContain("__html: update.htmlBody");
  });

  it("counts only people who have not opted out — the list size would overstate the send", () => {
    expect(composer).toContain("(s) => !s.optedOut");
  });

  it("reports the opted-out skips the sender returns, so a smaller reach is explained", () => {
    expect(composer).toContain("skippedOptedOut");
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
  it("shows opted-out state — a member the provider blocks must not read as subscribed", () => {
    expect(listView).toContain("subscriber.optedOut ?");
    expect(listView).toContain("(s) => !s.optedOut");
  });

  it("distinguishes an unsubscribe from a bounce from a spam complaint", () => {
    for (const reason of ["HardBounce", "SpamComplaint", "ManualSuppression"]) {
      expect(listView).toContain(reason);
    }
  });

  it("sends the raw paste — the producer owns parsing and dedup against what is stored", () => {
    expect(listView).toContain("addMailingListSubscribers(INVESTOR_LIST_SLUG, blob)");
  });

  it("removes by email, since a subscriber has no id on the wire", () => {
    expect(listView).toContain("removeMailingListSubscriber(INVESTOR_LIST_SLUG, email)");
    expect(listView).not.toContain("subscriber.id");
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
  it("targets the gateway path api-service actually deployed, not an assumed prefix", () => {
    // api-service #799 mounts these at /v1/mailing-lists/:slug/*. apiCall
    // prepends /api/v1, so the reader path carries no further prefix.
    expect(api).toContain("`/mailing-lists/${slug}/subscribers`");
    expect(api).toContain("`/mailing-lists/${slug}/updates`");
    expect(api).not.toContain("/emails/mailing-lists/");
  });

  it("never puts recipients in BCC — per-recipient delivery is what makes the opt-out per-recipient", () => {
    const at = api.indexOf("export async function sendMailingListUpdate(");
    expect(at).toBeGreaterThan(-1);
    // Measured to the closing brace of the function; do not widen.
    const body = api.slice(at, at + 330);
    expect(body).not.toContain("bcc");
    expect(body).not.toContain("Bcc");
  });

  it("sends markdown as `body`, conforming to the deployed contract", () => {
    expect(api).toContain("input: { subject: string; body: string }");
  });

  it("types added/skipped as the arrays the sender returns, not counts", () => {
    expect(api).toContain("added: string[]");
    expect(api).toContain("skipped: string[]");
  });
});
