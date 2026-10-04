import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SALES_PATH_AVATAR_NAMES, salesPathAvatarSrc } from "../src/lib/sales-path-avatars";

describe("sales path avatars", () => {
  it("every listed name has its face on disk", () => {
    for (const name of SALES_PATH_AVATAR_NAMES) {
      const src = salesPathAvatarSrc(name);
      expect(src, name).not.toBeNull();
      expect(existsSync(join(__dirname, "../public", src!)), name).toBe(true);
    }
  });
  it("a name nobody drew is told apart, never pointed at a missing file", () => {
    expect(salesPathAvatarSrc("Zephyr")).toBeNull();
    expect(salesPathAvatarSrc("Victory")).toBe("/sales-path-avatars/victory.jpg");
  });
});
