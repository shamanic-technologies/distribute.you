import { describe, it, expect } from "vitest";
import { defaultDir, compareForSort } from "../../src/lib/sort-direction";

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

describe("compareForSort", () => {
  it("sorts non-zero values ascending", () => {
    const values = [30, 10, 20];
    const sorted = values.sort((a, b) => compareForSort(a, b, "asc"));
    expect(sorted).toEqual([10, 20, 30]);
  });

  it("sorts non-zero values descending", () => {
    const values = [10, 30, 20];
    const sorted = values.sort((a, b) => compareForSort(a, b, "desc"));
    expect(sorted).toEqual([30, 20, 10]);
  });

  it("pushes zeros to the end when sorting ascending", () => {
    const values = [0, 10, 0, 5, 20];
    const sorted = values.sort((a, b) => compareForSort(a, b, "asc"));
    expect(sorted).toEqual([5, 10, 20, 0, 0]);
  });

  it("pushes zeros to the end when sorting descending", () => {
    const values = [0, 10, 0, 5, 20];
    const sorted = values.sort((a, b) => compareForSort(a, b, "desc"));
    expect(sorted).toEqual([20, 10, 5, 0, 0]);
  });

  it("pushes nulls to the end when sorting ascending", () => {
    const values = [null, 10, null, 5];
    const sorted = values.sort((a, b) => compareForSort(a, b, "asc"));
    expect(sorted).toEqual([5, 10, null, null]);
  });

  it("pushes nulls to the end when sorting descending", () => {
    const values = [null, 10, null, 5];
    const sorted = values.sort((a, b) => compareForSort(a, b, "desc"));
    expect(sorted).toEqual([10, 5, null, null]);
  });

  it("handles all zeros", () => {
    const values = [0, 0, 0];
    const sorted = values.sort((a, b) => compareForSort(a, b, "asc"));
    expect(sorted).toEqual([0, 0, 0]);
  });
});
