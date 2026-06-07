import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/blog/db", () => ({
  listArticles: vi.fn(async () => []),
}));
vi.mock("@/lib/benchmarks/fetch-benchmark", () => ({
  fetchBenchmarkFeatures: vi.fn(async () => []),
}));

describe("landing sitemap", () => {
  it("includes /terms entry", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://distribute.you/terms");
  });

  it("includes the apex URL", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://distribute.you");
  });
});
