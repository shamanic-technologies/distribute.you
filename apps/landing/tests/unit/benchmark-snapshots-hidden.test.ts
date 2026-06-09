import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const pagePath = path.resolve(__dirname, "../../src/app/benchmarks/page.tsx");
const pageContent = fs.readFileSync(pagePath, "utf-8");

describe("benchmark snapshots hotfix", () => {
  it("does not render the client trajectories section", () => {
    expect(pageContent).not.toContain("ClientTrajectoriesSection");
    expect(pageContent).not.toContain("client-trajectories-section");
  });
});
