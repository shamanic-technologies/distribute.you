import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Workflows page should not exist", () => {
  it("should have deleted the workflows page", () => {
    const pagePath = path.join(
      __dirname,
      "../src/app/(dashboard)/workflows/page.tsx"
    );
    expect(fs.existsSync(pagePath)).toBe(false);
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
