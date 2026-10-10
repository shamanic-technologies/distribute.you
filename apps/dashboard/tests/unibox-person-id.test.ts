import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PersonSchema, personRef, personRefQuery } from "../src/lib/people-conversations";
import { timelineTag } from "../src/lib/timeline-tags";

/**
 * Owner 2026-10-10: the Unibox URL named each person by their email or phone, which then
 * spread into analytics, history and shared links. crm-service v0.26.0 serves an opaque,
 * rebuild-stable `personId` and reads a thread by it.
 */
describe("the Unibox names a person by crm-service's opaque id", () => {
  const id = "0b9c3c3e-6c1f-4b8e-9a51-2f1f6b7d9e10";

  it("the URL value is the personId, the identity key only while a row has none yet", () => {
    expect(personRef({ personId: id, personKey: "email:a@b.co" })).toBe(id);
    expect(personRef({ personId: null, personKey: "email:a@b.co" })).toBe("email:a@b.co");
  });

  it("the thread read asks by personId for an id, by personKey for a key (old shared links)", () => {
    expect(personRefQuery(id)).toEqual({ personId: id });
    expect(personRefQuery("email:a@b.co")).toEqual({ personKey: "email:a@b.co" });
    expect(personRefQuery("phone:+12014713892")).toEqual({ personKey: "phone:+12014713892" });
  });

  it("parses a person with and without the new field", () => {
    const base = {
      personKey: "phone:+12014713892", identityKeys: [], displayName: null, company: null, emails: [], phones: [],
      sources: [], firstActivityAt: null, lastActivityAt: null, state: "x", stateSource: "none", presences: [],
    };
    expect(PersonSchema.parse({ ...base, personId: id }).personId).toBe(id);
    expect(PersonSchema.parse(base).personId).toBeUndefined();
  });

  it("the page writes personRef into the URL and reads threads by it", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/integrations-conversations.tsx"), "utf8");
    expect(src).toContain('setParam("person", personRef(p))');
    expect(src).not.toContain('setParam("person", p.personKey)');
    expect(src).not.toMatch(/getPersonTimeline\(brandId, [a-z]+\.personKey\)/);
  });

  it("the entry events crm-service adds read in words", () => {
    const ev = (step: string) => timelineTag({ kind: "event", direction: null, event: { step } }).label;
    expect(ev("added_to_crm")).toBe("Added to CRM");
    expect(ev("signup")).toBe("Signed up");
    expect(ev("became_customer")).toBe("Became a customer");
  });
});
