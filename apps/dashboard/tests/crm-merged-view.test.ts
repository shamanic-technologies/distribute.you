import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  CrmPairingCountsSchema,
  CrmPairingsSchema,
  alignmentFor,
  contactProvenance,
  crmContactLabel,
  filterAndSortRows,
  judgmentPosition,
  rulingErrorMessage,
  topBuckets,
  STATE_FILTERS,
  CrmContactOriginsSchema,
  type CrmPairingRow,
} from "../src/lib/crm-pairings";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

type Opp = { state: string | null; stateRaw?: string | null };

function row(opts: {
  id?: string;
  state?: string;
  ours?: string | null;
  opps?: Opp[];
  name?: string | null;
  ruling?: boolean;
}): CrmPairingRow {
  const opps = (opts.opps ?? []).map((o, i) => ({
    id: `o${i}`,
    externalId: null,
    name: null,
    state: o.state,
    stateRaw: o.stateRaw ?? o.state,
    monetaryValue: null,
    pipelineName: null,
    stageName: "Free Trail Client",
    createdAt: null,
    updatedAt: null,
  }));
  return {
    crmContact: {
      id: opts.id ?? "c1",
      externalId: null,
      fullName: opts.name === undefined ? "Ada Lovelace" : opts.name,
      firstName: null,
      lastName: null,
      email: "ada@example.com",
      phone: null,
      company: null,
      unsubscribed: false,
    },
    pairing: {
      state: opts.state ?? "paired",
      decidedBy: "signal",
      lead: { leadId: "l1", leadCampaignId: "lc1", campaignId: "k1", fullName: "Ada", email: null, jobTitle: null, company: null },
      evidence: { matchMethod: "email", matchConfidence: "deterministic", candidateCount: 1, matchedAt: null },
      judgment: { status: "not_needed", unavailableReason: null, samePersonProbability: null, model: null, judgedAt: null },
      ruling: opts.ruling ? { ruling: "accepted", note: null, statedByUserId: null, statedAt: "2026-09-24T10:00:00Z" } : null,
    },
    ourStanding: opts.ours === null ? null : { state: opts.ours ?? "contacted", signal: "contacted" },
    theirStatus: {
      opportunities: opps,
      states: [...new Set(opps.map((o) => o.state).filter((s): s is string => Boolean(s)))],
      stageNamesComparable: false,
      stageComparabilityReason: "stage_names_are_free_text_per_customer",
    },
  };
}

describe("alignmentFor — compares fixed-meaning states only", () => {
  it("an unconfirmed / unpaired / rejected row is never compared", () => {
    for (const s of ["unconfirmed", "unpaired", "rejected"]) {
      expect(alignmentFor(row({ state: s, opps: [{ state: "won" }] }))).toBe("not_in_common");
    }
  });
  it("closed-won there and no sale here is BEHIND — the point of the page", () => {
    expect(alignmentFor(row({ ours: "sales_interest", opps: [{ state: "won" }] }))).toBe("behind");
    expect(alignmentFor(row({ ours: "contacted", opps: [{ state: "won" }, { state: "open" }] }))).toBe("behind");
  });
  it("won on both sides is aligned; a sale only we record is ahead", () => {
    expect(alignmentFor(row({ ours: "customer", opps: [{ state: "won" }] }))).toBe("aligned");
    expect(alignmentFor(row({ ours: "customer", opps: [{ state: "open" }] }))).toBe("ahead");
  });
  it("several deals in states that disagree read as a conflict", () => {
    expect(alignmentFor(row({ ours: "customer", opps: [{ state: "won" }, { state: "lost" }] }))).toBe("conflict");
    expect(alignmentFor(row({ ours: "engaged", opps: [{ state: "open" }, { state: "abandoned" }] }))).toBe("conflict");
  });
  it("lost there while we are in play; aligned once we closed them out too", () => {
    expect(alignmentFor(row({ ours: "engaged", opps: [{ state: "lost" }] }))).toBe("lost_there");
    expect(alignmentFor(row({ ours: "disqualified", opps: [{ state: "abandoned" }] }))).toBe("aligned");
  });
  it("no deal, no standing, or only unrecognised words: never guessed", () => {
    expect(alignmentFor(row({ opps: [] }))).toBe("no_deal");
    expect(alignmentFor(row({ ours: null, opps: [{ state: "won" }] }))).toBe("not_comparable");
    expect(alignmentFor(row({ ours: "unresolved", opps: [{ state: "open" }] }))).toBe("not_comparable");
    expect(alignmentFor(row({ opps: [{ state: null, stateRaw: "BOOKED - NO BUY" }] }))).toBe("not_comparable");
  });
});

