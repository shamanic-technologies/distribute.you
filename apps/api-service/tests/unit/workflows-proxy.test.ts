import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Workflow proxy route configuration", () => {
  const serviceClientPath = path.join(__dirname, "../../src/lib/service-client.ts");
  const serviceClientContent = fs.readFileSync(serviceClientPath, "utf-8");

  it("should have workflow in externalServices", () => {
    expect(serviceClientContent).toContain("workflow:");
    expect(serviceClientContent).toContain("WORKFLOW_SERVICE_URL");
    expect(serviceClientContent).toContain("WORKFLOW_SERVICE_API_KEY");
  });

  it("should use workflow.mcpfactory.org as default URL", () => {
    expect(serviceClientContent).toContain("workflow.mcpfactory.org");
  });
});

describe("Workflow proxy routes", () => {
  const routePath = path.join(__dirname, "../../src/routes/workflows.ts");
  const content = fs.readFileSync(routePath, "utf-8");

  it("should use authenticate and requireOrg middleware", () => {
    expect(content).toContain("authenticate");
    expect(content).toContain("requireOrg");
  });

  it("should proxy GET /workflows with Clerk orgId", () => {
    expect(content).toContain('"/workflows"');
    expect(content).toContain('params.set("orgId", req.orgId!)');
    expect(content).toContain("externalServices.workflow");
  });

  it("should proxy GET /workflows/:id", () => {
    expect(content).toContain('"/workflows/:id"');
    expect(content).toContain("req.params.id");
  });

  it("should proxy GET /workflows/best", () => {
    expect(content).toContain('"/workflows/best"');
    expect(content).toContain("/workflows/best?");
  });

  it("should define /workflows/best before /workflows/:id to avoid param capture", () => {
    const bestIndex = content.indexOf('"/workflows/best"');
    const idIndex = content.indexOf('"/workflows/:id"');
    expect(bestIndex).toBeLessThan(idIndex);
  });

  it("should forward query params on /workflows/best", () => {
    // Extract the best workflow handler block
    const bestStart = content.indexOf('"/workflows/best"');
    const bestEnd = content.indexOf('"/workflows/:id"');
    const bestBlock = content.slice(bestStart, bestEnd);

    expect(bestBlock).toContain("category");
    expect(bestBlock).toContain("channel");
    expect(bestBlock).toContain("audienceType");
    expect(bestBlock).toContain("objective");
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
