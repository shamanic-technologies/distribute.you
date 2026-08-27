import { describe, it, expect } from "vitest";
import { withTimeout, isTimeoutError, TimeoutError } from "../src/lib/with-timeout";

/**
 * Real unit tests — `with-timeout.ts` is alias-free on purpose. Keep it that way:
 * an `@/…` import turns these into resolution failures.
 */
describe("withTimeout", () => {
  it("resolves a promise that settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000, "Doing the thing")).resolves.toBe("ok");
  });

  it("forwards the underlying rejection unchanged", async () => {
    const boom = new Error("refused");
    await expect(withTimeout(Promise.reject(boom), 1000, "Doing the thing")).rejects.toBe(boom);
  });

  it("rejects with a TimeoutError naming the leg when nothing settles", async () => {
    // The whole point: `fetch` / Clerk give up on nothing, so the caller has to.
    const never = new Promise<never>(() => {});
    const err = await withTimeout(never, 10, "Switching organization").catch((e) => e);
    expect(err).toBeInstanceOf(TimeoutError);
    expect((err as Error).message).toContain("Switching organization");
  });

  it("tells a timeout apart from an ordinary refusal", async () => {
    // A refusal may be worth a second, different attempt (join then retry); a
    // timeout means the network is gone and another round-trip only doubles the
    // wait. The two must not be confused.
    expect(isTimeoutError(new TimeoutError("x"))).toBe(true);
    expect(isTimeoutError(new Error("not a member"))).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
  });
});
