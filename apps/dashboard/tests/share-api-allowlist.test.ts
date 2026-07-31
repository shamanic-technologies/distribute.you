import { describe, it, expect } from "vitest";
import { shareApiAccess } from "../src/lib/share-api-allowlist";

// `lib/share-api-allowlist.ts` carries no `@` import, so it is runtime-importable
// and gets real unit tests rather than source-substring guards. This is the
// security boundary of the public share view — keep it that way.

const BRAND = "brand-1";
const q = (s = "") => new URLSearchParams(s);

describe("share reads are read-only", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE", "post"])("refuses %s", (method) => {
    const decision = shareApiAccess(method, `/brands/${BRAND}`, q(), BRAND);
    expect(decision.allowed).toBe(false);
  });

  it("allows GET on a listed read", () => {
    expect(shareApiAccess("GET", `/brands/${BRAND}`, q(), BRAND).allowed).toBe(true);
  });
});

describe("the allowlist covers what the four shared pages read", () => {
  it.each([
    [`/brands/${BRAND}`, ""],
    [`/brands/${BRAND}/sales-economics`, ""],
    [`/brands/${BRAND}/sales-economics-effective`, ""],
    [`/brands/${BRAND}/daily-budget`, ""],
    [`/brands/${BRAND}/pause`, ""],
    [`/brands/${BRAND}/user-fields`, ""],
    [`/brands/${BRAND}/click-destination`, ""],
    [`/brands/${BRAND}/conversion-token`, ""],
    ["/features", ""],
    ["/features/stats/registry", ""],
    ["/features/sales-cold-email-outreach", ""],
    ["/features/sales-cold-email-outreach/stats", `brandId=${BRAND}`],
    ["/features/sales-cold-email-outreach/audience-stats", `brandId=${BRAND}&goal=meetingBooked`],
    ["/features/sales-cold-email-outreach/revenue", `brandId=${BRAND}`],
    ["/features/sales-cold-email-outreach/pipeline-activity", `brandId=${BRAND}`],
    ["/features/sales-cold-email-outreach/workflow-projection", `brandId=${BRAND}`],
    ["/orgs/audiences", `brandId=${BRAND}`],
    ["/leads", `brandId=${BRAND}&view=basic`],
    ["/emails/by-lead/lead-9", `brandId=${BRAND}`],
    ["/workflow-examples", `workflowSlug=x&brandId=${BRAND}`],
    ["/campaigns", `brandId=${BRAND}&status=all`],
  ])("allows GET %s", (path, search) => {
    expect(shareApiAccess("GET", path, q(search), BRAND).allowed).toBe(true);
  });
});

describe("everything else is refused by default", () => {
  // A denylist is a list of the leaks somebody thought of. These are the ones that
  // would hurt most, but the point is that an unlisted path is refused whether or
  // not it appears here.
  it.each([
    [`/brands/${BRAND}/share-token`, ""], // the credential itself
    [`/brands/${BRAND}/runs`, ""],
    ["/api-keys", ""],
    ["/byok-keys", ""],
    ["/billing/account", ""],
    ["/me", ""],
    ["/brands", ""],
    ["/orgs/contacts", `brandId=${BRAND}`],
    ["/campaigns/campaign-1", ""],
  ])("refuses GET %s", (path, search) => {
    expect(shareApiAccess("GET", path, q(search), BRAND).allowed).toBe(false);
  });
});

describe("every read is pinned to the credential's own brand", () => {
  it("refuses a sibling brand named in the path", () => {
    const decision = shareApiAccess("GET", "/brands/other-brand", q(), BRAND);
    expect(decision.allowed).toBe(false);
  });

  it("refuses a sibling brand named in the query", () => {
    const decision = shareApiAccess("GET", "/leads", q("brandId=other-brand"), BRAND);
    expect(decision.allowed).toBe(false);
  });

  // Without a brand this would read the whole org, so "unscoped" is a denial
  // rather than a default.
  it("refuses a brand-scoped read that names no brand", () => {
    expect(shareApiAccess("GET", "/leads", q(), BRAND).allowed).toBe(false);
    expect(
      shareApiAccess("GET", "/features/x/revenue", q("pricing=net"), BRAND).allowed,
    ).toBe(false);
  });

  it("names the path in the refusal so a gap is diagnosable", () => {
    const decision = shareApiAccess("GET", "/api-keys", q(), BRAND);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toContain("/api-keys");
  });
});
