import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Customer personas table", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/components/personas/customer-personas-page.tsx"),
    "utf-8",
  );

  it("renders personas without fake performance metrics", () => {
    expect(src).toContain("<table");
    expect(src).toContain("Targeting filters");
    expect(src).not.toContain("personaMockCost");
    for (const header of ["Clicks", "Cost per click", "Signups", "Cost per signup", "Expected revenue"]) {
      expect(src).not.toContain(header);
    }
    expect(src).not.toContain('font-medium">Filters');
    expect(src).not.toContain("grid grid-cols-1 lg:grid-cols-2 gap-5");
  });

  it("opens the existing persona card in a right-hand detail panel", () => {
    expect(src).toContain("selectedPersonaId");
    expect(src).toContain("setSelectedPersonaId(persona.id)");
    expect(src).toContain("function PersonaDetailPanel");
    expect(src).toContain('role="dialog"');
    expect(src).toContain("<PersonaCard");
  });
});
