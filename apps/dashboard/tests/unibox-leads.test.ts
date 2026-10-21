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
  uniboxRowPreview,
  uniboxRowSubtitle,
  uniboxRowTag,
  uniboxValueTag,
  uniboxWaitsOnUs,
  uniboxQuery,
  uniboxThreadRef,
  uniboxRowId,
  uniboxRowKey,
  uniboxCardQuery,
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
    // The name stands alone in bold; title and company make the grey second line (owner 2026-10-21).
    expect(uniboxRowSubtitle({ title: "Head of RA", company: { id: "c1", name: "Platomics", domain: "platomics.com" } })).toBe("Head of RA · Platomics");
    expect(uniboxRowSubtitle({ title: null, company: { id: "c1", name: null, domain: "cifacom.com" } })).toBe("cifacom.com");
    expect(uniboxRowSubtitle({ title: undefined, company: null })).toBeNull();
    // A served first + last name is the row's name (lead-service UNIBOX-PERSON-NAME-1021).
    const named = UniboxPageSchema.parse({ brandId: "b", lifecycleLadder: [], rows: [{ ...row, name: "Andreas Oberleitner", firstName: "Andreas", lastName: "Oberleitner", title: "Head of RA" }], total: 1, nextCursor: null, builtAt: null }).rows[0];
    expect(uniboxLeadName(named)).toBe("Andreas Oberleitner");
    expect(named.title).toBe("Head of RA");
  });

  it("a row shows the first words of its last message, You: when we wrote it, nothing when none is served (owner 2026-10-21)", () => {
    const at = "2026-10-21T05:08:00.000Z";
    const parsed = UniboxPageSchema.parse({
      brandId: "b",
      lifecycleLadder: [],
      rows: [{ ...row, lastMessage: { at, side: "ours", sentBy: "automation", channel: "email", source: "instantly", subject: "Re: Platomics", preview: "Last note from me, Andreas…" }, lastMessageReason: null }],
      total: 1,
      nextCursor: null,
      builtAt: null,
    }).rows[0];
    expect(uniboxRowPreview(parsed)).toBe("You: Last note from me, Andreas…");
    expect(uniboxRowPreview({ lastMessage: { side: "theirs", preview: "Sounds good, Tuesday?" } })).toBe("Sounds good, Tuesday?");
    expect(uniboxRowPreview({ lastMessage: { side: null, preview: "Hello" } })).toBe("Hello");
    expect(uniboxRowPreview({ lastMessage: { side: "ours", preview: null } })).toBeNull();
    expect(uniboxRowPreview({ lastMessage: null })).toBeNull();
    // An older body without the field still parses and shows no line.
    expect(uniboxRowPreview(UniboxPageSchema.parse({ brandId: "b", lifecycleLadder: [], rows: [row], total: 1, nextCursor: null, builtAt: null }).rows[0])).toBeNull();
    const view = read("components/v2/integrations-conversations.tsx");
    const at2 = view.indexOf("function LeadRow(");
    const leadRow = view.slice(at2, view.indexOf("function Thread(", at2));
    expect(leadRow).toContain("const preview = uniboxRowPreview(row);");
    expect(leadRow).toContain("after={preview ? ");
  });

  it("a row carries ONE tag, the hottest true fact, nothing for the default (owner 2026-10-21)", () => {
    const L = [
      { key: "lead_found", rank: 1, label: "Lead found" },
      { key: "contacted", rank: 2, label: "Contacted" },
      { key: "engaged", rank: 3, label: "Engaged" },
      { key: "signup_or_form", rank: 4, label: "Signup / Form submitted" },
      { key: "meeting_booked", rank: 5, label: "Meeting booked" },
      { key: "paid_client", rank: 7, label: "Paid client" },
    ];
    const at = (key: string) => L.find((r) => r.key === key)!;
    const quiet = { ...row, conversation: "no_reply_yet", roles: [], lifecycle: at("contacted"), interest: "not_asked" };
    const tag = (over: object) => uniboxRowTag({ ...quiet, ...over }, L);
    expect(tag({})).toBeNull();
    expect(tag({ lifecycle: null })).toBeNull();
    // Engaged is teal, Interested beats it in amber, a signup beats both, a meeting too.
    expect(tag({ lifecycle: at("engaged") })).toMatchObject({ label: "Engaged", tone: "reply" });
    expect(tag({ lifecycle: at("engaged"), interest: "interested" })).toMatchObject({ label: "Interested", tone: "hot" });
    expect(tag({ lifecycle: at("signup_or_form"), interest: "interested" })).toMatchObject({ label: "Signup / Form submitted", tone: "hot" });
    expect(tag({ lifecycle: at("meeting_booked") })).toMatchObject({ label: "Meeting booked", tone: "hot" });
    // A customer reads green; a closed door ends the conversation and reads rose.
    expect(tag({ status: "customer", lifecycle: at("paid_client") })).toMatchObject({ label: "Paid client", tone: "won" });
    expect(tag({ status: "customer", lifecycle: null })).toMatchObject({ label: "Customer", tone: "won" });
    expect(tag({ lifecycle: at("signup_or_form"), interest: "not_interested" })).toMatchObject({ label: "Not interested", tone: "lost" });
    expect(tag({ contactability: "bounced" })).toMatchObject({ label: "Bounced", tone: "lost" });
    // Waiting on us is the row's dot, not a stage.
    expect(tag({ conversation: "waiting_on_us" })).toBeNull();
    expect(uniboxWaitsOnUs({ conversation: "waiting_on_us" })).toBe(true);
  });

  it("one look per value on every surface: the card, the row and the filters agree", () => {
    expect(uniboxValueTag("lifecycle", "engaged", "Engaged").tone).toBe("reply");
    expect(uniboxValueTag("interest", "interested", "Interested")).toMatchObject({ tone: "hot", icon: "flame" });
    expect(uniboxValueTag("lifecycle", "paid_client", "Paid client").tone).toBe("won");
    expect(uniboxValueTag("lifecycle", "something_new", "Something new")).toEqual({ label: "Something new", tone: "neutral", icon: "dot" });
    const card = read("components/v2/unibox-lead-card.tsx");
    expect(card).not.toContain("VALUE_TONE");
    expect(card).toContain("uniboxValueTone(dim, o.value)");
  });

  it("a row is a RELATION: its thread, card and URL read its relationKey, two rows of one human stay apart", () => {
    const pro = { ...row, humanId: "h1", companyKey: "cifacom.com", relationKey: "rel:p1:org:c1" };
    const unknownOrg = { ...row, humanId: "h1", companyKey: null, relationKey: "rel:p1:pro" };
    expect(uniboxThreadRef(pro)).toBe("rel:p1:org:c1");
    expect(uniboxRowId(pro)).toBe("rel:p1:org:c1");
    expect(uniboxRowKey(pro)).not.toBe(uniboxRowKey(unknownOrg));
    expect(uniboxCardQuery("rel:p1:org:c1")).toEqual({ relationKey: "rel:p1:org:c1" });
    expect(uniboxCardQuery("h1")).toEqual({ humanId: "h1" });
    // An older body (no relationKey yet) keeps today's reads.
    const legacy = { ...row, humanId: "h2", companyKey: "a.com" };
    expect(uniboxRowId(legacy)).toBe("h2");
    expect(uniboxRowKey(legacy)).toBe("h2|a.com");
    expect(uniboxThreadRef(legacy)).toBe("email:kriti@berkeley.edu");
  });

  it("clicking a row opens crm's timeline with relationKey= (the shared timeline read)", () => {
    const api = read("lib/api.ts");
    const at = api.indexOf("export async function getPersonTimeline(");
    expect(api.slice(at, api.indexOf("export async function getPersonApiCall("))).toContain("...personRefQuery(ref)");
    const view = read("components/v2/integrations-conversations.tsx");
    expect(view).toContain("getUniboxLead(brandId, uniboxRowId(r))");
    expect(view).toContain("key={uniboxRowKey(r)}");
    expect(view).toContain("timelineKey(brandId, threadRef)");
    expect(view).not.toContain("r.humanId === openKey");
  });

  it("the page reads the list from lead-service and puts the lead card beside the thread", () => {
    const view = read("components/v2/integrations-conversations.tsx");
    expect(view).toContain("listUniboxLeads(");
    expect(view).not.toContain("listPeople(brandId, {\n        limit: PEOPLE_PAGE_SIZE");
    expect(view).toContain("<UniboxLeadCardPanel");
    // The card shows the campaign name lead-service serves, never a name joined in the browser.
    const card = read("components/v2/unibox-lead-card.tsx");
    expect(card).toContain("{c.name ?? \"Campaign\"}");
    expect(card).not.toContain("useCampaigns(");
    expect(read("lib/api.ts")).toContain("`/leads/unibox?${uniboxQuery(brandId, filters, opts)}`");
    expect(read("lib/api.ts")).toContain("`/leads/unibox-lead?${qs.toString()}`");
  });
});
