import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const RAW = read("src/components/v2/integrations-crm.tsx");
const MERGED = read("src/components/v2/integrations-merged.tsx");
const SETUP = read("src/components/v2/setup-pages.tsx");

// The v2 Integrations pages are drawn in Keel's own anatomy, not the v1 CRM pages
// recoloured: v1 stays as it is for v1, v2 forks no data layer.
describe("v2 Integrations pages", () => {
  it("mounts the v2 views, never the v1 CRM pages", () => {
    const page = SETUP.slice(SETUP.indexOf("export function V2IntegrationsPage("), SETUP.indexOf("export function V2BrandSettingsPage("));
    expect(page).toContain("<V2CrmRawView orgId={orgId} brandId={brandId} />");
    expect(page).toContain("<V2CrmMergedView brandId={brandId} />");
    expect(SETUP).not.toContain("<BrandCrmPage");
    expect(SETUP).not.toContain("<CrmMergedPage");
  });

  it("marks the CRM and Conversations tabs beta, and leads with the GA AI tab", () => {
    const tabs = SETUP.slice(SETUP.indexOf("function integrationTabs("), SETUP.indexOf("export function V2IntegrationsPage("));
    expect(tabs.match(/badge: "beta"/g)?.length).toBe(3);
    expect(tabs.indexOf('label: "Your AI"')).toBeGreaterThan(-1);
    expect(tabs.indexOf('label: "Your AI"')).toBeLessThan(tabs.indexOf('label: "Your CRM"'));
  });

  it("reuses the v1 readers on the v1 query keys, so caches dedupe and persist", () => {
    expect(RAW).toContain('["crmConnections", brandId], () => listCrmConnections(brandId)');
    expect(RAW).toContain('["crmContacts", brandId]');
    expect(RAW).toContain('["crmPipeline", brandId], () => getCrmPipeline(brandId)');
    expect(MERGED).toContain('["crmPairingCounts", brandId], () => getCrmPairingCounts(brandId)');
    expect(MERGED).toContain('["crmPairings", brandId, stateFilter, offset]');
    expect(MERGED).toContain('["crmPairings", brandId, "toConfirmSection"]');
    expect(MERGED).toContain('["crmContactOrigins", brandId], () => getCrmContactOrigins(brandId)');
  });

  it("carries no v1 class family and no v1 layout component", () => {
    for (const [name, src] of [["raw", strip(RAW)], ["merged", strip(MERGED)]] as const) {
      expect(src, name).not.toMatch(/text-gray-|bg-gray-|border-gray-|bg-brand-50|rounded-xl border|InfoTooltip|MaturityBadge|DashboardPage|shadow-2xl/);
      expect(src, name).not.toMatch(/text-(green|red|amber)-\d/);
    }
    expect(RAW).not.toContain("CrmPipelineBoard");
    expect(RAW).not.toContain("CrmContactsTable");
  });

  it("never writes to their CRM: the board has no drag", () => {
    expect(strip(RAW)).not.toMatch(/draggable|onDrop|useBoardDrag|useMutation|apiCall\(|fetch\(/);
  });

  it("keeps the ruling writes and re-reads both roots before releasing the button", () => {
    const act = MERGED.slice(MERGED.indexOf("const act = async"), MERGED.indexOf("const host ="));
    expect(act).toContain("withdrawCrmPairingRuling(");
    expect(act).toContain("setCrmPairingRuling(");
    expect(act).toContain('refetchQueries({ queryKey: ["crmPairings", brandId] })');
    expect(act).toContain('refetchQueries({ queryKey: ["crmPairingCounts", brandId] })');
    expect(act).toContain("rulingErrorMessage(");
    expect(act.indexOf("refetchQueries")).toBeLessThan(act.indexOf("setPending(null);\n  };"));
  });

  it("keeps the ONE shared attribution card in the drawer", () => {
    expect(MERGED).toContain("<CrmAttributionCard leadRowId={lead.leadCampaignId} brandId={brandId} />");
  });

  it("portals the drawer to the shell layer and closes it on Esc", () => {
    expect(MERGED).toContain('document.getElementById("v2-portal")');
    expect(MERGED).toContain('e.key === "Escape"');
  });

  it("does not skeleton a settled read on every poll", () => {
    expect(RAW).toContain("isFetchedAfterMount");
    expect(MERGED).toContain("isFetchedAfterMount");
  });
});
