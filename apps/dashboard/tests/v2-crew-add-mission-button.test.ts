import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const page = read("src/components/v2/crew-page.tsx");
const modal = read("src/components/v2/add-mission-modal.tsx");

describe("crew card Add a mission", () => {
  const card = page.slice(page.indexOf("function CrewCard("), page.indexOf("/** How long one run took"));

  it("every card carries a full-width Add a mission button, with or without missions", () => {
    expect(card.match(/\+ Add a mission/g)?.length).toBe(2);
    expect(card.match(/k-btn h-8 w-full justify-center/g)?.length).toBe(2);
  });

  it("opens the modal on the crew that was clicked", () => {
    expect(page).toContain("setAdding(c.crew.key)");
    expect(page).toContain("initialCrewKey={adding}");
  });

  it("the modal shows only that crew until Change crew", () => {
    expect(modal).toContain("initialCrewKey");
    expect(modal).toContain("listedCrews.map(");
    expect(modal).toContain("Change crew");
  });
});
