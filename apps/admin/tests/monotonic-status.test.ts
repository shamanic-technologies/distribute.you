import { describe, it, expect, vi, afterEach } from "vitest";
import { nextMonotonicStatus } from "../src/lib/use-monotonic-status";

// "most-advanced-first" — mirrors LEAD_STATUS_ORDER on the leads pages.
const PRIORITY = [
  "replied",
  "clicked",
  "opened",
  "delivered",
  "sent",
  "bounced",
  "unsubscribed",
  "contacted",
  "served",
  "skipped",
  "claimed",
  "buffered",
] as const;

describe("nextMonotonicStatus", () => {
  afterEach(() => vi.restoreAllMocks());

  it("adopts next when there is no prior status", () => {
    expect(nextMonotonicStatus(undefined, "served", PRIORITY)).toBe("served");
  });

  it("advances to a more-advanced status (lower index)", () => {
    expect(nextMonotonicStatus("served", "delivered", PRIORITY)).toBe("delivered");
    expect(nextMonotonicStatus("delivered", "opened", PRIORITY)).toBe("opened");
    expect(nextMonotonicStatus("contacted", "replied", PRIORITY)).toBe("replied");
  });

  it("latches (keeps prev) on a regression to a less-advanced status", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(nextMonotonicStatus("delivered", "served", PRIORITY)).toBe("delivered");
    expect(nextMonotonicStatus("replied", "contacted", PRIORITY)).toBe("replied");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("logs the suppressed downgrade loudly (fail-visible, not a silent fallback)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    nextMonotonicStatus("opened", "served", PRIORITY, "leads");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("suppressed downgrade opened → served");
    expect(spy.mock.calls[0][0]).toContain("(leads)");
  });

  it("returns next when equal (no spurious log)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(nextMonotonicStatus("delivered", "delivered", PRIORITY)).toBe("delivered");
    expect(spy).not.toHaveBeenCalled();
  });

  it("a known status always outranks an unknown one (unknown never displaces known)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(nextMonotonicStatus("delivered", "mystery", PRIORITY)).toBe("delivered");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("adopts a known status when prev was unknown", () => {
    expect(nextMonotonicStatus("mystery", "delivered", PRIORITY)).toBe("delivered");
  });

  it("holds the most-advanced status across a flapping poll sequence", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // served → delivered → (overlay drops) served → (overlay back) opened
    let s: string | undefined;
    s = nextMonotonicStatus(s, "served", PRIORITY);
    s = nextMonotonicStatus(s, "delivered", PRIORITY);
    expect(s).toBe("delivered");
    s = nextMonotonicStatus(s, "served", PRIORITY); // transient drop — suppressed
    expect(s).toBe("delivered");
    s = nextMonotonicStatus(s, "opened", PRIORITY); // real advance
    expect(s).toBe("opened");
  });
});
