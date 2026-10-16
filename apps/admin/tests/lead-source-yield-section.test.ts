import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEAD_SOURCE_YIELD_PATH, getLeadSourceYield } from "@/lib/api";
import { sourceLabel } from "@/components/audit/lead-source-yield-section";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("Blocklists > Lead sources", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses the WHOLE prod payload through the real reader", async () => {
    const body = read("tests/fixtures/lead-source-yield-prod-2026-10-16.json");
    const fetchSpy = vi.fn(async (_url: string | URL | Request) => new Response(body, { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchSpy);
    const data = await getLeadSourceYield(60, "staff-key");
    expect(data.sources.some((s) => s.key === "sourcing-apollo-cold-filters")).toBe(true);
    expect(data.coverage.firstEmails).toBe(61036);
    expect(String(fetchSpy.mock.calls[0][0])).toContain(`${LEAD_SOURCE_YIELD_PATH}?days=60`);
  });

  it("reads the gateway path api-service #1302 serves", () => {
    expect(LEAD_SOURCE_YIELD_PATH).toBe("/instantly/ops/lead-source-yield");
  });

  it("one chart per measure, headline = the served total (per_tag bars can exceed it)", () => {
    const src = read("src/components/audit/lead-source-yield-section.tsx");
    for (const m of ["firstEmails", "hardBounces", "refusals", "blocklistRefusals", "firstEmailsFromListedDomains"]) {
      expect(src, m).toContain(`key: "${m}"`);
    }
    expect(src).toContain("num(last.total)");
  });

  it("names a source readably, keeps the tag", () => {
    expect(sourceLabel("sourcing-apollo-cold-filters")).toBe("Apollo cold filters");
    expect(sourceLabel("stated_by_org")).toBe("Stated by org");
  });

  it("is mounted on the Blocklists page", () => {
    expect(read("src/app/(authed)/(dashboard)/audit/cold-email/blocklists/page.tsx")).toContain("<LeadSourceYieldSection days={days} />");
  });
});
