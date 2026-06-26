import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

// God-mode org switch: the staff-join route must be TRULY idempotent. The old
// guard read only the first page of getOrganizationMembershipList, so for staff
// who joined many orgs an existing membership beyond page 1 looked absent →
// re-create → Clerk 400 already_a_member_in_organization → 502 → OrgActivator
// threw before setActive → active org never switched → every /api/v1 read 409'd →
// blank org page. Fix: trust Clerk's response, treat already-a-member as success.

describe("God-mode join is idempotent (no first-page membership pre-check)", () => {
  const joinRoute = fs.readFileSync(
    path.join(
      __dirname,
      "../src/app/(authed)/api/admin/orgs/[orgId]/join/route.ts",
    ),
    "utf-8",
  );
  const orgActivator = fs.readFileSync(
    path.join(__dirname, "../src/components/org-activator.tsx"),
    "utf-8",
  );

  it("treats Clerk already_a_member_in_organization as success, not 502", () => {
    expect(joinRoute).toContain("already_a_member_in_organization");
    expect(joinRoute).toContain("isAlreadyMemberError");
    expect(joinRoute).toContain("ok: true, alreadyMember: true");
  });

  it("drops the fragile first-page getOrganizationMembershipList pre-check", () => {
    // The paginated pre-check WAS the bug source — membership beyond page 1 read
    // as absent. The create+catch-already-member path is the real idempotency.
    // Assert the CALL is gone (not the prose — the fix comment names the API).
    expect(joinRoute).not.toContain("client.users.getOrganizationMembershipList");
  });

  it("OrgActivator re-mints the token after setActive (no stale-org 409 window)", () => {
    expect(orgActivator).toContain("setActive({ organization: targetOrgId })");
    expect(orgActivator).toContain("getToken({ skipCache: true })");
  });
});
