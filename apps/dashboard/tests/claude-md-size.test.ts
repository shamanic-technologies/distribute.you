import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Every CLAUDE.md in this repo is re-read by the agent on every turn while it
 * works in that directory, so its size is a recurring cost. The root file grew
 * to 1.1MB before it was split into nested files; this guard keeps it split.
 * A new rule goes in the most specific nested CLAUDE.md, and a file nearing
 * its cap is compressed (rule + why, no incident story), never raised.
 */
const REPO_ROOT = join(__dirname, "..", "..", "..");
const ROOT_CAP_BYTES = 40_000;
const NESTED_CAP_BYTES = 45_000;
const SKIP = new Set(["node_modules", ".git", ".next", "dist", ".context", ".turbo"]);

function findClaudeFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) findClaudeFiles(path, out);
    else if (name === "CLAUDE.md") out.push(path);
  }
  return out;
}

describe("CLAUDE.md size caps", () => {
  const files = findClaudeFiles(REPO_ROOT);

  it("finds the root file and the nested ones", () => {
    expect(files.map((f) => relative(REPO_ROOT, f))).toContain("CLAUDE.md");
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    const rel = relative(REPO_ROOT, file);
    const cap = rel === "CLAUDE.md" ? ROOT_CAP_BYTES : NESTED_CAP_BYTES;
    it(`${rel} stays under ${cap} bytes`, () => {
      expect(readFileSync(file).byteLength).toBeLessThanOrEqual(cap);
    });
  }
});
