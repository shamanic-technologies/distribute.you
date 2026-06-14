import { describe, it, expect, vi } from "vitest";
import { checkProxyOrg } from "../src/lib/proxy-org";
import { ORG_DESYNC_ERROR, ORG_DESYNC_STATUS } from "../src/lib/org-desync";

describe("checkProxyOrg — fail-closed org-consistency guard", () => {
  it("returns null when the UI org matches the session org (forward allowed)", () => {
    expect(checkProxyOrg("org_a", "org_a")).toBeNull();
  });

  it("returns a 409 org_desync descriptor when UI org != session org", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = checkProxyOrg("org_a", "org_b");
    expect(err).not.toBeNull();
    expect(err?.status).toBe(ORG_DESYNC_STATUS);
    expect(err?.body.error).toBe(ORG_DESYNC_ERROR);
    expect(err?.body.sessionOrgId).toBe("org_a");
    expect(err?.body.requestedOrgId).toBe("org_b");
    warn.mockRestore();
  });

  it("returns null when no x-active-org-id was sent (non-org-scoped page)", () => {
    expect(checkProxyOrg("org_a", null)).toBeNull();
  });

  it("returns null for an empty-string header (falsy, treated as absent)", () => {
    expect(checkProxyOrg("org_a", "")).toBeNull();
  });

  it("never forwards the client-declared org — authority stays the session org", () => {
    // The guard only ever echoes the session org as authoritative; the requested
    // org appears solely in the error descriptor for diagnostics, never as output.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = checkProxyOrg("org_session", "org_attacker");
    expect(err?.body.sessionOrgId).toBe("org_session");
    warn.mockRestore();
  });
});
