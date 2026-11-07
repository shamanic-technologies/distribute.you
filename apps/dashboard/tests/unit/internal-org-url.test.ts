import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clerkOrgRedirectPath,
  internalOrgUuidInPath,
  pathWithClerkOrgId,
  resetInternalOrgUrlCache,
  resolveClerkOrgId,
} from "../../src/lib/internal-org-url";
import { isOrgDesyncError, orgDesyncMessage } from "../../src/lib/org-desync";
import { linkedinFinishErrorMessage, linkedinStartErrorMessage } from "../../src/lib/linkedin-connect";

const UUID = "f0420eb5-8f72-4f0a-a150-f473746df1e6";
const CLERK = "org_3CL2MrIGuvlW9YHd5RgRgNoMAMS";
const BUG_PATH = `/v2/orgs/${UUID}/brands/f4d73dab-1f9d-49b2-b16e-63ecde76a5eb/integrations`;

describe("internal org uuid URL → Clerk-id URL (2026-11-07 LinkedIn org_desync)", () => {
  beforeEach(() => resetInternalOrgUrlCache());

  it("finds the uuid in v2 and v1 org URLs, never a Clerk id or a brand uuid", () => {
    expect(internalOrgUuidInPath(BUG_PATH)).toBe(UUID);
    expect(internalOrgUuidInPath(`/v2/orgs/${UUID}`)).toBe(UUID);
    expect(internalOrgUuidInPath(`/orgs/${UUID}/brands/x`)).toBe(UUID);
    expect(internalOrgUuidInPath(`/v2/orgs/${UUID.toUpperCase()}/brands`)).toBe(UUID);
    expect(internalOrgUuidInPath(`/v2/orgs/${CLERK}/brands/${UUID}`)).toBeNull();
    expect(internalOrgUuidInPath(`/v2/monitoring/${UUID}`)).toBeNull();
    expect(internalOrgUuidInPath(`/v2/orgs/${UUID}x/brands`)).toBeNull();
    expect(internalOrgUuidInPath(`/api/v1/orgs/${UUID}`)).toBeNull();
  });

  it("swaps only the org segment, keeping prefix and the rest of the path", () => {
    expect(pathWithClerkOrgId(BUG_PATH, CLERK)).toBe(
      `/v2/orgs/${CLERK}/brands/f4d73dab-1f9d-49b2-b16e-63ecde76a5eb/integrations`,
    );
    expect(pathWithClerkOrgId(`/orgs/${UUID}`, CLERK)).toBe(`/orgs/${CLERK}`);
  });

  it("redirects the bug URL to the same page under the Clerk id, query kept", async () => {
    const fetchOrg = vi.fn(async () => ({ externalId: CLERK }));
    expect(await clerkOrgRedirectPath(BUG_PATH, "?tab=accounts", fetchOrg)).toBe(
      `/v2/orgs/${CLERK}/brands/f4d73dab-1f9d-49b2-b16e-63ecde76a5eb/integrations?tab=accounts`,
    );
    expect(fetchOrg).toHaveBeenCalledWith(UUID);
  });

  it("does nothing (no lookup) on a Clerk-id URL", async () => {
    const fetchOrg = vi.fn(async () => ({ externalId: CLERK }));
    expect(await clerkOrgRedirectPath(`/v2/orgs/${CLERK}/brands/x`, "", fetchOrg)).toBeNull();
    expect(fetchOrg).not.toHaveBeenCalled();
  });

  it("caches a resolved pair: one client-service call per org", async () => {
    const fetchOrg = vi.fn(async () => ({ externalId: CLERK }));
    await resolveClerkOrgId(UUID, fetchOrg);
    await resolveClerkOrgId(UUID, fetchOrg);
    expect(fetchOrg).toHaveBeenCalledTimes(1);
  });

  it("no redirect for an unknown org, an anonymous org, or a failed lookup (not cached)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await resolveClerkOrgId(UUID, async () => null)).toBeNull();
    expect(await resolveClerkOrgId(UUID, async () => ({ externalId: "anon_123" }))).toBeNull();
    expect(await resolveClerkOrgId(UUID, async () => ({ externalId: null }))).toBeNull();
    expect(
      await resolveClerkOrgId(UUID, async () => {
        throw new Error("timeout");
      }),
    ).toBeNull();
    // A later successful lookup still resolves: failures were not cached.
    expect(await resolveClerkOrgId(UUID, async () => ({ externalId: CLERK }))).toBe(CLERK);
    err.mockRestore();
  });
});

describe("an unresolved org_desync says which org is open", () => {
  const desync = Object.assign(new Error(orgDesyncMessage("Beyond Logic")), {
    status: 409,
    body: { error: "org_desync", sessionOrgId: "org_3LHtCuVKLtK32xEidk10CIniJ03", requestedOrgId: UUID },
  });

  it("names the session's org", () => {
    expect(orgDesyncMessage("Beyond Logic")).toBe(
      "This page belongs to another organization. You are signed in to Beyond Logic.",
    );
    expect(orgDesyncMessage(null)).toBe("This page belongs to another organization than the one you are signed in to.");
  });

  it("recognises the proxy's refusal only", () => {
    expect(isOrgDesyncError(desync)).toBe(true);
    expect(isOrgDesyncError({ status: 409, body: { error: "conflict" } })).toBe(false);
    expect(isOrgDesyncError({ status: 500 })).toBe(false);
  });

  it("LinkedIn connect shows it instead of a generic try again", () => {
    expect(linkedinStartErrorMessage(desync)).toBe("This page belongs to another organization. You are signed in to Beyond Logic.");
    expect(linkedinFinishErrorMessage(desync)).toBe("This page belongs to another organization. You are signed in to Beyond Logic.");
    expect(linkedinStartErrorMessage({ status: 500 })).toBe("We could not open LinkedIn just now. Try again.");
  });
});
