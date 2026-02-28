import { describe, it, expect } from "vitest";
import { URLS } from "../src/urls.js";

describe("URLS", () => {
  it("has apiDocs URL pointing to Scalar docs", () => {
    expect(URLS.apiDocs).toBe("https://api.distribute.you/docs");
  });

  it("apiDocs URL is derived from api base URL", () => {
    expect(URLS.apiDocs).toContain(URLS.api);
  });

  it("all URLs use distribute.you domain", () => {
    for (const [key, url] of Object.entries(URLS)) {
      if (key === "github" || key === "twitter") continue;
      expect(url).toMatch(/distribute\.you/);
    }
  });
});
