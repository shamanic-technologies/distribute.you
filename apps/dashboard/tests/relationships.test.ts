import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RelationshipReviewSchema,
  addableTags,
  RELATIONSHIP_TAGS,
  cardTitle,
  confidencePct,
  deniedTags,
  mergedByLabel,
  relationshipTagLabel,
} from "../src/lib/v2/relationships";
import { PeopleListSchema } from "../src/lib/people-conversations";

const SRC = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

// Shaped on lead-service's readReview (RELATIONSHIP-TAGS-1014, lead-service #865).
const review = {
  brandId: "b1",
  mergeQuestions: [
    {
      id: "q1",
      confidence: 0.62,
      reason: "Same first name, both in the MCP '24 groups",
      a: { humanId: "h1", name: "Yulia (WA)", emails: [], phones: [], channels: ["whatsapp"] },
      b: { humanId: "h2", name: "Yuliia Siletska", emails: ["yuliia@example.com"], phones: [], channels: ["signup"] },
    },
  ],
  tagQuestions: [{ humanId: "h3", name: "Dmytro", tag: "personal", confidence: 0.5, reason: null }],
  companyQuestions: [{ humanId: "h4", name: "Ana", candidates: [{ name: "Acme", domain: "acme.com", source: "email_domain" }] }],
  settled: {
    merges: [{ linkId: "l1", humanIds: ["h5", "h6"], names: ["A", null], judgedBy: "person:u1", at: "2026-10-14T08:00:00Z" }],
    people: [
      {
        humanId: "h7",
        name: "Bo",
        company: { id: null, name: "Acme", domain: "acme.com", source: "person" },
        tags: ["customer"],
        details: [
          { tag: "customer", level: "lead", state: "yes", basis: "evidence", confidence: null, evidence: "payment", at: "2026-10-14T08:00:00Z" },
          { tag: "personal", level: "human", state: "no", basis: "person", confidence: null, evidence: null, at: "2026-10-14T08:00:00Z" },
        ],
      },
    ],
  },
  counts: { subjects: 10, judged: 8, byTag: { customer: 1 }, unsureMerges: 1, unsureTags: 1, companyQuestions: 1 },
};

describe("relationship review reader", () => {
  it("parses lead-service's review body", () => {
    const r = RelationshipReviewSchema.safeParse(review);
    expect(r.success).toBe(true);
  });

  it("names tags in the owner's words, and passes an unknown tag through", () => {
    expect(relationshipTagLabel("other_professional")).toBe("Other professional");
    expect(relationshipTagLabel("personal")).toBe("Personal");
    expect(relationshipTagLabel("new_tag")).toBe("new_tag");
  });

  it("names a journalist and offers the tag in the picker (JOURNALISTS-NOT-LEADS-1016)", () => {
    expect(relationshipTagLabel("journalist")).toBe("Journalist");
    expect(RELATIONSHIP_TAGS).toContain("journalist");
    expect(addableTags(["prospect"])).toContain("journalist");
    expect(addableTags(["journalist"])).not.toContain("journalist");
  });

  it("reads the owner's NO, offers the tags not held yet, and says who merged", () => {
    const p = review.settled.people[0];
    expect(deniedTags(p.details)).toEqual(["personal"]);
    expect(addableTags(p.tags)).not.toContain("customer");
    expect(addableTags(p.tags)).toContain("personal");
    expect(mergedByLabel("person:u1")).toBe("Merged by you");
    expect(mergedByLabel("jev")).toBe("Merged by AI");
  });

  it("titles a nameless card by its first address and states confidence as a whole %", () => {
    expect(cardTitle({ humanId: "x", name: null, emails: [], phones: ["+33600000000"], channels: [] })).toBe("+33600000000");
    expect(confidencePct(0.624)).toBe("62% sure");
    expect(confidencePct(null)).toBeNull();
  });
});

describe("Unibox rows carry the relationship block", () => {
  const base = {
    brandId: "b1",
    scope: { status: "ready", lastBuiltAt: null, lastError: null },
    sources: [],
    total: 1,
    limit: 50,
    offset: 0,
    nextOffset: null,
    people: [
      {
        personKey: "email:a@b.com",
        identityKeys: [],
        displayName: "A",
        company: null,
        emails: ["a@b.com"],
        phones: [],
        sources: [],
        firstActivityAt: null,
        lastActivityAt: null,
        state: "x",
        stateSource: "crm",
        presences: [],
        relationship: {
          humanId: "h1",
          company: null,
          tags: ["personal", "customer"],
          unsureTags: ["investor"],
          judgedAt: "2026-10-14T08:00:00Z",
          details: [{ tag: "personal" }],
          policies: { business_only: false },
        },
      },
    ],
    relationships: { status: "ok", error: null, filter: null, counts: { personal: 1 }, untagged: 0, unjudged: 0, population: 1 },
  };

  it("parses crm-service's list with tags per row and counts per tag", () => {
    const r = PeopleListSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.success && r.data.people[0].relationship?.tags).toEqual(["personal", "customer"]);
    expect(r.success && r.data.relationships?.counts?.personal).toBe(1);
  });

  it("still parses a list from before crm-service served relationships", () => {
    const { relationships: _r, ...old } = base;
    const people = old.people.map(({ relationship: _x, ...p }) => p);
    expect(PeopleListSchema.safeParse({ ...old, people }).success).toBe(true);
  });

  it("the row and the thread header draw the chips; the filter shows only once crm-service serves counts", () => {
    const src = read("components/v2/integrations-conversations.tsx");
    expect(src).toContain("<RelationshipChips tags={person.relationship.tags}");
    expect(src).toContain("<RelationshipChips tags={listed.relationship.tags}");
    expect(src).toContain("list?.relationships && (");
    expect(src).toContain("relationship: relationship ?? undefined");
  });
});

describe("Relationships page", () => {
  it("is a brand tab beside Settings and Integrations, with its own route", () => {
    expect(read("components/v2/setup-pages.tsx")).toContain('label: "Relationships", href: v2Href(orgId, brandId, "relationships")');
    expect(read("app/(authed)/v2/orgs/[orgId]/brands/[brandId]/relationships/page.tsx")).toContain("<V2RelationshipsPage />");
  });

  it("a merge is undone from its row's ⋮ menu, Not the same person (owner 2026-10-14)", () => {
    const page = read("components/v2/relationships-page.tsx");
    expect(page).toContain('label: "Not the same person"');
    expect(page).toContain("undoRelationshipMerge(brandId, m.linkId)");
    expect(page).not.toContain('"Undoing..." : "Undo"');
  });

  it("the Unibox thread offers each of the person's merges to unmerge from its ⋮ (owner 2026-10-14)", () => {
    const view = read("components/v2/integrations-conversations.tsx");
    expect(view).toContain("<UnmergeMenu brandId={brandId} name={name} merges={listed.relationship.merges} />");
    expect(read("components/v2/relationship-tags.tsx")).toContain("await undoRelationshipMerge(brandId, m.linkId);");
  });

  it("each click calls lead-service through the gateway's brand-scoped routes", () => {
    const api = read("lib/api.ts");
    expect(api).toContain("`/brands/${encodeURIComponent(brandId)}/relationships`");
    for (const fn of [
      "getRelationshipReview",
      "answerRelationshipMerge",
      "undoRelationshipMerge",
      "setRelationshipTag",
      "withdrawRelationshipTag",
      "setRelationshipCompany",
    ]) {
      expect(read("components/v2/relationships-page.tsx")).toContain(`${fn}(`);
    }
  });
});
