import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Workflow proxy route configuration", () => {
  const serviceClientPath = path.join(__dirname, "../../src/lib/service-client.ts");
  const serviceClientContent = fs.readFileSync(serviceClientPath, "utf-8");

  it("should have windmill in externalServices", () => {
    expect(serviceClientContent).toContain("windmill:");
    expect(serviceClientContent).toContain("WINDMILL_SERVICE_URL");
    expect(serviceClientContent).toContain("WINDMILL_SERVICE_API_KEY");
  });

  it("should use windmill.mcpfactory.org as default URL", () => {
    expect(serviceClientContent).toContain("windmill.mcpfactory.org");
  });
});

describe("Workflow proxy routes", () => {
  const routePath = path.join(__dirname, "../../src/routes/workflows.ts");
  const content = fs.readFileSync(routePath, "utf-8");

  it("should use authenticate and requireOrg middleware", () => {
    expect(content).toContain("authenticate");
    expect(content).toContain("requireOrg");
  });

  it("should proxy GET /workflows with orgId", () => {
    expect(content).toContain('"/workflows"');
    expect(content).toContain("req.orgId");
    expect(content).toContain("externalServices.windmill");
  });

  it("should proxy GET /workflows/:id", () => {
    expect(content).toContain('"/workflows/:id"');
    expect(content).toContain("req.params.id");
  });

  it("should default appId to mcpfactory", () => {
    expect(content).toContain("mcpfactory");
  });
});

describe("Workflow routes are mounted in index.ts", () => {
  const indexPath = path.join(__dirname, "../../src/index.ts");
  const content = fs.readFileSync(indexPath, "utf-8");

  it("should import and mount workflows routes", () => {
    expect(content).toContain("workflowsRoutes");
    expect(content).toContain("./routes/workflows");
  });
});
