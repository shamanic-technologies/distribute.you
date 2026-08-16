import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { SERVICE_IDENTITY, isServiceIdentity } from "../src/lib/service-identity";

/**
 * A platform job sending `x-external-user-id` CREATES A USER ROW: the api-service
 * admin path resolves the (org, user) pair through client-service, which upserts
 * `users` on whatever external id it is handed. Three call sites here have no
 * person behind them and were keying that id on the ORG, so prod accumulated
 * **89 phantom rows against 64 real users** — and client-service's public user
 * count, the number the `/investors` page prints, read **153**.
 *
 * `service-identity.ts` carries no runtime `@` import, so it gets real unit
 * tests; the call sites import through the alias, so those stay source-substring
 * guards.
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

  it("identities are distinct, so a run can name the job that made it", () => {
    const ids = Object.values(SERVICE_IDENTITY);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tells a job apart from a Clerk user", () => {
    expect(isServiceIdentity(SERVICE_IDENTITY.outcomeDigest)).toBe(true);
    expect(isServiceIdentity("user_3GB6ixWSvcqogOMXIyCYHSStERF")).toBe(false);
  });
});

const read = (p: string) => fs.readFileSync(path.join(__dirname, p), "utf-8");

describe("no call site invents its own identity", () => {
  for (const [label, file] of [
    ["the outcome digest", "../src/lib/outcome-digest.ts"],
    ["the share-link proxy", "../src/app/share/[token]/api/v1/[...path]/route.ts"],
  ] as const) {
    it(`${label} reads the catalogue`, () => {
      const src = read(file);
      expect(src).toContain("SERVICE_IDENTITY");
      // An id built from the org is the shape that produced the phantom rows.
      expect(src).not.toMatch(/"x-external-user-id": `[a-z-]+:\$\{/);
    });
  }

  it("the digest still mails each recipient under their OWN identity", () => {
    // The send is the one call in that file with a real person behind it — the
    // run it books belongs to the customer, not to the cron.
    const src = read("../src/lib/outcome-digest.ts");
    expect(src).toContain("adminHeaders(config, item.orgId, item.userExternalId)");
  });
});
