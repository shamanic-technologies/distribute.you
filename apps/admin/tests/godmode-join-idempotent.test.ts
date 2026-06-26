import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Byte-equal-intent mirror of the dashboard god-mode join route. The staff-join
// must be TRULY idempotent: trust Clerk's already_a_member_in_organization
// response instead of a first-page getOrganizationMembershipList pre-check (which
// missed memberships beyond page 1 → re-create → Clerk 400 → 502).

describe("Admin god-mode join is idempotent", () => {
  const joinRoute = fs.readFileSync(
    path.join(
      __dirname,
      "../src/app/(authed)/api/admin/orgs/[orgId]/join/route.ts",
    ),
    "utf-8",
  );

  it("treats already_a_member_in_organization as success, not 502", () => {
    expect(joinRoute).toContain("already_a_member_in_organization");
    expect(joinRoute).toContain("isAlreadyMemberError");
    expect(joinRoute).toContain("ok: true, alreadyMember: true");
  });

  it("drops the fragile first-page getOrganizationMembershipList pre-check", () => {
    // Assert the CALL is gone (not the prose — the fix comment names the API).
    expect(joinRoute).not.toContain("client.users.getOrganizationMembershipList");
  });
});