describe("helpers", () => {
  it("places the probability against the producer's own bars", () => {
    const t = { pairAt: 0.85, rejectAt: 0.15 };
    expect(judgmentPosition(0.9, t)).toBe("pair");
    expect(judgmentPosition(0.1, t)).toBe("reject");
    expect(judgmentPosition(0.5, t)).toBe("between");
    expect(judgmentPosition(null, t)).toBeNull();
  });
  it("names a contact without ever falling to an id", () => {
    expect(crmContactLabel(row({ name: null }).crmContact)).toBe("ada@example.com");
    const c = { ...row({ name: null }).crmContact, email: null, phone: null };
    expect(crmContactLabel(c)).toBe("No name");
  });
  it("reads provenance only when the producer carries it", () => {
    expect(contactProvenance(row({}).crmContact)).toBeNull();
    const withProv = { ...row({}).crmContact, record: { type: "lead", leadSource: "Meta Ads", tags: [], createdAt: null, updatedAt: null, origin: { medium: "form", url: null, referrer: null } } };
    expect(contactProvenance(withProv)?.leadSource).toBe("Meta Ads");
    expect(contactProvenance(withProv)?.origin?.medium).toBe("form");
  });
  it("filters and orders the page, needs-attention first", () => {
    const rows = [
      row({ id: "a", state: "unpaired", name: "Zed" }),
      row({ id: "b", ours: "customer", opps: [{ state: "won" }], name: "Bea" }),
      row({ id: "c", ours: "contacted", opps: [{ state: "won" }], name: "Cy" }),
    ];
    expect(filterAndSortRows(rows, { state: "all", alignment: "all", sort: "attention" }).map((r) => r.crmContact.id)).toEqual(["c", "b", "a"]);
    expect(filterAndSortRows(rows, { state: "paired", alignment: "all", sort: "name" }).map((r) => r.crmContact.id)).toEqual(["b", "c"]);
    expect(filterAndSortRows(rows, { state: "all", alignment: "behind", sort: "name" }).map((r) => r.crmContact.id)).toEqual(["c"]);
  });
  it("turns a refusal into a sentence from its STATUS", () => {
    expect(rulingErrorMessage(409, "retract")).toMatch(/nothing to take back/);
    expect(rulingErrorMessage(500, "rule")).toMatch(/could not record/);
  });
});

describe("schemas parse the deployed shapes", () => {
  it("pairings, including nulls the producer sends", () => {
    const body = {
      crmConnected: true,
      connection: { id: "x", brandId: "b", locationId: "l", status: "active", synced: true, lastSyncedAt: null, lastError: null },
      pairings: [{ ...row({}), ourStanding: null }, { ...row({ state: "unpaired" }), pairing: { ...row({}).pairing, state: "unpaired", decidedBy: null, lead: null } }],
      nextOffset: null,
      judgmentThresholds: { pairAt: 0.85, rejectAt: 0.15 },
    };
    expect(CrmPairingsSchema.safeParse(body).success).toBe(true);
  });
  it("counts", () => {
    const body = {
      crmConnected: true,
      counts: {
        crmContacts: 2694,
        crmContactsWithEmail: 420,
        byState: { paired: 14, unconfirmed: 168, rejected: 0, unpaired: 2512 },
        byMatchMethod: { email: 14, full_name: 168, none: 2512 },
        opportunities: 459,
        opportunitiesByState: { open: 352, won: 28, lost: 0, abandoned: 79, unrecognised: 0 },
        opportunitiesWithUncomparableStage: 459,
      },
      ourLeadsNoCrmContactPointsAt: 17292,
    };
    expect(CrmPairingCountsSchema.safeParse(body).success).toBe(true);
  });
});

