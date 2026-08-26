import { describe, expect, it } from "vitest";
import { boolFlag, flagValue, flagValues, keyValueFlag, parseArgs } from "../../src/args.js";
import { CliError } from "../../src/errors.js";

describe("parseArgs", () => {
  it("separates positionals from flags", () => {
    const args = parseArgs(["campaigns", "list", "--brand", "abc"]);
    expect(args.positionals).toEqual(["campaigns", "list"]);
    expect(flagValue(args, "brand")).toBe("abc");
  });

  it("accepts --flag=value", () => {
    expect(flagValue(parseArgs(["--api-url=https://example.test"]), "api-url")).toBe("https://example.test");
  });

  it("treats a flag with no value as true", () => {
    expect(boolFlag(parseArgs(["ops", "--refresh"]), "refresh")).toBe(true);
    expect(boolFlag(parseArgs(["ops"]), "refresh")).toBe(false);
    expect(boolFlag(parseArgs(["ops", "--refresh", "false"]), "refresh")).toBe(false);
  });

  it("keeps every occurrence of a repeated flag", () => {
    const args = parseArgs(["call", "GET", "/v1/leads", "--query", "a=1", "--query", "b=2"]);
    expect(flagValues(args, "query")).toEqual(["a=1", "b=2"]);
    expect(keyValueFlag(args, "query")).toEqual({ a: "1", b: "2" });
  });

  it("stops parsing flags after a bare --", () => {
    const args = parseArgs(["call", "GET", "--", "--not-a-flag"]);
    expect(args.positionals).toEqual(["call", "GET", "--not-a-flag"]);
  });

  it("keeps an = inside a value", () => {
    expect(keyValueFlag(parseArgs(["--data", "q=a=b"]), "data")).toEqual({ q: "a=b" });
  });

  it("rejects a key=value flag that carries no =", () => {
    expect(() => keyValueFlag(parseArgs(["--query", "brandId"]), "query")).toThrow(CliError);
  });
});
