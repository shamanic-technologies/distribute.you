import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("the audience reader", () => {
  it("the audience reader declares offerId, so the link has something to read", () => {
    // A field the producer serves as required must be required here too: declared
    // `.optional()` (or absent) it would read `undefined` forever and every link
    // would silently vanish, which is indistinguishable from "this audience has no
    // offer". human-service marks `offerId` required + nullable on every audience
    // response (list, status, avatar).
    const api = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");
    const at = api.indexOf("const AudienceSchema = z.object({");
    expect(at, "AudienceSchema not found").toBeGreaterThan(-1);
    expect(api.slice(at, at + 900)).toContain("offerId: z.string().nullable(),");
  });
});
