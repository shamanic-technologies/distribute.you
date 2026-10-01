import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const api = readFileSync(join(process.cwd(), "src/lib/api.ts"), "utf8");

describe("the lead's served offer", () => {
  // lead-service resolves the offer off the campaign the lead was served under and is
  // fail-soft on it, so an absent offer means "we could not say" as often as "there is none".
  it("types the field as optional and nullable on the wire", () => {
    expect(api).toContain("offer?: { id: string; name: string | null } | null;");
  });
});
