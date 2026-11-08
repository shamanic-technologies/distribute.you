import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");

// Owner 2026-11-08: the user dashboard is fully usable on a phone, portrait AND landscape.
describe("v2 mobile layout", () => {
  it("campaign rows lay out by the LIST width (container query), never the viewport", () => {
    const src = read("components/v2/campaigns-overview-page.tsx");
    const row = src.slice(src.indexOf("export function CampaignLine("), src.indexOf("function ExpectedRoi("));
    // A phone in landscape (844px) or a laptop with the Copilot open crossed `md` while the list was
    // too narrow for the seven columns: the name column fell to 0px under the column labels.
    expect(row).toContain("@[68rem]:grid-cols-[minmax(0,1fr)_104px_120px_116px_120px_76px_170px]");
    expect(row).not.toMatch(/[\s"]md:grid-cols-/);
    expect(row).not.toMatch(/[\s"]md:block/);
    // Below 28rem (a phone) the status button sits under the name so the name is not cut to "Active F…".
    expect(row).toContain("grid-cols-1 items-center @md:grid-cols-[minmax(0,1fr)_auto]");
    expect(src).toContain('overflow-hidden @container">\n          {shown.map((c) => (\n            <CampaignLine');
  });

  it("records footer stops sticking on a short screen and hides key hints on touch", () => {
    const src = read("components/v2/records.tsx");
    const footer = src.slice(src.indexOf("export function RecordsFooter("));
    expect(footer).toContain("[@media(max-height:500px)]:static");
    expect(footer.match(/md:pointer-fine:inline-flex/g)?.length).toBe(2);
  });

  it("integration rows wrap their button under the text on a phone", () => {
    const src = read("components/settings/brand-integrations-card.tsx");
    expect(src.match(/min-w-0 flex-1 basis-\[calc\(100%-52px\)\] sm:basis-0/g)?.length).toBe(3);
  });
});
