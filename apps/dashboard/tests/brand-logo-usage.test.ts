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

  it("should be used in all brand listing pages instead of a hardcoded icon", () => {
    // The brand root page is now the (sole) feature's Revenue overview — it no
    // longer renders a brand logo/header. The brand-LISTING surface is the org page.
    const brandFiles = [
      path.join(__dirname, "../src/app/(authed)/(dashboard)/orgs/[orgId]/page.tsx"),
    ];

    for (const file of brandFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const relPath = path.relative(path.join(__dirname, ".."), file);
      expect(content, `${relPath} should import BrandLogo`).toContain(
        "BrandLogo"
      );
    }
  });
});
