import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseArgs } from "../../src/args.js";
import { resolveBody } from "../../src/body.js";

describe("resolveBody", () => {
  it("is undefined when neither --body nor --data was given", async () => {
    await expect(resolveBody(parseArgs(["call", "GET", "/v1/me"]))).resolves.toBeUndefined();
  });

  it("parses inline JSON", async () => {
    await expect(resolveBody(parseArgs(["--body", '{"name":"key"}']))).resolves.toEqual({ name: "key" });
  });

  it("reads a file with @", async () => {
    const dir = mkdtempSync(join(tmpdir(), "distribute-cli-body-"));
    const path = join(dir, "body.json");
    writeFileSync(path, '{"name":"from-file"}');
    await expect(resolveBody(parseArgs(["--body", `@${path}`]))).resolves.toEqual({ name: "from-file" });
  });

  it("builds a flat object from --data and keeps values as written", async () => {
    await expect(resolveBody(parseArgs(["--data", "name=key", "--data", "count=07"]))).resolves.toEqual({
      name: "key",
      count: "07",
    });
  });

  it("refuses --body together with --data", async () => {
    await expect(resolveBody(parseArgs(["--body", "{}", "--data", "a=b"]))).rejects.toThrow(/not both/);
  });

  it("refuses a body that is not JSON instead of sending it raw", async () => {
    await expect(resolveBody(parseArgs(["--body", "name=key"]))).rejects.toThrow(/not valid JSON/);
  });

  it("names the file it could not read", async () => {
    await expect(resolveBody(parseArgs(["--body", "@/nope/missing.json"]))).rejects.toThrow(/missing.json/);
  });
});
