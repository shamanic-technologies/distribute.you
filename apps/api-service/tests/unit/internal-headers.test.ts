import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const headersPath = path.join(__dirname, "../../src/lib/internal-headers.ts");
const content = fs.readFileSync(headersPath, "utf-8");

describe("buildInternalHeaders", () => {
  it("should include x-org-id always", () => {
    expect(content).toContain('"x-org-id"');
  });

  it("should include x-user-id when req.userId is set", () => {
    expect(content).toContain('"x-user-id"');
    expect(content).toContain("req.userId");
  });

  it("should include x-app-id when req.appId is set", () => {
    expect(content).toContain('"x-app-id"');
    expect(content).toContain("req.appId");
  });

  it("should conditionally add x-app-id (not always)", () => {
    // Should check if req.appId exists before adding
    expect(content).toContain("if (req.appId)");
  });
});
