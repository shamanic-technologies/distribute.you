import { describe, it, expect } from "vitest";

describe("loading skeleton exports", () => {
  it("home loading.tsx exports a default function", async () => {
    const mod = await import("../../src/app/loading");
    expect(typeof mod.default).toBe("function");
  });

  it("brands loading.tsx exports a default function", async () => {
    const mod = await import("../../src/app/brands/loading");
    expect(typeof mod.default).toBe("function");
  });

  it("models loading.tsx exports a default function", async () => {
    const mod = await import("../../src/app/models/loading");
    expect(typeof mod.default).toBe("function");
  });
});
