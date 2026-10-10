import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Clicking a person in the Unibox left the right panel on "Pick a person" (prod
 * 2026-10-10). The click rewrote `?person=` with
 * `window.history.replaceState(window.history.state, ...)`. Next's app router patches
 * replaceState/pushState to keep useSearchParams in step, but it SKIPS any call whose
 * state carries its own `__NA` / `_N` marker (it reads it as one of its own calls),
 * and the current entry always carries it. So the URL changed and useSearchParams
 * never did. Pass `null` (Next copies its internal state itself), as Next documents.
 */
const ROOTS = [join(__dirname, "../src"), join(__dirname, "../../admin/src")];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("a URL rewritten through the history API reaches useSearchParams", () => {
  it("never hands Next's own history state back to replaceState/pushState", () => {
    const offenders = ROOTS.flatMap(files).filter((f) =>
      /history\.(replaceState|pushState)\(\s*(window\.)?history\.state\b/.test(stripComments(readFileSync(f, "utf8"))),
    );
    expect(offenders).toEqual([]);
  });

  it("the Unibox writes its person and family params with a null state", () => {
    const src = stripComments(readFileSync(join(__dirname, "../src/components/v2/integrations-conversations.tsx"), "utf8"));
    expect(src).toContain('window.history.replaceState(null, "", `?${next.toString()}`)');
  });
});
