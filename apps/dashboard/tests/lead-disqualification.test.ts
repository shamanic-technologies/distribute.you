import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLeadsResponse } from "../src/lib/api";
import { ConversationTimelineSchema } from "../src/lib/conversation-timeline";
import {
  BrandDisqualificationsSchema,
  DISQUALIFIED_TAG,
  disqualificationNoteBody,
  disqualificationSourceWord,
  readDisqualification,
} from "../src/lib/lead-disqualification";

const src = (...p: string[]) => readFileSync(join(__dirname, "..", "src", ...p), "utf8");

const MARK = {
  offerId: "offer-1",
  note: "Runs a construction company, we sell to supermarkets.",
  source: "manual",
  statedByUserId: "user-1",
  statedAt: "2026-10-13T10:00:00.000Z",
};

const ROW = {
  id: "row-1",
  email: "a@b.co",
  status: "served",
  contacted: true,
  sent: true,
  delivered: true,
  clicked: false,
  bounced: false,
  unsubscribed: false,
  replied: true,
  standing: { state: "sales_interest", signal: "replied" },
};

/**
 * Disqualified is its OWN mark beside the step tags (owner 2026-10-13): a person reads
 * "Positive reply" AND "Disqualified" at once, and the board's column is drawn from the mark.
 */
describe("the Disqualified mark", () => {
  it("survives the lead list parse beside the standing, never instead of it", () => {
    const { leads } = parseLeadsResponse({ leads: [{ ...ROW, disqualification: MARK }] }, "test");
    expect(leads[0].disqualification?.note).toBe(MARK.note);
    expect((leads[0] as unknown as { standing: { state: string } }).standing.state).toBe("sales_interest");
  });

  it("parses a row with no mark (null) and an older row without the field", () => {
    expect(parseLeadsResponse({ leads: [{ ...ROW, disqualification: null }] }, "t").leads[0].disqualification).toBeNull();
    expect(parseLeadsResponse({ leads: [ROW] }, "t").leads[0].disqualification).toBeUndefined();
  });

  it("rides the conversation timeline with its tag", () => {
    const parsed = ConversationTimelineSchema.parse({
      leadId: "l",
      brandId: "b",
      offerId: "offer-1",
      items: [],
      tags: { lastWord: "interested", lastWordAt: null, furthestStep: "conversation_ongoing", furthestStepAttributable: true, disqualified: true },
      disqualification: MARK,
    });
    expect(parsed.tags.disqualified).toBe(true);
    expect(parsed.disqualification?.note).toBe(MARK.note);
  });

  it("parses the brand list (total + leads + notes)", () => {
    const parsed = BrandDisqualificationsSchema.parse({
      brandId: "b",
      offerId: null,
      total: 1,
      leads: [{ id: "row-1", leadId: "l", name: "Américo Vargas", email: "a@b.co", disqualification: { ...MARK, source: "reply", statedByUserId: null } }],
    });
    expect(parsed.total).toBe(parsed.leads.length);
    expect(disqualificationSourceWord(parsed.leads[0].disqualification)).toBe("Set from their reply");
  });

  it("states an optional note, never a reason from a list", () => {
    expect(disqualificationNoteBody("  ")).toEqual({});
    expect(disqualificationNoteBody(" wrong person ")).toEqual({ note: "wrong person" });
    expect(readDisqualification(null)).toBeNull();
    expect(DISQUALIFIED_TAG.label).toBe("Disqualified");
  });
});

describe("where the mark is drawn", () => {
  it("the Deals board's Disqualified column reads the mark list, not the standing", () => {
    const page = src("components", "v2", "deals-page.tsx");
    expect(page).toContain("useLeadDisqualifications(brandId)");
    expect(page).toContain('c.key === "disqualified"');
    expect(page).toContain("disqualified: disqualified.data?.total");
    expect(src("components", "v2", "data.ts")).toContain("getBrandDisqualifications({ brandId, offerId })");
  });

  it("the person page sets and removes it, and the step tags stay beside it", () => {
    const page = src("components", "v2", "person-page.tsx");
    expect(page).toContain("useSetLeadDisqualification()");
    expect(page).toContain("useRemoveLeadDisqualification()");
    expect(page).toContain("{tagLabel ? <span");
    expect(page).toContain("<TagChip tag={DISQUALIFIED_TAG} />");
  });

  it("every ConversationTags caller passes the mark (person page and Unibox)", () => {
    for (const f of ["conversation-timeline.tsx", "integrations-conversations.tsx"]) {
      const s = src("components", "v2", f);
      const calls = s.match(/<ConversationTags [^>]*\/>/g) ?? [];
      expect(calls.length).toBeGreaterThan(0);
      for (const c of calls) expect(c).toContain("disqualification=");
    }
  });

  it("writes go to lead-service's PUT/DELETE door with the brand in the query", () => {
    const api = src("lib", "api.ts");
    expect(api).toContain('`/leads/${encodeURIComponent(leadRowId)}/disqualification?${qs.toString()}`');
    expect(api).toContain('method: "PUT"');
    expect(api).toContain("`/leads/disqualifications?${qs.toString()}`");
  });
});
