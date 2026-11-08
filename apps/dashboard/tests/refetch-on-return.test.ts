import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { refetchOnReturn } from "../src/lib/query-options";

// Owner 2026-11-08: switching macOS desktops and coming back re-showed the Outcomes page
// skeleton. A read that failed with no data (a 404) was refetched on window focus; React
// Query resets such a query to `pending` on every refetch, so a page gating its reveal on
// "every read answered" went back to its skeleton until the 404 came back again.
describe("refetchOnReturn", () => {
  it("does not refetch a read that failed and holds no data", () => {
    expect(refetchOnReturn({ state: { status: "error", data: undefined } })).toBe(false);
  });

  it("refetches every other read", () => {
    expect(refetchOnReturn({ state: { status: "success", data: [] } })).toBe(true);
    expect(refetchOnReturn({ state: { status: "error", data: { a: 1 } } })).toBe(true);
    expect(refetchOnReturn({ state: { status: "pending", data: undefined } })).toBe(true);
  });
});

describe("the QueryClient defaults", () => {
  const src = readFileSync(join(__dirname, "../src/lib/query-provider.tsx"), "utf8");

  it("use it for window focus AND reconnect", () => {
    expect(src).toContain("refetchOnWindowFocus: refetchOnReturn,");
    expect(src).toContain("refetchOnReconnect: refetchOnReturn,");
    expect(src).not.toContain("refetchOnWindowFocus: true");
    expect(src).not.toContain("refetchOnReconnect: true");
  });
});
