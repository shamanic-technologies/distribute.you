import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

describe("BrandLogo component", () => {
  it("should use the correct logo.dev token", () => {
    const componentPath = path.join(
      __dirname,
      "../src/components/brand-logo.tsx"
    );
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain(LOGO_DEV_TOKEN);
    expect(content).toContain("img.logo.dev");
  });
});
