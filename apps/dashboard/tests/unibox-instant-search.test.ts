import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { instantMatch, instantPeople } from "../src/lib/unibox-instant-search";
import type { Person } from "../src/lib/people-conversations";

const person = (key: string, over: Partial<Person> = {}): Person =>
  ({
    personKey: key,
    identityKeys: [],
    displayName: null,
    company: null,
    emails: [],
    phones: [],
    sources: [],
    firstActivityAt: null,
    lastActivityAt: null,
    state: "open",
    stateSource: "crm",
    presences: [],
    ...over,
  }) as Person;

describe("Unibox instant search", () => {
  const marie = person("a", { displayName: "Marie Lefèvre", company: "Acme", emails: ["marie@acme.io"] });
  const paul = person("b", { displayName: "Paul Martin", emails: ["paul@globex.com"] });

  it("matches on the first letters, accents and case ignored", () => {
    expect(instantMatch(marie, "ma")).toBe(true);
    expect(instantMatch(marie, "LEFEV")).toBe(true);
    expect(instantMatch(marie, "acme")).toBe(true);
    expect(instantMatch(paul, "lefev")).toBe(false);
  });

  it("needs every typed word", () => {
    expect(instantMatch(paul, "paul glob")).toBe(true);
    expect(instantMatch(paul, "paul acme")).toBe(false);
  });

  it("reads the served match lines too", () => {
    const p = person("c", { matches: [{ field: "message", excerpt: "about the pricing deck" }] });
    expect(instantMatch(p, "pricing")).toBe(true);
  });

  it("keeps the on-screen order and one row per person across pools", () => {
    const out = instantPeople([[paul, marie], [marie, person("d", { displayName: "Maxime" })]], "ma");
    expect(out.map((p) => p.personKey)).toEqual(["b", "a", "d"]);
  });

  it("is wired into the Unibox list with the previous answer kept on screen", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/integrations-conversations.tsx"), "utf8");
    expect(src).toContain("prevQuery?.queryKey[4] === family && (prevQuery?.queryKey[5] ?? null) === relationship ? prev : undefined");
    expect(src).toContain("instantPeople([served,");
    expect(src).toContain("const SEARCH_DEBOUNCE_MS = 150;");
  });
});
