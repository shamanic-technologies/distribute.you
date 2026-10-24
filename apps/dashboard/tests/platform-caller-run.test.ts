import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * PLATFORM-CALLER-RUN-1024: every call to a chat-service PLATFORM route
 * (platform completion, judgments, transcriptions, image generation) states
 * whose work it is: the caller's own run (`x-run-id`, the spend rides the
 * outcome that run declares) or a declared support function (body
 * `support: { kind, reason }`). A call stating neither opens an orphan run
 * whose spend never reaches an outcome, and chat-service will refuse it.
 *
 * On 2026-10-24 this repo made no such call (the only mention is a read-only
 * SQL filter in apps/landing/scripts/blog-data/extract.sh). This guard keeps
 * it that way: any new code line naming a platform route must sit in a file
 * that also sends `x-run-id` or a `support` kind.
 */
const REPO_ROOT = join(__dirname, "..", "..", "..");
const SKIP = new Set(["node_modules", ".git", ".next", "dist", ".context", ".turbo", "fixtures", "out"]);
const EXT = /\.(ts|tsx|js|mjs|cjs|sh|py)$/;
// Built by join so this file does not match its own scan.
const ROUTE = new RegExp(["/internal/", "platform-(complete|judgments|transcriptions|images?)"].join(""));
const SUPPORT_KINDS = [
  "payment_fees",
  "brand_setup",
  "copilot",
  "platform_llm",
  "staff_experiment",
  "product_feature",
  "retired_product",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (EXT.test(name)) out.push(path);
  }
  return out;
}

/** Code lines only: a comment naming a route is not a call. */
function codeLines(src: string): string[] {
  return src.split("\n").filter((line) => {
    const t = line.trim();
    return !(t.startsWith("#") || t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
  });
}

function statesCaller(src: string): boolean {
  if (/x-run-id/i.test(src)) return true;
  return /support/.test(src) && SUPPORT_KINDS.some((k) => src.includes(k));
}

function callsPlatformRoute(src: string): boolean {
  return codeLines(src).some((line) => ROUTE.test(line));
}

describe("chat-service platform calls state their run or support function", () => {
  const route = ["/internal/", "platform-judgments"].join("");

  it("the predicate fails a call stating neither and passes each declared form", () => {
    const bare = `await fetch(\`\${CHAT}${route}\`, { method: "POST", body })`;
    expect(callsPlatformRoute(bare) && !statesCaller(bare)).toBe(true);
    expect(statesCaller(`${bare}\nheaders["x-run-id"] = runId;`)).toBe(true);
    expect(statesCaller(`${bare}\nsupport: { kind: "staff_experiment", reason: "probe" }`)).toBe(true);
    expect(callsPlatformRoute(`# reads chat-service ${route} runs`)).toBe(false);
  });

  it("no file in the repo calls a platform route without x-run-id or a support kind", () => {
    const offenders = walk(REPO_ROOT)
      .filter((file) => {
        const src = readFileSync(file, "utf8");
        return callsPlatformRoute(src) && !statesCaller(src);
      })
      .map((file) => relative(REPO_ROOT, file));
    expect(offenders).toEqual([]);
  });
});
