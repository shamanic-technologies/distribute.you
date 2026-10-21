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
  companyLevelMark,
  disqualificationLevel,
  humanOptedOut,
  leadLevelMark,
  markTag,
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

  it("every ConversationTags caller passes the mark (person page; the Unibox header draws the mark alone)", () => {
    expect(src("components", "v2", "integrations-conversations.tsx")).toContain("<DisqualifiedTag mark={facts.disqualification} />");
    for (const f of ["conversation-timeline.tsx"]) {
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

/**
 * Tags at THEIR level (LEAD-REFONTE-1013): the person (opted out everywhere), this lead (steps +
 * its own mark), the company (client, signed up, "not our target"). Each read off its served field.
 */
describe("tags at their level", () => {
  const COMPANY_MARK = { ...MARK, level: "company", note: "Not our target" };
  const LEAD_MARK = { ...MARK, level: "lead" };
  const BLOCK = { id: "c-1", key: "c-1", isClient: true, signedUp: true, disqualification: COMPANY_MARK };

  it("parses the company block on a row", () => {
    const { leads } = parseLeadsResponse({ leads: [{ ...ROW, company: BLOCK, disqualification: COMPANY_MARK }] }, "t");
    expect(leads[0].company?.isClient).toBe(true);
    expect(leads[0].company?.disqualification?.level).toBe("company");
    expect(parseLeadsResponse({ leads: [{ ...ROW, company: null }] }, "t").leads[0].company).toBeNull();
  });

  it("splits the answering mark by its served level, never mixing them", () => {
    expect(leadLevelMark(COMPANY_MARK)).toBeNull();
    expect(leadLevelMark(LEAD_MARK)).toEqual(LEAD_MARK);
    // A mark written before the level existed is the lead's own.
    expect(disqualificationLevel(MARK)).toBe("lead");
    expect(companyLevelMark(BLOCK, LEAD_MARK)).toEqual(COMPANY_MARK);
    expect(companyLevelMark({ ...BLOCK, disqualification: null }, COMPANY_MARK)).toEqual(COMPANY_MARK);
    expect(companyLevelMark({ ...BLOCK, disqualification: null }, LEAD_MARK)).toBeNull();
    expect(markTag(COMPANY_MARK).label).toBe("Company disqualified");
    expect(markTag(LEAD_MARK).label).toBe("Disqualified");
  });

  it("reads the person's opt-out off the served signal only", () => {
    expect(humanOptedOut({ state: "opted_out", signal: "human_opt_out" })).toBe(true);
    expect(humanOptedOut({ state: "opted_out", signal: "unsubscribed" })).toBe(false);
    expect(humanOptedOut(null)).toBe(false);
  });

  it("parses the brand list's companies beside its leads", () => {
    const parsed = BrandDisqualificationsSchema.parse({
      brandId: "b",
      offerId: null,
      total: 0,
      leads: [],
      companyTotal: 1,
      companies: [{ companyKey: "c-1", companyId: "c-1", name: "BeFCO", domain: "befco.com", leadCount: 3, disqualification: COMPANY_MARK }],
    });
    expect(parsed.companies?.[0].leadCount).toBe(3);
  });

  it("the person page offers both levels and undoes each at its own level", () => {
    const page = src("components", "v2", "person-page.tsx");
    expect(page).toContain("level: formLevel");
    expect(page).toContain('level: "lead" })');
    expect(page).toContain('level: "company" })');
    expect(page).toContain("humanOptedOut(");
    expect(page).toContain("companyBlock.isClient");
    expect(page).toContain("companyBlock.signedUp");
  });

  it("the board's Disqualified column lists the marked companies beside the people", () => {
    const page = src("components", "v2", "deals-page.tsx");
    expect(page).toContain("companies={disqualified.data ? (markedCompanies ?? []) : null}");
    expect(page).toContain("<DisqualifiedCompanyCard");
  });

  it("the remove call carries the level in the query", () => {
    expect(src("lib", "api.ts")).toContain('if (params.level) qs.set("level", params.level);');
  });
});
