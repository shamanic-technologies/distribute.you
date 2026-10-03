import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { SERVICES_DRAFT_FIELD } from "../src/lib/v2/get-started";

// "Services sold" on the offer page (BrandOfferCard) reads the offer's `services`
// user-field. Both launch paths drafted and saved the six levers but never
// `services`, so every offer they created showed it empty (Legistai, 2026-10-03).
const PAGE = readFileSync(resolve(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf-8");
const LAUNCH = readFileSync(resolve(__dirname, "../src/components/v2/get-started/launch.ts"), "utf-8");

function fnBody(src: string, signature: string): string {
  const at = src.indexOf(signature);
  expect(at).toBeGreaterThan(-1);
  const end = src.indexOf("\n  }\n", at);
  return src.slice(at, end > at ? end : undefined);
}

describe("offer services are prefilled on every launch path", () => {
  it("the services draft field is the stored `services` key", () => {
    expect(SERVICES_DRAFT_FIELD.key).toBe("services");
    expect(SERVICES_DRAFT_FIELD.description.length).toBeGreaterThan(20);
  });

  it("/get-started reads services in the offer's draft read and saves them on the offer", () => {
    const body = fnBody(PAGE, "async function draftAnswers(");
    expect(body).toContain("SERVICES_DRAFT_FIELD");
    expect(body).toContain("saveOfferUserFields(id, offerId, { services");
  });

  it("the new-org launch prefill reads and saves services too", () => {
    const at = LAUNCH.indexOf("async function prefillOfferLevers(");
    const body = LAUNCH.slice(at, LAUNCH.indexOf("\n}\n", at));
    expect(body).toContain('"services"');
    expect(body).toContain("fields.services");
  });
});
