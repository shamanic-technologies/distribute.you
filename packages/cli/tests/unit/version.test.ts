import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VERSION, userAgent } from "../../src/client.js";

describe("version", () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf8"));

  it("matches package.json, so --version is not a second answer", () => {
    expect(VERSION).toBe(pkg.version);
  });

  it("identifies itself in the user agent", () => {
    expect(userAgent()).toContain(`distribute-cli/${pkg.version}`);
  });

  it("ships the binary the README names", () => {
    expect(Object.keys(pkg.bin)).toEqual(["distribute"]);
  });

  it("has no runtime dependencies", () => {
    expect(pkg.dependencies).toBeUndefined();
  });
});
