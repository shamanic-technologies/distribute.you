import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

// Owner 2026-10-11: a campaign page reads one block per pipe, up to 3 columns on desktop
// (figures, per day, steps), every figure served.
describe("sales-funnel campaign page: one block per pipe", () => {
  const page = read("components/v2/funnel-campaigns.tsx");
  const pipes = read("components/v2/pipe-sections.tsx");

  it("the campaign page renders the pipe blocks with its brand and its parts", () => {
    const at = page.indexOf("export function FunnelCampaignPage(");
    const body = page.slice(at, page.indexOf("export function useFunnelCampaignById("));
    expect(body).toContain("<PipeSections brandId={campaign.brandId} units={units} missionByCampaignId={missionByCampaignId} />");
    expect(body).toContain("<FunnelResults orgId={orgId} brandId={campaign.brandId} units={units} />");
    // Owner 2026-10-11: the pipes read in the order the funnel runs them.
    expect(body).toContain("const units = orderPipesByFunnel(campaign.units,");
    expect(body).toContain("This campaign");
    expect(body).toContain("tabs={tabs}");
  });

  it("a pipe block is three columns on desktop, stacked below", () => {
    expect(pipes).toContain('grid gap-3 lg:grid-cols-3');
    expect(pipes).toContain('title="Figures"');
    expect(pipes).toContain('title="Per day"');
    expect(pipes).toContain('title="Steps"');
  });

  it("draws served daily series, never a browser total", () => {
    expect(pipes).toContain("emails?.daily.map");
    expect(pipes).toContain("spend.daily.map");
    expect(pipes).not.toMatch(/\.reduce\(/);
  });

  it("orders pipes by the funnel's step sequence, unknown legs last, ties served order", async () => {
    const { orderPipesByFunnel } = await import("../src/lib/sales-funnel-campaigns");
    const legs: Record<string, { fromKey: string | null; toKey: string }> = {
      close: { fromKey: "conversation", toKey: "paid_client" },
      source: { fromKey: null, toKey: "lead_found" },
      email: { fromKey: "lead_found", toKey: "conversation" },
      email2: { fromKey: "lead_found", toKey: "conversation" },
    };
    const served = ["close", "x", "source", "email", "email2"];
    expect(orderPipesByFunnel(served, (k) => legs[k] ?? null)).toEqual(["source", "email", "email2", "close", "x"]);
    // A funnel starting mid-way (reactive) still orders from its first served step.
    expect(orderPipesByFunnel(["close", "email"], (k) => legs[k] ?? null)).toEqual(["email", "close"]);
  });
});
