import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Platform chat system prompt — scope enforcement", () => {
  const instrumentationPath = path.join(
    __dirname,
    "../src/instrumentation.ts"
  );

  const content = fs.readFileSync(instrumentationPath, "utf-8");

  it("should have a SCOPE ENFORCEMENT section in the system prompt", () => {
    expect(content).toContain("SCOPE ENFORCEMENT");
  });

  it("should prohibit modifying other workflows", () => {
    expect(content).toContain("NEVER modify or delete any workflow other than");
  });

  it("should encourage reading other workflows for reference", () => {
    expect(content).toContain("CAN and SHOULD read other workflows for reference");
  });

  it("should describe editing scope violation as a critical error", () => {
    expect(content).toContain("critical error");
    expect(content).toContain("Reading other workflows is not a violation");
  });
});
