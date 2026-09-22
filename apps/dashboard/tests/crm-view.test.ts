import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  contactCompanyName,
  contactDisplayName,
  contactIdentity,
  contactPlace,
  contactTags,
  filterContacts,
  formatAmount,
  type CrmContact,
} from "../src/lib/crm-view";
import { INTEGRATIONS, integrationFor, missingFields } from "../src/lib/integrations";
import {
  connectErrorMessage,
  credentialErrorMessage,
  disconnectErrorMessage,
} from "../src/lib/integration-write";

const SRC = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const person = (o: Partial<CrmContact> & Pick<CrmContact, "id">): CrmContact => ({
  externalId: "ext",
  primaryEmail: null,
  phoneE164: null,
  fullName: null,
  firstName: null,
  lastName: null,
  unsubscribed: false,
  lastRebuiltAt: null,
  company: { name: null, website: null },
  location: {
    city: null,
    stateRegion: null,
    country: null,
    postalCode: null,
    streetAddress: null,
  },
  record: {
    type: null,
    leadSource: null,
    tags: null,
    createdAt: null,
    updatedAt: null,
    origin: { medium: null, url: null, referrer: null },
  },
  ...o,
});

/** An ApiError as `apiCall` throws it: a status plus the whole upstream body. */
const apiErr = (status: number, body: Record<string, unknown> = {}) => ({ status, body });

describe("contactIdentity", () => {
  it("prefers the served full name, then the halves, then email, then phone", () => {
    expect(contactIdentity(person({ id: "1", fullName: "Ada Lovelace", primaryEmail: "a@b.c" })).label).toBe("Ada Lovelace");
    expect(contactIdentity(person({ id: "1", firstName: "Ada", lastName: "Lovelace" })).label).toBe("Ada Lovelace");
    expect(contactIdentity(person({ id: "1", primaryEmail: "a@b.c", phoneE164: "+1" })).label).toBe("a@b.c");
    expect(contactIdentity(person({ id: "1", phoneE164: "+33612345678" })).label).toBe("+33612345678");
  });

  it("reports WHICH field named the person, so no row repeats it", () => {
    expect(contactIdentity(person({ id: "1", fullName: "Ada" })).source).toBe("name");
    expect(contactIdentity(person({ id: "1", primaryEmail: "a@b.c" })).source).toBe("email");
    expect(contactIdentity(person({ id: "1", phoneE164: "+1" })).source).toBe("phone");
    expect(contactIdentity(person({ id: "1" })).source).toBe("none");
  });

  it("says a row is unnamed rather than inventing a label or printing an id", () => {
    const blank = contactIdentity(person({ id: "9f8e7d6c-1111-2222-3333-444455556666", fullName: "  " }));
    expect(blank.label).toBe("No name");
    expect(blank.label).not.toMatch(/[0-9a-f]{8}-/);
  });

  it("agrees with the label-only helper, which reads it", () => {
    const c = person({ id: "1", phoneE164: "+33612345678" });
    expect(contactDisplayName(c)).toBe(contactIdentity(c).label);
  });
});

describe("formatAmount", () => {
  it("writes the amount their system reported, grouped", () => {
    expect(formatAmount("1850")).toBe("1,850");
    expect(formatAmount("1850.00")).toBe("1,850");
    expect(formatAmount("0")).toBe("0");
  });

  it("states NO currency symbol, because no currency is mirrored", () => {
    // GoHighLevel reports a whole-currency amount and crm-service stores it with
    // no currency code anywhere. A "$" here would state a currency nobody
    // reported, on money that is very often not dollars.
    for (const v of ["1850", "0", "999999.99"]) {
      const out = formatAmount(v)!;
      expect(out).not.toMatch(/[$€£¥]/);
    }
  });

  it("states nothing for a deal their system priced at nothing", () => {
    expect(formatAmount(null)).toBeNull();
    expect(formatAmount("")).toBeNull();
    expect(formatAmount("   ")).toBeNull();
  });

  it("states nothing rather than guessing at a value that does not parse", () => {
    expect(formatAmount("not-a-number")).toBeNull();
  });
});

