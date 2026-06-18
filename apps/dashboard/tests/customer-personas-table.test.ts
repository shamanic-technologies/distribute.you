import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Audiences table", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/components/personas/customer-personas-page.tsx"),
    "utf-8",
  );
  const cardSrc = fs.readFileSync(
    path.join(__dirname, "../src/components/personas/persona-card.tsx"),
    "utf-8",
  );

  it("renders personas with real-metric columns and placeholders", () => {
    expect(src).toContain("<table");
    for (const header of ["Clicks", "Cost per click", "Signups", "Cost per signup"]) {
      expect(src).toContain(header);
    }
    expect(src).toContain('persona.status === "paused"');
    expect(src).toContain("Paused");
    expect(src).toContain('text-gray-500">-</td>');
    expect(src).not.toContain("personaMockCost");
    for (const header of ["Targeting filters", "Expected revenue"]) {
      expect(src).not.toContain(header);
    }
    expect(src).not.toContain("statusPill");
    expect(src).not.toContain("pill.label");
    expect(src).not.toContain('font-medium">Filters');
    expect(src).not.toContain("grid grid-cols-1 lg:grid-cols-2 gap-5");
  });

  it("opens the existing persona card in a right-hand detail panel", () => {
    expect(src).toContain("selectedPersonaId");
    expect(src).toContain("setSelectedPersonaId(persona.id)");
    expect(src).toContain("function PersonaDetailPanel");
    expect(src).toContain('role="dialog"');
    expect(src).toContain("<PersonaCard");
    expect(src).toContain("statusActionPending");
    expect(src).toContain("statusActionTarget");
  });

  it("shows loaders on sidebar lifecycle actions while status updates", () => {
    expect(cardSrc).toContain("function StatusActionSpinner");
    expect(cardSrc).toContain('statusActionTarget === "paused"');
    expect(cardSrc).toContain('statusActionTarget === "archived"');
    expect(cardSrc).toContain("disabled={statusActionPending}");
    expect(cardSrc).toContain("Pausing");
  });
});
