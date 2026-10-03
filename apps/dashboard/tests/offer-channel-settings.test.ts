import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  legRateFor,
  parseRatePct,
  giveListLines,
  giveListsEqual,
  giveListsPayload,
  parseGiveListText,
  validatedLegSections,
} from "../src/lib/offer-channel-settings";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

const legs = new Map(
  [
    { legKey: "start_to_conversation", fromKey: null, toKey: "conversation" },
    { legKey: "start_to_website_visit", fromKey: null, toKey: "website_visit" },
    { legKey: "conversation_to_meeting_booked", fromKey: "conversation", toKey: "meeting_booked" },
    { legKey: "meeting_booked_to_paid_client", fromKey: "meeting_booked", toKey: "paid_client" },
  ].map((l) => [l.legKey, l] as const),
);
const legsByChannel = new Map<string, string[]>([
  ["sales-cold-email-outreach", ["start_to_conversation", "start_to_website_visit"]],
  ["ai-meeting-booking", ["conversation_to_meeting_booked"]],
  ["google-ads", ["start_to_website_visit"]],
]);
const OURS = ["sales-cold-email-outreach", "ai-meeting-booking"];

describe("validatedLegSections", () => {
  it("lists only SAVED legs, in catalogue order, with the channels that work each", () => {
    const { sections, unknown } = validatedLegSections(
      { legs, legsByChannel },
      ["meeting_booked_to_paid_client", "start_to_conversation", "conversation_to_meeting_booked"],
      OURS,
    );
    expect(sections.map((s) => s.legKey)).toEqual([
      "start_to_conversation",
      "conversation_to_meeting_booked",
      "meeting_booked_to_paid_client",
    ]);
    expect(sections[0].channels).toEqual(["sales-cold-email-outreach"]);
    expect(sections[1].channels).toEqual(["ai-meeting-booking"]);
    // No channel of ours works it: the brand's own team does.
    expect(sections[2].channels).toEqual([]);
    expect(unknown).toEqual([]);
  });

  it("never offers a channel the Sales path tab does not offer", () => {
    const { sections } = validatedLegSections({ legs, legsByChannel }, ["start_to_website_visit"], OURS);
    expect(sections[0].channels).toEqual(["sales-cold-email-outreach"]);
  });

  it("returns a saved leg the catalogue does not list as unknown, never as a section", () => {
    const { sections, unknown } = validatedLegSections({ legs, legsByChannel }, ["gone_leg"], OURS);
    expect(sections).toEqual([]);
    expect(unknown).toEqual(["gone_leg"]);
  });

  it("an offer with no saved sales path has no section", () => {
    expect(validatedLegSections({ legs, legsByChannel }, [], OURS).sections).toEqual([]);
  });
});

describe("give lists", () => {
  it("reads a stored array, and a bare string as one item per line (commas kept)", () => {
    expect(giveListLines(["A free audit, 20 minutes", " ", "A trial"])).toEqual(["A free audit, 20 minutes", "A trial"]);
    expect(giveListLines("A free audit, 20 minutes\nA trial\n")).toEqual(["A free audit, 20 minutes", "A trial"]);
    expect(giveListLines(null)).toEqual([]);
  });

  it("parses textarea text, dropping list markers and blank lines", () => {
    expect(parseGiveListText("- A free audit\n\n• A trial\n2) A call\n")).toEqual(["A free audit", "A trial", "A call"]);
    expect(parseGiveListText("   \n")).toEqual([]);
  });

  it("sends BOTH keys on save, an emptied list as [] so clearing it persists", () => {
    expect(giveListsPayload({ giveForFree: [], neverGive: ["Discounts"] })).toEqual({ giveForFree: [], neverGive: ["Discounts"] });
  });

  it("compares lists item by item", () => {
    expect(giveListsEqual({ giveForFree: ["a"], neverGive: [] }, { giveForFree: ["a"], neverGive: [] })).toBe(true);
    expect(giveListsEqual({ giveForFree: ["a"], neverGive: [] }, { giveForFree: [], neverGive: [] })).toBe(false);
  });
});

describe("Channels tab wiring", () => {
  const tabs = read("src/components/v2/setup-pages.tsx");
  const page = read("src/components/v2/offer-channels-page.tsx");

  it("is GA beside Sales path: every signed-in user, no beta gate, no badge", () => {
    const start = tabs.indexOf("export function offerTabs(");
    const block = tabs.slice(start, tabs.indexOf("\n}\n", start));
    expect(block).toContain('label: "Sales path"');
    expect(block).toContain('label: "Channels"');
    expect(block).not.toContain("isBeta");
    expect(block).not.toContain("badge");
    for (const src of [page, read("src/components/v2/offer-sales-path-page.tsx")]) {
      expect(src).not.toContain("useIsBetaUser");
      expect(src).not.toContain("isBeta");
    }
  });

  it("reads the legs off the saved sales path and the give lists off the offer user-fields", () => {
    expect(page).toContain('["offerSalesPath", brandId, offerId]');
    expect(page).toContain('["offerUserFields", brandId, offerId]');
    expect(page).toContain("saveOfferUserFields(brandId, offerId, giveListsPayload(next))");
    expect(page).toContain("SALES_PATH_CHANNEL_SLUGS");
  });

  it("autosaves on leaving a field: no Save button, a rate write re-reads every money root", () => {
    expect(page).not.toMatch(/>\s*Save\s*</);
    expect(page.match(/onBlur=\{commit\}/g)?.length).toBe(2);
    expect(page).toContain('["brandConversionRates", brandId]');
    expect(page).toContain("rate.effectiveRatePct");
    expect(page).toContain("invalidateConversionRates(qc)");
  });

  it("reads as plain text at rest: the list button draws no frame", () => {
    const at = page.indexOf("onClick={() => setText(shown.join");
    const btn = page.slice(at, page.indexOf(">", page.indexOf("className=", at)));
    expect(btn).not.toContain("box-shadow");
    expect(btn).not.toContain("k-input");
  });
});

describe("leg rates", () => {
  const rates = [
    { legKey: "conversation_to_meeting_booked", fromStep: "Positive reply", toStep: "Meeting booked", effectiveRatePct: 30 },
    // The producer's label differs from the catalogue's "Form submitted": the key still joins.
    { legKey: "website_visit_to_form_submitted", fromStep: "Website visit", toStep: "Form filled", effectiveRatePct: 8 },
  ];
  it("joins on the catalogue legKey, whatever the labels say", () => {
    expect(legRateFor(rates, "conversation_to_meeting_booked")?.effectiveRatePct).toBe(30);
    expect(legRateFor(rates, "website_visit_to_form_submitted")?.effectiveRatePct).toBe(8);
    expect(legRateFor(rates, "gone_leg")).toBeUndefined();
  });
  it("parses what was typed: empty clears, out of range refuses", () => {
    expect(parseRatePct("")).toEqual({ ok: true, value: null });
    expect(parseRatePct("12,5 %").ok).toBe(false);
    expect(parseRatePct("12 %")).toEqual({ ok: true, value: 12 });
    expect(parseRatePct("0,5")).toEqual({ ok: true, value: 0.5 });
    expect(parseRatePct("0").ok).toBe(false);
    expect(parseRatePct("101").ok).toBe(false);
    expect(parseRatePct("abc").ok).toBe(false);
  });

});
