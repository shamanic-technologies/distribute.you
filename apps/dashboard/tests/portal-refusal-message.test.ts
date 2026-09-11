import { describe, it, expect } from "vitest";
import { ApiError, portalRefusalMessage, PORTAL_REFUSAL_UNSETTLED_CODE } from "../src/lib/api";

describe("portalRefusalMessage", () => {
  it("states the owed amount off billing's 402 body", () => {
    const err = new ApiError("Settle your outstanding balance", 402, {
      code: PORTAL_REFUSAL_UNSETTLED_CODE,
      owed_cents: "5000",
      reason: "charge_failed",
    });
    expect(portalRefusalMessage(err)).toContain("$50.00");
    expect(portalRefusalMessage(err)).not.toContain("Settle your outstanding balance");
  });

  it("omits the amount when billing did not state one, rather than printing NaN", () => {
    const err = new ApiError("x", 402, { code: PORTAL_REFUSAL_UNSETTLED_CODE });
    expect(portalRefusalMessage(err)).not.toContain("$");
    expect(portalRefusalMessage(err)).not.toContain("NaN");
  });

  it("a 402 with another code, or any other status, gets the generic line", () => {
    const other402 = new ApiError("x", 402, { code: "insufficient_credits", owed_cents: "5000" });
    const gateway502 = new ApiError('{"error":"billing down"}', 502, { error: "billing down" });
    expect(portalRefusalMessage(other402)).toBe(portalRefusalMessage(gateway502));
    expect(portalRefusalMessage(gateway502)).not.toContain("billing down");
    expect(portalRefusalMessage(new Error("boom"))).not.toContain("boom");
  });
});
