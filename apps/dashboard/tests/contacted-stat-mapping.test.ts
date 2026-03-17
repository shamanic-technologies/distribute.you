import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Contacted stat uses emailsContacted (not emailsSent)", () => {
  describe("CampaignStats type in api.ts", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/lib/api.ts"),
      "utf-8"
    );

    it("should have emailsContacted field", () => {
      expect(content).toContain("emailsContacted: number");
    });
  });

  describe("BrandDeliveryStats type in api.ts", () => {
    const content = fs.readFileSync(
      path.join(__dirname, "../src/lib/api.ts"),
      "utf-8"
    );

    it("should have emailsContacted field", () => {
      expect(content).toContain("emailsContacted: number");
    });
  });

  describe("Campaign detail page", () => {
    const content = fs.readFileSync(
      path.join(
        __dirname,
        "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/campaigns/[id]/page.tsx"
      ),
      "utf-8"
    );

    it("should pass stats.emailsContacted to FunnelMetrics", () => {
      expect(content).toContain("emailsContacted={stats.emailsContacted");
    });

    it("should NOT use emailsSent for the contacted prop", () => {
      expect(content).not.toContain("emailsContacted={stats.emailsSent");
    });
  });

  describe("Feature section page", () => {
    const content = fs.readFileSync(
      path.join(
        __dirname,
        "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/page.tsx"
      ),
      "utf-8"
    );

    it("should use brandDelivery.emailsContacted for the contacted total", () => {
      expect(content).toContain("brandDelivery?.emailsContacted");
    });

    it("should NOT use brandDelivery.emailsSent for the contacted total", () => {
      expect(content).not.toMatch(/emailsContacted:\s*brandDelivery\?\.emailsSent/);
    });

    it("should display emailsContacted in campaign cards", () => {
      expect(content).toContain("emailsContacted || 0} contacted");
    });
  });
});
