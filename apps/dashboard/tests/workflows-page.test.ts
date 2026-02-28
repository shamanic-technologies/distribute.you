import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Workflows page", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/workflows/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should import listWorkflows from api", () => {
    expect(content).toContain("listWorkflows");
    expect(content).toContain("@/lib/api");
  });

  it("should render WorkflowCard components", () => {
    expect(content).toContain("WorkflowCard");
  });

  it("should render WorkflowDetailPanel when a workflow is selected", () => {
    expect(content).toContain("WorkflowDetailPanel");
    expect(content).toContain("selectedWorkflowId");
  });

  it("should show empty state when no workflows", () => {
    expect(content).toContain("No workflows yet");
  });
});

describe("Features sidebar links (replaces Workflows)", () => {
  const sidebarPath = path.join(
    __dirname,
    "../src/components/context-sidebar.tsx"
  );
  const content = fs.readFileSync(sidebarPath, "utf-8");

  it("should have feature links instead of Workflows link", () => {
    expect(content).toContain("/features/");
    expect(content).not.toContain('href: "/workflows"');
  });
});

describe("Dashboard does not call workflow-service directly", () => {
  it("should not hardcode windmill.distribute.you in dashboard source", () => {
    const srcDir = path.join(__dirname, "../src");
    const files = walkDir(srcDir);
    for (const file of files) {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) continue;
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain("windmill.distribute.you");
    }
  });
});

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}
