import { describe, expect, it } from "vitest";
import { EXPERT_QUOTES } from "@/data/expert-quotes";

describe("expert quote avatars", () => {
  it("does not reference upload.wikimedia.org thumbnail URLs (Ahrefs 400)", () => {
    for (const q of EXPERT_QUOTES) {
      expect(q.avatarUrl.includes("upload.wikimedia.org")).toBe(false);
    }
  });

  it("every avatar URL is https and well-formed", () => {
    for (const q of EXPERT_QUOTES) {
      expect(() => new URL(q.avatarUrl)).not.toThrow();
      expect(q.avatarUrl.startsWith("https://")).toBe(true);
    }
  });
});