describe("filterContacts", () => {
  const rows = [
    person({ id: "1", fullName: "Ada Lovelace", primaryEmail: "ada@calc.io" }),
    person({ id: "2", lastName: "Hopper", phoneE164: "+33612345678" }),
    person({ id: "3" }),
  ];

  it("matches across every field their CRM filled in", () => {
    expect(filterContacts(rows, "ada").map((c) => c.id)).toEqual(["1"]);
    expect(filterContacts(rows, "CALC").map((c) => c.id)).toEqual(["1"]);
    expect(filterContacts(rows, "hopper").map((c) => c.id)).toEqual(["2"]);
    expect(filterContacts(rows, "33612").map((c) => c.id)).toEqual(["2"]);
  });

  it("survives a row their CRM left entirely empty", () => {
    // Every field is nullable on the wire, so an uncoalesced `toLowerCase` here
    // takes the whole page down on the first keystroke.
    expect(() => filterContacts(rows, "x")).not.toThrow();
    expect(filterContacts(rows, "x")).toEqual([]);
  });

  it("returns everything for a blank query", () => {
    expect(filterContacts(rows, "   ")).toHaveLength(3);
  });
});

describe("what their CRM holds about the company and the record", () => {
  const acme = person({
    id: "1",
    fullName: "Ada Lovelace",
    company: { name: "  Acme Plumbing  ", website: "https://acme.example" },
    location: {
      city: "Denver",
      stateRegion: "CO",
      country: "US",
      postalCode: "80202",
      streetAddress: "1 Main St",
    },
    record: {
      type: "lead",
      leadSource: "Facebook Ad",
      tags: ["  vip ", "", "cold"],
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: null,
      origin: { medium: "paid", url: "https://acme.example/lp", referrer: null },
    },
  });

  it("states the company their CRM attached the person to", () => {
    expect(contactCompanyName(acme)).toBe("Acme Plumbing");
  });

  it("says nothing rather than blank when their CRM holds no company", () => {
    // Absent is a fact about their CRM, never a defaulted value of ours.
    expect(contactCompanyName(person({ id: "2" }))).toBeNull();
    expect(contactCompanyName(person({ id: "3", company: { name: "   ", website: null } }))).toBeNull();
  });

  it("writes the place from the parts that exist, inventing none", () => {
    expect(contactPlace(acme)).toBe("Denver, CO, US");
    expect(
      contactPlace(
        person({
          id: "4",
          location: {
            city: null,
            stateRegion: null,
            country: "US",
            postalCode: null,
            streetAddress: null,
          },
        }),
      ),
    ).toBe("US");
    expect(contactPlace(person({ id: "5" }))).toBeNull();
  });

  it("keeps the customer's own tags, drops the blank ones, and reads null as none", () => {
    expect(contactTags(acme)).toEqual(["vip", "cold"]);
    expect(contactTags(person({ id: "6" }))).toEqual([]);
  });

  it("maps no free-text value onto a vocabulary of ours", () => {
    // Their stage and lead-source words are arbitrary per customer ("Free Trail
    // Client", "BOOKED - NO BUY"). Serve what they say; the meaning is decided
    // elsewhere. A map here would be this page inventing one.
    const view = read("lib/crm-view.ts");
    expect(view).not.toMatch(/LEAD_SOURCE_LABEL|STAGE_LABEL|normalizeLeadSource|TYPE_LABEL/);
  });
});

