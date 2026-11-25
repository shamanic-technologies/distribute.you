import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * ORG-X-APP-1116: on the X accounts card, whether each account posts through the org's own X app
 * (social-service). Every figure is served: the card renders, never computes.
 */
const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");
const xCard = read("src/components/v2/x-accounts-card.tsx");
const api = read("src/lib/api.ts");

describe("X accounts: the org's own X app", () => {
  it("parses xApp, ownApp and ownAppError as social-service serves them", () => {
    expect(api).toContain('xApp: z.enum(["own", "platform"])');
    expect(api).toContain("ownApp: XOwnAppSchema.nullable()");
    expect(api).toContain("ownAppError: z.string().nullable()");
  });

  it("marks each account with whose X app it posts through, and shows the served calls and error", () => {
    expect(xCard).toContain('account.xApp === "own" ? "Your X app" : "Our X app"');
    expect(xCard).toContain("app.calls.total");
    expect(xCard).toContain("{ownAppError}");
  });

  it("caches the new object shape under its own root (an old snapshot was an array)", () => {
    expect(xCard).toContain('["xAccountsState", brandId]');
    expect(read("src/lib/persist-cache.ts")).not.toMatch(/^\s*"xAccounts",/m);
  });
});
