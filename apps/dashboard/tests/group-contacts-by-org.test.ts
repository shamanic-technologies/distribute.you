import { describe, it, expect } from "vitest";
import { groupContactsByOrg } from "../src/app/(authed)/(dashboard)/orgs/[orgId]/services/crm/_components/group-contacts-by-org";

describe("groupContactsByOrg", () => {
  it("groups contacts by organizations[0].name", () => {
    const rows = [
      { id: "1", payload: { names: [{ displayName: "Alice" }], organizations: [{ name: "Acme" }] } },
      { id: "2", payload: { names: [{ displayName: "Bob" }], organizations: [{ name: "Acme" }] } },
      { id: "3", payload: { names: [{ displayName: "Carol" }], organizations: [{ name: "Globex" }] } },
    ];
    const groups = groupContactsByOrg(rows);
    const acme = groups.find((g) => g.orgName === "Acme");
    const globex = groups.find((g) => g.orgName === "Globex");
    expect(acme?.contacts.length).toBe(2);
    expect(globex?.contacts.length).toBe(1);
  });

  it("places contacts without org under null bucket", () => {
    const rows = [
      { id: "1", payload: { names: [{ displayName: "Alice" }] } },
      { id: "2", payload: { names: [{ displayName: "Bob" }], organizations: [{ name: "Acme" }] } },
      { id: "3", payload: { names: [{ displayName: "Carol" }], organizations: [] } },
    ];
    const groups = groupContactsByOrg(rows);
    const noOrg = groups.find((g) => g.orgName === null);
    expect(noOrg?.contacts.length).toBe(2);
  });

  it("sorts named orgs alphabetically with null bucket last", () => {
    const rows = [
      { id: "1", payload: { organizations: [{ name: "Zebra" }] } },
      { id: "2", payload: {} },
      { id: "3", payload: { organizations: [{ name: "Apple" }] } },
      { id: "4", payload: { organizations: [{ name: "Mango" }] } },
    ];
    const groups = groupContactsByOrg(rows);
    expect(groups.map((g) => g.orgName)).toEqual(["Apple", "Mango", "Zebra", null]);
  });

  it("returns empty array for empty input", () => {
    expect(groupContactsByOrg([])).toEqual([]);
  });
});
