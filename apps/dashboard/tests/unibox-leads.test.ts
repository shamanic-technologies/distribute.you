import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  UniboxLeadCardSchema,
  UniboxPageSchema,
  dimensionValueLabel,
  filtersFromParams,
  filtersKey,
  lifecycleOptions,
  uniboxLeadName,
  uniboxQuery,
  uniboxThreadRef,
} from "../src/lib/unibox-leads";

const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");

// One row as lead-service served it in prod (2026-10-17), name null included.
const row = {
  humanId: "a7b69cac-823f-43a2-bb26-ce25ea71ad09",
  companyKey: "8c0ef018-13fd-4bcc-9198-0874571a208c",
  name: null,
  emails: ["kriti@berkeley.edu"],
  phones: [],
  personKeys: ["email:kriti@berkeley.edu"],
  leadIds: ["23f11104-7099-48b7-a6d0-201c349bb2af"],
  types: [],
  status: "prospect",
  roles: ["investor"],
  lifecycle: { key: "contacted", rank: 2, label: "Contacted" },
  steps: [{ at: "2026-09-29T01:13:18.584Z", step: "lead_found" }],
  interest: "not_asked",
  conversation: "waiting_on_us",
  contactability: "contactable",
  fit: "fit",
  fitNote: null,
  lastTheirsAt: "2026-09-29T14:11:02.000Z",
  lastOursAt: "2026-09-29T13:12:43.227Z",
  lastActivityAt: "2026-09-29T14:11:02.000Z",
  connectionTags: ["professional_to_brand"],
};
const ladder = [
  { key: "contacted", rank: 2, label: "Contacted" },
  { key: "lead_found", rank: 1, label: "Lead found" },
];

describe("Unibox list from lead-service (owner 2026-10-17)", () => {
  it("parses the served page and the lead card", () => {
    const page = UniboxPageSchema.parse({ brandId: "b", lifecycleLadder: ladder, rows: [row], total: 10558, nextCursor: "c", builtAt: null });
    expect(page.total).toBe(10558);
    const card = UniboxLeadCardSchema.parse({
      brandId: "b",
      lead: row,
      campaigns: [{ campaignId: "647572d9", name: "CRM Email Replies", pipeCampaignIds: ["p1", "p2"], servedAt: null, furthest: { key: "contacted", rank: 2, label: "Contacted" }, steps: [] }],
    });
    expect(card.campaigns[0].furthest?.label).toBe("Contacted");
    expect(card.campaigns[0].name).toBe("CRM Email Replies");
  });

  it("sends every filter as a comma list to lead-service, with q and the cursor", () => {
    const qs = new URLSearchParams(uniboxQuery("b", { status: ["prospect", "churned"], role: ["investor"], conversation: ["waiting_on_us"] }, { q: "kriti", limit: 100, cursor: "c1" }));
    expect(qs.get("status")).toBe("prospect,churned");
    expect(qs.get("role")).toBe("investor");
    expect(qs.get("conversation")).toBe("waiting_on_us");
    expect(qs.get("lifecycle")).toBeNull();
    expect(qs.get("q")).toBe("kriti");
    expect(qs.get("cursor")).toBe("c1");
  });

  it("reads filters from the URL and keys them order-free", () => {
    const f = filtersFromParams(new URLSearchParams("fit=wrong_person,fit&lifecycle=none"));
    expect(f.fit).toEqual(["wrong_person", "fit"]);
    expect(filtersKey(f)).toBe(filtersKey({ lifecycle: ["none"], fit: ["fit", "wrong_person"] }));
  });

  it("orders the stage filter by the served ladder, then no stage", () => {
    expect(lifecycleOptions(ladder).map((o) => o.value)).toEqual(["lead_found", "contacted", "none"]);
  });

  it("names values in plain words, the thread by the first person key, a nameless lead by its address", () => {
    expect(dimensionValueLabel("conversation", "waiting_on_us")).toBe("Waiting on us");
    expect(dimensionValueLabel("fit", "not_our_target")).toBe("Not our target");
    expect(uniboxThreadRef(row)).toBe("email:kriti@berkeley.edu");
    expect(uniboxLeadName(row)).toBe("kriti@berkeley.edu");
  });

  it("the page reads the list from lead-service and puts the lead card beside the thread", () => {
    const view = read("components/v2/integrations-conversations.tsx");
    expect(view).toContain("listUniboxLeads(");
    expect(view).not.toContain("listPeople(brandId, {\n        limit: PEOPLE_PAGE_SIZE");
    expect(view).toContain("<UniboxLeadCardPanel");
    // The card shows the campaign name lead-service serves, never a name joined in the browser.
    const card = read("components/v2/unibox-lead-card.tsx");
    expect(card).toContain("{c.name ?? \"Campaign\"}");
    expect(card).not.toContain("useMissions(");
    expect(read("lib/api.ts")).toContain("`/leads/unibox?${uniboxQuery(brandId, filters, opts)}`");
    expect(read("lib/api.ts")).toContain("`/leads/unibox-lead?${qs.toString()}`");
  });
});
