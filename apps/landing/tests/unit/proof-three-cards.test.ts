import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { renderProofSelection } from "../../src/lib/showcase-cards";
import { reseedProofCards, type ShowcaseBrand } from "../../src/lib/showcase-outcomes";

const APP = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(APP, p), "utf8");

const brand = (domain: string, name: string, meetings: number, replies: number): ShowcaseBrand => ({
  brand: { id: domain, name, domain },
  outcomes: [
    { key: "contacted", label: "Contacted", peopleReached: 1000, costPerReachUsd: 0.2 },
    { key: "conversation", label: "Positive reply", peopleReached: replies, costPerReachUsd: 40 },
    { key: "meeting_booked", label: "Meeting booked", peopleReached: meetings, costPerReachUsd: null },
  ],
  measured: true,
  unmeasuredReason: null,
} as unknown as ShowcaseBrand);

const PICK = [brand("docdinners.com", "Doc Dinners", 173, 38), brand("legistai.com", "Legistai", 14, 1), brand("shockwavecenters.com", "Shockwave Centers", 5, 10)];

describe("the proof section always shows three clients (owner 2026-11-19)", () => {
  // The lab home (`prototypes/distry`) no longer ships proof cards: price cards stand there (owner 2026-11-25, `lab-outcome-ranges.test.ts`).
  for (const page of ["public/landing/index-v2.html"]) {
    it(`${page}: the three picked clients, in the pick's order, faces kept where the page ships one`, () => {
      const out = renderProofSelection(read(page), PICK);
      const order = [...out.matchAll(/data-proof-brand="([^"]+)"/g)].map((m) => m[1]);
      expect(order).toEqual(["docdinners.com", "legistai.com", "shockwavecenters.com"]);
      expect(out).toContain("ryan-parenti.jpg");
      expect(out).toContain("david-tucker.jpg");
      const legistai = out.match(/<article class="proof-card[^"]*" data-proof-brand="legistai.com"[\s\S]*?<\/article>/)![0];
      expect(legistai).toContain("img.logo.dev/legistai.com");
      expect(legistai).toContain("Legistai");
      expect(legistai).not.toContain("Ryan");
      // The built card closes every div it opens (an extra </div> ended the card early on prod 2026-11-20).
      expect((legistai.match(/<div\b/g) ?? []).length).toBe((legistai.match(/<\/div>/g) ?? []).length);
      const filled = reseedProofCards(out, { brands: PICK, measured: true, unmeasuredReason: null } as never);
      const legistaiFilled = filled.match(/data-proof-brand="legistai.com"[\s\S]*?<\/article>/)![0];
      expect(legistaiFilled).toContain("<b>14</b>meetings booked");
      expect(legistaiFilled).toContain("<b>1</b>positive replies");
    });
  }

  it("keeps the shipped cards when the pick cannot fill three", () => {
    const html = read("public/landing/index-v2.html");
    expect(renderProofSelection(html, PICK.slice(0, 2))).toBe(html);
  });
});
