import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The lead panel shows the conversation that actually happened.
 *
 * Source-substring guards: the page pulls Clerk/api through the `@` alias vitest does
 * not resolve here, matching the repo's other page guards. The pure model has real
 * unit tests in `lead-conversation.test.ts`.
 *
 * Every assertion here is about the CALL SITE rather than the component, because a
 * timeline perfectly able to render a thread is the feature entirely absent if the
 * page never fetches one or never passes it down.
 */
describe("Leads — the panel reads the real conversation", () => {
  const pagePath = path.join(__dirname, "../src/components/audiences/engaged-leads-page.tsx");
  const src = fs.readFileSync(pagePath, "utf-8");

  const timelineBody = () => {
    const at = src.indexOf("function LeadTimeline(");
    expect(at).toBeGreaterThan(-1);
    const end = src.indexOf("function LeadsLoadingSkeleton(");
    expect(end).toBeGreaterThan(at);
    return src.slice(at, end);
  };

  it("keys the read on the LEAD's own campaign, never the page's", () => {
    // A campaign as the customer knows it is dozens of stored rows — campaign-service
    // mints a fresh one on every workflow switch and keeps the ancestors — and the
    // thread is resolved against the row the lead was SERVED under. The URL names the
    // live row, so keying on it 404s exactly the older leads with the longest
    // conversations.
    expect(src).toContain("const conversationCampaignId = selectedLead?.campaignId ?? null;");
    expect(src).toContain("const conversationEmail = selectedLead?.email ?? null;");
    expect(src).toContain(
      '["leadConversation", conversationCampaignId ?? "none", conversationEmail ?? "none"]',
    );
    // Not the page-level campaign prop, which is the live row.
    expect(src).not.toContain("getLeadConversation(campaignId as string");
  });

  it("calls the path the gateway actually deployed", () => {
    // The gateway names its own path and the deployed contract is the only authority
    // on it: api-service mounted this at `/v1/conversations`, not under `/v1/orgs`.
    // Guessing the downstream's own prefix would 404 every open lead.
    const api = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");
    expect(api).toContain("apiCall<unknown>(`/conversations${qs}`");
  });

  it("asks once and does not re-ask on a refusal", () => {
    // The producer's 404 and 502 are ANSWERS, not blips. Retrying spends a round trip
    // per open lead to be told the same thing.
    expect(src).toContain(
      "{ enabled: !!(conversationCampaignId && conversationEmail), retry: false }",
    );
  });

  it("keeps the three outcomes apart and never swallows a fourth", () => {
    // 404 absent · 200-empty · 502 unavailable are different facts. Anything else is
    // logged loud rather than folded into "this lead has no conversation".
    expect(src).toContain("const conversationRefusalKind = conversationRefusal(conversationError);");
    expect(src).toContain("[dashboard] lead conversation: unexpected read failure");
    expect(src).toContain(
      'import {\n  conversationRefusal,\n  hasInbound,\n  messageLabel,\n  orderedMessages,\n  unsentFollowUps,',
    );
  });

  it("threads the conversation into the timeline at the call site", () => {
    // The prop, not only the component: a page that renders <LeadTimeline> without
    // passing the thread ships a correct component and no feature.
    const at = src.indexOf("<LeadTimeline");
    expect(at).toBeGreaterThan(-1);
    const call = src.slice(at, src.indexOf("/>", at));
    expect(call).toContain("conversation={conversationData ?? null}");
    expect(call).toContain("refusal={conversationRefusalKind}");
  });

  it("builds one card per message actually exchanged", () => {
    const body = timelineBody();
    expect(body).toContain("const messages = conversation ? orderedMessages(conversation.messages) : [];");
    expect(body).toContain("messageLabel(messages, i)");
    // The delivery rows nest under the FIRST thing we sent — the first send IS the
    // initial email — and under nothing else, because the wire gives one
    // first-occurrence per LEAD rather than per step.
    expect(body).toContain('const firstOutbound = messages.findIndex((m) => m.direction === "outbound");');
    expect(body).toContain("...(i === firstOutbound ? { events: initialEvents } : {})");
  });

  it("states a reply once — as the message, not as a row beside it", () => {
    const body = timelineBody();
    // The bare `Replied` row exists only while the words do not.
    expect(body).toContain("const threadHasInbound = hasInbound(messages);");
    expect(body).toContain("...(threadHasInbound\n      ? []");
  });

  it("keeps only the follow-ups still ahead once a thread is on screen", () => {
    const body = timelineBody();
    // Every follow-up already sent has its own card carrying what it really said;
    // keeping the derived row too would state one email twice.
    expect(body).toContain("hasThread ? unsentFollowUps(followUps, Date.now()) : followUps");
  });

  it("falls back to the derived view when nobody has the exchange on record", () => {
    const body = timelineBody();
    // A 404 renders exactly as the panel did before this feature. A 502 is STATED:
    // "they never wrote back" and "we could not fetch what they wrote" differ.
    expect(body).toContain("const hasThread = messages.length > 0;");
    expect(body).toContain('if (sorted.length === 0 && refusal !== "unavailable") return null;');
    expect(body).toContain('{refusal === "unavailable" && (');
  });

  it("never signs the prospect's own message", () => {
    // The signature is OURS. Under an inbound message it would put our sign-off on
    // words the customer's prospect wrote.
    expect(timelineBody()).toContain('{e.kind === "message" && <EmailSignature className="text-xs" />}');
  });

  it("draws both cards through classes the dark surface actually remaps", () => {
    // The recurring gap: a tint legible in the light default renders its light-mode
    // near-white on the dark surface because nothing remapped it. Verified by
    // REPRODUCTION (the app's own compiled globals + Playwright, light and dark, at
    // 1280 and on a Pixel 7) rather than by grepping the class: ours reads hue 258,
    // theirs 293, both translucent in dark, zero overflow at 390px.
    const css = fs.readFileSync(path.join(__dirname, "../src/app/globals.css"), "utf-8");
    for (const rule of [
      "html.dark .bg-violet-50",
      "html.dark .border-violet-200",
      "html.dark .text-violet-600",
      "html.dark .bg-amber-50",
      "html.dark .border-amber-200",
      "html.dark .text-amber-700",
    ]) {
      expect(css, `missing dark remap: ${rule}`).toContain(rule);
    }
  });

  it("persists the thread so a reopened panel paints from disk", () => {
    const persist = fs.readFileSync(path.join(__dirname, "../src/lib/persist-cache.ts"), "utf-8");
    // An unlisted root is default-OFF: the panel would cold-fetch a live third-party
    // read on every open and the words would vanish the moment the row is closed.
    expect(persist).toContain('"leadConversation"');
  });
});
