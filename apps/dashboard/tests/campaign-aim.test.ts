import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pathChangeSentence, pathChangedAt } from "../src/lib/campaign-path-change";
import { FunnelCampaignCopySchema, unpricedWords } from "../src/lib/sales-funnel-campaigns";

/**
 * P5.1 (owner 2026-10-31): the CLIENT campaign page opens on what the campaign aims at (Target, Type, brief) and the
 * path it runs NOW; the Campaigns list row shows that path. Every customer, never staff-gated; staff concepts absent.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");

describe("when the path last changed (campaign-service plan changes, newest first)", () => {
  const RUN = "start_to_post_published@threads-post+post_published_to_website_visit+website_visit_to_signup+signup_to_paid_client";
  const OLD = "start_to_post_published@threads-post+post_published_to_paid_client";
  it("is the newest change that landed on the running funnel", () => {
    const changes = [
      { fromSalesFunnelId: RUN, toSalesFunnelId: RUN, appliedAt: "2026-10-30T09:00:00Z" },
      { fromSalesFunnelId: OLD, toSalesFunnelId: RUN, appliedAt: "2026-10-29T11:11:09Z" },
      { fromSalesFunnelId: RUN, toSalesFunnelId: OLD, appliedAt: "2026-10-28T08:00:00Z" },
    ];
    expect(pathChangedAt(changes, RUN)).toBe("2026-10-29T11:11:09Z");
  });
  it("never changed, or nothing running served: null", () => {
    expect(pathChangedAt([], RUN)).toBeNull();
    expect(pathChangedAt([{ fromSalesFunnelId: RUN, toSalesFunnelId: RUN, appliedAt: "2026-10-30T09:00:00Z" }], RUN)).toBeNull();
    expect(pathChangedAt([{ fromSalesFunnelId: OLD, toSalesFunnelId: RUN, appliedAt: "2026-10-29T11:11:09Z" }], null)).toBeNull();
  });
  it("reads as one plain sentence, the day in UTC", () => {
    expect(pathChangeSentence("2026-10-29T23:30:00Z", "Signup")).toBe("Since Oct 29 we follow a better path to Signup.");
    expect(pathChangeSentence("2026-10-29T11:00:00Z", null)).toBe("Since Oct 29 we follow a better path.");
  });
});

describe("the served copy carries the running funnel and each pipe", () => {
  it("parses runningSalesFunnelId and a channel item's pipeId; an older body without them still parses", () => {
    const base = { id: "c", salesFunnelId: "f1", name: "n", status: "ongoing", type: "proactive", typeLabel: "Daily", copyUnavailableReason: null };
    const now = FunnelCampaignCopySchema.parse({
      ...base,
      runningSalesFunnelId: "f2",
      path: { items: [{ kind: "step", key: "start", label: "Start" }, { kind: "channel", slug: "threads-post", name: "Threads posts", pipeId: "threads-post|start_to_post_published" }] },
    });
    expect(now.runningSalesFunnelId).toBe("f2");
    expect(now.path?.items[1]).toMatchObject({ pipeId: "threads-post|start_to_post_published" });
    expect(FunnelCampaignCopySchema.parse({ ...base, path: { items: [{ kind: "channel", slug: "x", name: "X" }] } }).runningSalesFunnelId).toBeUndefined();
  });
});

describe("the client campaign page", () => {
  const aim = read("components/v2/campaign-aim.tsx");
  const page = read("components/v2/funnel-campaigns.tsx");
  it("opens on what the campaign aims at, for every customer (no staff gate), above This campaign", () => {
    expect(aim).not.toMatch(/useStaffMode|StaffOnly|useIsAdminUser/);
    const at = page.indexOf("<CampaignAimSection");
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(page.indexOf(">This campaign</SectionTitle>"));
  });
  it("shows the Target by its served step label, the Type tag, the brief editable in place with its one-line purpose", () => {
    expect(aim).toContain("stepLabel(catalogue, campaign.target)");
    expect(aim).toContain("<TypeTag row={copy} />");
    expect(aim).toContain("<BriefField");
    expect(aim).toContain("Tell us in plain words how to run this campaign. We follow it.");
    expect(aim).not.toMatch(/>\s*Save\s*</);
  });
  it("draws no pipe line and no staff concept: what runs is the Plan below (owner 2026-11-02)", () => {
    const code = aim.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain("FunnelPathLine");
    expect(code).not.toContain("salesFunnelPlanChanges");
    for (const staff of ["Jev", "play", "strategy", "tactic", "useFactoryShadow", "useStaffCatalogueObject", "Pipe"]) expect(code).not.toContain(staff);
  });
  it("the campaign page renders no staff plan card (pipes, plays, fixed funnel)", () => {
    expect(page).not.toContain("<FactoryPlanSection");
  });
});

describe("an outcome named as a label wears its icon (owner 2026-11-03: « alway put the icone of the outcome you name »)", () => {
  it("the Goal card draws the Target's StepMark and no « What it orders » caption", () => {
    const aim = read("components/v2/campaign-aim.tsx");
    expect(aim).toContain("<StepMark stepKey={campaign.target}");
    expect(aim).not.toContain("What it orders");
  });
  it("the Campaigns list row, Milestones, Plan, Strategy and Scripts headings draw it too", () => {
    expect(read("components/v2/campaigns-overview-page.tsx")).toContain("<StepMark stepKey={campaign.target}");
    const factory = read("components/v2/factory-campaign.tsx");
    for (const key of ["node.outcome", "p.outcome", "stepKey"]) expect(factory).toContain(`<StepMark stepKey={${key}}`);
    // Milestones are cards now (LEAD-GENERIC-1106), one shared component with Today.
    expect(read("components/v2/today-targets.tsx")).toContain("<StepMark stepKey={card.step} />");
  });
});

describe("a campaign whose outcome has no value of its own (features-service outcome_unvalued)", () => {
  it("prints a dash, never a negative ROI", () => {
    expect(unpricedWords("outcome_unvalued")).toBe("—");
  });
});