describe("the contacts table can be matched on company and opened on one person", () => {
  const rows = [
    person({ id: "1", fullName: "Ada Lovelace", company: { name: "Acme Plumbing", website: null } }),
    person({
      id: "2",
      fullName: "Grace Hopper",
      location: {
        city: "Denver",
        stateRegion: null,
        country: null,
        postalCode: null,
        streetAddress: null,
      },
      record: {
        type: null,
        leadSource: "Facebook Ad",
        tags: ["vip"],
        createdAt: null,
        updatedAt: null,
        origin: { medium: null, url: null, referrer: null },
      },
    }),
  ];

  it("searches the company, the place and their own words too", () => {
    // 454 of the 455 contacts carrying a company carry NO email, so a search
    // that only reads identity cannot find most of the people who have one.
    expect(filterContacts(rows, "acme").map((c) => c.id)).toEqual(["1"]);
    expect(filterContacts(rows, "denver").map((c) => c.id)).toEqual(["2"]);
    expect(filterContacts(rows, "facebook").map((c) => c.id)).toEqual(["2"]);
    expect(filterContacts(rows, "vip").map((c) => c.id)).toEqual(["2"]);
  });

  it("carries a Company column, because a reader scans the list on it", () => {
    const src = read("components/crm/crm-contacts-table.tsx");
    expect(src).toContain(">Company<");
    expect(src).toContain("contactCompanyName");
  });

  it("opens one person's detail from the row, by mouse and by keyboard", () => {
    const src = read("components/crm/crm-contacts-table.tsx");
    expect(src).toContain("CrmContactDetail");
    expect(src).toContain("aria-expanded");
    expect(src).toContain('e.key === "Enter"');
  });

  it("still writes nothing back to their CRM", () => {
    // There is no write path between here and their system, and opening a row
    // must not be read as licence to build one.
    const table = read("components/crm/crm-contacts-table.tsx");
    const detail = read("components/crm/crm-contact-detail.tsx");
    expect(table).not.toMatch(/useMutation|apiCall|fetch\(/);
    expect(detail).not.toMatch(/useMutation|apiCall|fetch\(/);
  });

  it("renders a link only for http(s), never for whatever scheme their CRM stored", () => {
    // The website and the origin URL are somebody else's data landing in an
    // anchor; any other scheme there is that data deciding what a click does.
    expect(read("components/crm/crm-contact-detail.tsx")).toContain("^https?:\\/\\/");
  });
});

describe("the page renders the producer's grouping and re-derives none of it", () => {
  it("carries no grouping, counting or summing of its own", () => {
    // crm-service serves the pipeline already grouped, with the per-stage and
    // per-pipeline count and total computed there. An earlier cut regrouped a
    // flat list here, which duplicated the producer.
    const view = read("lib/crm-view.ts");
    expect(view).not.toContain("groupOpportunitiesByPipeline");
    expect(view).not.toMatch(/\.reduce\(/);
    expect(view).not.toMatch(/roi|cpa|cac|costPer|Pct\b/i);

    const board = read("components/crm/crm-pipeline-board.tsx");
    expect(board).not.toMatch(/\.reduce\(/);
    // The count beside a stage is the served one, never the cards on screen.
    expect(board).toContain("{stage.count}");
    expect(board).not.toContain("{stage.opportunities.length}<");
  });

  it("shows the deals their system left out of a pipeline, so the counts add up", () => {
    expect(read("components/crm/crm-pipeline-board.tsx")).toContain("view.ungrouped");
  });

  it("never offers to move a card — there is no write path to their CRM", () => {
    const board = read("components/crm/crm-pipeline-board.tsx");
    expect(board).not.toMatch(/draggable|onDrop|useBoardDrag|pointerdown/i);
  });
});

describe("the contacts table states one value once", () => {
  it("suppresses the folded phone when the phone is what named the person", () => {
    // Looking at the render is what caught this: a contact holding only a phone
    // was named by it AND had it printed again on the line below.
    expect(read("components/crm/crm-contacts-table.tsx")).toContain('who.source !== "phone"');
  });

  it("keeps the customer's tags out of the row and inside the opened detail", () => {
    // Their CRM DOES serve tags now (crm-service #21) — this guard used to say
    // it served none, which stopped being true. Tags are free text per customer
    // and there are up to a dozen of them, so a column would crush the row: they
    // belong in the detail a reader opens on one person.
    expect(read("components/crm/crm-contacts-table.tsx")).not.toContain(">Tags<");
    expect(read("components/crm/crm-contact-detail.tsx")).toContain("Tags");
  });
});

describe("the integrations catalogue", () => {
  it("carries GoHighLevel, with a real logo key rather than a hand-rolled mark", () => {
    const ghl = integrationFor("gohighlevel");
    expect(ghl).not.toBeNull();
    expect(ghl!.domain).toBe("gohighlevel.com");
    expect(ghl!.name).toBe("GoHighLevel");
  });

  it("uses the slug crm-service resolves the credential under", () => {
    // crm-service reads the credential from key-service under GHL_PROVIDER =
    // "gohighlevel". If this drifts, the key is stored where nothing looks.
    expect(integrationFor("gohighlevel")!.slug).toBe("gohighlevel");
  });

  it("answers null for a slug it does not carry, never a guessed definition", () => {
    expect(integrationFor("salesforce")).toBeNull();
    expect(integrationFor("")).toBeNull();
  });

  it("asks for the token and the sub-account, and marks only the token secret", () => {
    const ghl = integrationFor("gohighlevel")!;
    expect(ghl.fields.map((f) => f.key)).toEqual(["token", "locationId"]);
    expect(ghl.fields.filter((f) => f.secret).map((f) => f.key)).toEqual(["token"]);
  });

  it("tells the customer where each field lives in their own account", () => {
    for (const f of integrationFor("gohighlevel")!.fields) {
      expect(f.help.length).toBeGreaterThan(20);
      expect(f.label.length).toBeGreaterThan(0);
    }
  });

  it("names every field uniquely, per integration", () => {
    for (const def of INTEGRATIONS) {
      const keys = def.fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("missingFields", () => {
  const ghl = integrationFor("gohighlevel")!;

  it("reports what is still blank, in catalogue order", () => {
    expect(missingFields(ghl, {}).map((f) => f.key)).toEqual(["token", "locationId"]);
    expect(missingFields(ghl, { token: "pit-x" }).map((f) => f.key)).toEqual(["locationId"]);
    expect(missingFields(ghl, { token: "pit-x", locationId: "abc" })).toEqual([]);
  });

  it("treats whitespace as blank", () => {
    expect(missingFields(ghl, { token: "   ", locationId: "abc" }).map((f) => f.key)).toEqual(["token"]);
  });

  it("forgives a blank SECRET on a retry, because the credential is already stored", () => {
    // The customer's token is in key-service and the producer resolves it there
    // itself, so a blank field means "keep it" rather than an unanswered
    // question. Without this the only way back into a half-finished connection
    // is to fetch a token the vendor shows exactly once.
    expect(missingFields(ghl, { locationId: "abc" }, { credentialStored: true })).toEqual([]);
    expect(missingFields(ghl, { token: "   ", locationId: "abc" }, { credentialStored: true })).toEqual([]);
  });

  it("still asks for every NON-secret field on a retry", () => {
    // A sub-account id is not a credential: nothing stores it until the connect
    // succeeds, so there is nothing to keep and it is stated every time.
    expect(
      missingFields(ghl, { token: "pit-x" }, { credentialStored: true }).map((f) => f.key),
    ).toEqual(["locationId"]);
  });

  it("asks for the secret when NOTHING is stored, whatever the flag defaults to", () => {
    expect(missingFields(ghl, { locationId: "abc" }).map((f) => f.key)).toEqual(["token"]);
    expect(
      missingFields(ghl, { locationId: "abc" }, { credentialStored: false }).map((f) => f.key),
    ).toEqual(["token"]);
  });

  it("checks SHAPE only — whether a token authenticates is the producer's answer", () => {
    // Guessing at a vendor's token shape here refuses a valid credential the day
    // they change the prefix. crm-service asks GoHighLevel instead.
    expect(missingFields(ghl, { token: "anything-at-all", locationId: "x" })).toEqual([]);
    const src = read("lib/integrations.ts");
    expect(src).not.toMatch(/startsWith\(\s*["']pit/i);
    expect(src).not.toMatch(/\/\^pit/i);
  });
});

describe("a refused connect tells the customer which field to fix", () => {
  it("passes the vendor's own reason through, in full", () => {
    // Only GoHighLevel knows why it refused. Replacing this with a generic line
    // throws away the one thing that says whether the token or the sub-account
    // id is wrong.
    const vendor = "GoHighLevel refused the credential: This location does not exist";
    expect(connectErrorMessage(apiErr(400, { type: "vendor", error: vendor }))).toBe(vendor);
  });

  it("never renders the raw error message, which is the whole upstream body", () => {
    const src = read("lib/integration-write.ts");
    expect(src).not.toMatch(/err\s*\.\s*message/);
  });

  it("says something useful when the producer wrote nothing for a person", () => {
    expect(connectErrorMessage(apiErr(502))).toContain("could not reach");
    expect(connectErrorMessage(apiErr(404))).toContain("no longer exists");
    expect(connectErrorMessage(apiErr(403))).toContain("do not have access");
    expect(connectErrorMessage(new Error("boom"))).toBe("Could not connect your CRM. Try again.");
  });

  it("keeps the credential failure apart from the connection failure", () => {
    // They are two writes, and the customer needs to know which one refused.
    expect(credentialErrorMessage(apiErr(403))).toContain("do not have access");
    expect(credentialErrorMessage(new Error("boom"))).toBe("Could not save your credential. Try again.");
  });

  it("treats an already-gone connection as the state that was asked for", () => {
    expect(disconnectErrorMessage(apiErr(404))).toBe("");
    expect(disconnectErrorMessage(new Error("boom"))).toBe("Could not disconnect. Try again.");
  });

  it("truncates a runaway upstream string rather than pasting it whole", () => {
    const huge = "x".repeat(5000);
    expect(connectErrorMessage(apiErr(400, { error: huge })).length).toBeLessThanOrEqual(400);
  });
});

describe("the modules stay unit-testable", () => {
  it("imports no alias, so these stay REAL unit tests", () => {
    for (const rel of ["lib/crm-view.ts", "lib/integrations.ts", "lib/integration-write.ts"]) {
      expect(read(rel)).not.toMatch(/from\s+["']@\//);
    }
  });
});
