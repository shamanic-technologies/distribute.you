import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const page = read("src/components/v2/crew-page.tsx");

describe("crew card Create a campaign", () => {
  const card = page.slice(page.indexOf("function CrewCard("), page.indexOf("/** How long one run took"));

  it("every card carries a full-width Create a campaign button, with or without missions", () => {
    expect(card.match(/\+ Create a campaign/g)?.length).toBe(2);
    expect(card.match(/k-btn h-8 w-full justify-center/g)?.length).toBe(2);
  });

  it("asks the Copilot to create a sales funnel campaign (owner 2026-10-10), never a per-pipe mission with its own budget", () => {
    expect(page).toContain("copilot.ask(CREATE_CAMPAIGN_ASK)");
    expect(page).not.toContain("AddMissionModal");
    expect(existsSync(resolve(__dirname, "../src/components/v2/add-mission-modal.tsx"))).toBe(false);
  });
});