describe("origins + state filters", () => {
  it("keeps the producer's order, drops empty buckets, states what is left", () => {
    const b = [{ value: null, count: 2316 }, { value: "Meta Ads", count: 132 }, { value: "x", count: 0 }, { value: "form 13", count: 107 }];
    expect(topBuckets(b, 2)).toEqual({ shown: [b[0], b[1]], more: 1 });
  });
  it("parses crm-service's origins body", () => {
    const body = { brandId: "b", totalContacts: 2695, leadSource: [{ value: null, count: 2316 }], originMedium: [{ value: "csv_import", count: 454 }], contactType: [{ value: "lead", count: 2694 }], tags: { tagged: 323, untagged: 2372, labels: [] } };
    expect(CrmContactOriginsSchema.safeParse(body).success).toBe(true);
  });
  it("every state filter names only lead-service's states", () => {
    for (const f of STATE_FILTERS) for (const st of f.states ?? []) expect(["paired", "unconfirmed", "rejected", "unpaired"]).toContain(st);
  });
});

describe("call sites", () => {
  const page = read("src/components/crm/crm-merged-page.tsx");
  const layout = read("src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/crm/layout.tsx");
  const sidebar = read("src/components/crm/crm-sidebar.tsx");
  const persist = read("src/lib/persist-cache.ts");

  it("the Merged route exists and the Raw page is untouched", () => {
    expect(existsSync(join(root, "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/crm/merged/page.tsx"))).toBe(true);
    expect(read("src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/crm/page.tsx")).toContain("BrandCrmPage");
  });
  it("both the sidebar and the body are beta-gated, with a visible badge", () => {
    expect(layout).toContain("useIsBetaUser");
    expect(layout).toContain("CrmSidebar");
    expect(page).toContain("useIsBetaUser");
    expect(page).toContain('<MaturityBadge level="beta" />');
    expect(sidebar).toContain('maturity: "beta"');
    expect(sidebar).toContain('label: "Raw"');
    expect(sidebar).toContain('label: "Merged"');
  });
  it("reads the counts and one bounded page, never the population", () => {
    expect(page).toContain("getCrmPairingCounts(brandId)");
    expect(page).toContain("limit: PAIRINGS_PAGE, offset");
    expect(persist).toContain('"crmPairings"');
    expect(persist).toContain('"crmPairingCounts"');
  });
  it("filters by pairing state server-side and opens on the pairs in common", () => {
    expect(page).toContain('useState<string>("paired")');
    expect(page).toContain("listCrmPairings(brandId, { limit: PAIRINGS_PAGE, offset, states })");
    expect(read("src/lib/api.ts")).toContain('q.set("state", opts.states.join(","))');
    expect(page).toContain("getCrmContactOrigins(brandId)");
    expect(persist).toContain('"crmContactOrigins"');
  });
  it("reveals on settle and never renders a raw error body", () => {
    expect(page).toContain("pageQ.isPending && !pageQ.isError");
    expect(page).not.toContain("err.message");
    expect(page).not.toContain("error.message");
  });
  it("ruling writes re-read before releasing the control", () => {
    expect(page).toContain("setCrmPairingRuling(");
    expect(page).toContain("withdrawCrmPairingRuling(");
    expect(page).toContain('refetchQueries({ queryKey: ["crmPairings", brandId] })');
  });
  it("carries no em-dash in copy", () => {
    const code = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toContain("—");
  });
});
