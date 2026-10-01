import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Dashboard mobile responsiveness", () => {
  // The company mark lives in its own module so a card and a row cannot disagree
  // about a company.
  const companyLogo = fs.readFileSync(
    path.join(__dirname, "../src/components/company-logo.tsx"),
    "utf-8",
  );

  it("sizes the company mark by style, since a class cannot be built from a prop", () => {
    const at = companyLogo.indexOf("function CompanyLogo(");
    expect(at).toBeGreaterThan(-1);
    const logo = companyLogo.slice(at, at + 1200);
    expect(logo).toContain("size = 24");
    expect(logo).toContain("style={box}");
    // Twice the rendered size so the mark stays crisp on a retina screen.
    expect(logo).toContain("size=${size * 2}");
    // The sibling name truncates, so the mark must not be allowed to shrink.
    expect(logo).toContain("shrink-0 rounded");
    expect(logo).not.toContain("w-6 h-6");
  });
});
