import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { SERVICE_IDENTITY, isServiceIdentity } from "../src/lib/service-identity";

/**
 * A platform job sending `x-external-user-id` CREATES A USER ROW: the api-service
 * admin path resolves the (org, user) pair through client-service, which upserts
 * `users` on whatever external id it is handed. The public report proxy has no
 * person behind it and was keying that id on the ORG, so prod accumulated
 * **89 phantom rows against 64 real users** across this and its two siblings in
 * `apps/dashboard` — and client-service's public user count, the number the
 * `/investors` page prints, read **153**.
 *
 * `service-identity.ts` is a byte-equal twin of the dashboard's and carries no
 * runtime `@` import, so it gets real unit tests; `report-api.ts` is
 * `server-only`, so that stays a source-substring guard.
 */
describe("service identities are job-keyed and live in the excluded namespace", () => {
  it("every identity sits under `system-`", () => {
    // client-service's public user stat excludes `system-%` and nothing else
    // pattern-shaped, so this prefix is what keeps a job out of the count.
    for (const id of Object.values(SERVICE_IDENTITY)) {
      expect(id.startsWith("system-"), `${id} must be in the system- namespace`).toBe(true);
    }
  });

  it("no identity carries an org or a brand", () => {
    // The whole bug: an id interpolating the org is one row per org, forever.
    for (const id of Object.values(SERVICE_IDENTITY)) {
      expect(id).not.toMatch(/org_|\$\{|:/);
    }
  });

  it("tells a job apart from a Clerk user", () => {
    expect(isServiceIdentity(SERVICE_IDENTITY.reportPublic)).toBe(true);
    expect(isServiceIdentity("user_3GB6ixWSvcqogOMXIyCYHSStERF")).toBe(false);
  });

  it("stays byte-equal with the dashboard's copy", () => {
    const here = fs.readFileSync(path.join(__dirname, "../src/lib/service-identity.ts"), "utf-8");
    const there = fs.readFileSync(
      path.join(__dirname, "../../dashboard/src/lib/service-identity.ts"),
      "utf-8",
    );
    // Two apps calling the same gateway must not disagree about who is calling.
    expect(here).toBe(there);
  });
});

describe("the public report proxy does not invent its own identity", () => {
  const src = fs.readFileSync(path.join(__dirname, "../src/lib/report-api.ts"), "utf-8");

  it("reads the catalogue", () => {
    expect(src).toContain("SERVICE_IDENTITY.reportPublic");
  });

  it("carries no org-keyed identity", () => {
    // An id built from the org is the shape that produced the phantom rows —
    // including one literal `report-public:%7BorgId%7D` that never interpolated.
    expect(src).not.toMatch(/"x-external-user-id": `[a-z-]+:\$\{/);
  });
});
