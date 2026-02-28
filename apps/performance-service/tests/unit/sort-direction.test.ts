import { describe, it, expect } from "vitest";
import { defaultDir } from "../../src/lib/sort-direction";

describe("defaultDir", () => {
  it("returns 'asc' for cost-per-outcome columns (lower is better)", () => {
    expect(defaultDir("costPerOpenCents")).toBe("asc");
    expect(defaultDir("costPerClickCents")).toBe("asc");
    expect(defaultDir("costPerReplyCents")).toBe("asc");
  });

  it("returns 'desc' for percentage/rate columns (higher is better)", () => {
    expect(defaultDir("openRate")).toBe("desc");
    expect(defaultDir("clickRate")).toBe("desc");
    expect(defaultDir("replyRate")).toBe("desc");
  });

  it("returns 'desc' for volume columns", () => {
    expect(defaultDir("emailsSent")).toBe("desc");
    expect(defaultDir("totalCostUsdCents")).toBe("desc");
    expect(defaultDir("runCount")).toBe("desc");
  });
});
