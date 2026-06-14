import { describe, it, expect } from "vitest";
import { parseGoogleContact } from "../src/app/(authed)/(dashboard)/orgs/[orgId]/services/crm/_components/parse-google-contact";

describe("parseGoogleContact", () => {
  it("returns all-null when payload is missing", () => {
    expect(parseGoogleContact({ id: "x" })).toEqual({
      displayName: null,
      primaryEmail: null,
      primaryPhone: null,
      organizationName: null,
      organizationTitle: null,
    });
  });

  it("extracts displayName from names[0].displayName", () => {
    const row = {
      payload: { names: [{ displayName: "Alice Smith" }] },
    };
    expect(parseGoogleContact(row).displayName).toBe("Alice Smith");
  });

  it("prefers primary name over first when metadata.primary is true", () => {
    const row = {
      payload: {
        names: [
          { displayName: "First Listed" },
          { displayName: "Primary One", metadata: { primary: true } },
        ],
      },
    };
    expect(parseGoogleContact(row).displayName).toBe("Primary One");
  });

  it("returns primary email and phone", () => {
    const row = {
      payload: {
        emailAddresses: [{ value: "a@b.c" }, { value: "p@b.c", metadata: { primary: true } }],
        phoneNumbers: [{ value: "+111" }, { value: "+222", metadata: { primary: true } }],
      },
    };
    const parsed = parseGoogleContact(row);
    expect(parsed.primaryEmail).toBe("p@b.c");
    expect(parsed.primaryPhone).toBe("+222");
  });

  it("returns organizationName + title", () => {
    const row = {
      payload: {
        organizations: [{ name: "Acme Inc", title: "Director", department: "Sales" }],
      },
    };
    const parsed = parseGoogleContact(row);
    expect(parsed.organizationName).toBe("Acme Inc");
    expect(parsed.organizationTitle).toBe("Director");
  });

  it("organizationName is null when organizations array is empty", () => {
    const row = { payload: { organizations: [] } };
    expect(parseGoogleContact(row).organizationName).toBeNull();
  });
});
