import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Campaign logs page", () => {
  const logsPagePath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/[id]/logs/page.tsx"
  );
  const sidebarPath = path.join(
    __dirname,
    "../src/components/campaign-sidebar.tsx"
  );
  const apiPath = path.join(__dirname, "../src/lib/api.ts");

  const apiContent = fs.readFileSync(apiPath, "utf-8");
  const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");

  describe("api.ts", () => {
    it("should export RunEvent type", () => {
      expect(apiContent).toContain("export interface RunEvent");
    });

    it("should export EventLevel type", () => {
      expect(apiContent).toMatch(/export type EventLevel\s*=/);
    });

    it("should export listCampaignEvents function", () => {
      expect(apiContent).toContain("export async function listCampaignEvents");
    });

    it("should call /events?campaignId= endpoint (runs-service proxy via api-service)", () => {
      expect(apiContent).toContain("/events?campaignId=");
    });
  });

  describe("sidebar", () => {
    it("should include a Logs link in settings items", () => {
      expect(sidebarContent).toContain('id: "logs"');
      expect(sidebarContent).toContain('label: "Logs"');
    });

    it("should place Logs after Runs in settings", () => {
      const runsIdx = sidebarContent.indexOf('id: "runs"');
      const logsIdx = sidebarContent.indexOf('id: "logs"');
      expect(runsIdx).toBeGreaterThan(-1);
      expect(logsIdx).toBeGreaterThan(runsIdx);
    });

    it("should link Logs to ${basePath}/logs", () => {
      expect(sidebarContent).toContain("`${basePath}/logs`");
    });
  });

  describe("logs page", () => {
    const logsPageContent = fs.readFileSync(logsPagePath, "utf-8");

    it("should call listCampaignEvents with campaign ID", () => {
      expect(logsPageContent).toContain("listCampaignEvents(campaignId");
    });

    it("should poll every 5 seconds", () => {
      expect(logsPageContent).toContain("refetchInterval: 5_000");
    });

    it("should render event fields: service, event, detail", () => {
      expect(logsPageContent).toMatch(/event\.service/);
      expect(logsPageContent).toMatch(/event\.event/);
      expect(logsPageContent).toMatch(/event\.detail/);
    });

    it("should support level badges info / warn / error", () => {
      expect(logsPageContent).toContain("info");
      expect(logsPageContent).toContain("warn");
      expect(logsPageContent).toContain("error");
    });

    it("should group events by runId", () => {
      expect(logsPageContent).toMatch(/runId|run_id/);
      // Some grouping construct
      expect(logsPageContent).toMatch(/groupBy|groupedByRun|byRun|Map</);
    });

    it("should show empty state copy", () => {
      expect(logsPageContent).toMatch(/No logs/i);
    });

    it("should request page size of 100", () => {
      expect(logsPageContent).toMatch(/limit:\s*100/);
    });

    it("should expose a service filter", () => {
      expect(logsPageContent).toMatch(/serviceFilter/);
    });

    it("should expose a keyword filter", () => {
      expect(logsPageContent).toMatch(/keyword/i);
    });

    it("should not auto-expand the most recent run", () => {
      expect(logsPageContent).not.toMatch(/defaultOpen=\{i === 0\}/);
      expect(logsPageContent).not.toMatch(/open=\{i === 0\}/);
    });

    it("should support dark mode hover styles on event rows", () => {
      expect(logsPageContent).toMatch(/dark:hover:bg-/);
      expect(logsPageContent).toMatch(/dark:bg-gray-/);
    });

    it("should support pagination controls", () => {
      expect(logsPageContent).toMatch(/offset/);
      expect(logsPageContent).toMatch(/Next|Prev/);
    });
  });
});
