import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DOCS_ROUTES, docsUrl } from "../../src/lib/docs/docs-routes";

/**
 * docs.distribute.you (Cloudflare Pages project `distribute-docs`) serves only the
 * `_redirects` this script builds: every old docs URL, with or without its trailing
 * slash, 301s in ONE hop to its twin under distribute.you/docs. No URL may 404.
 */
const out = mkdtempSync(path.join(tmpdir(), "docs-host-"));
execFileSync("node", [path.resolve(__dirname, "../../scripts/docs-host-redirects.mjs"), out]);
const rules = new Map(
  readFileSync(path.join(out, "_redirects"), "utf8")
    .trim()
    .split("\n")
    .map((l) => l.split(" "))
    .map(([from, to, code]) => [from, { to, code }]),
);

describe("the docs host redirect bundle", () => {
  it("sends every docs route, slashed or not, to its apex URL with one 301", () => {
    for (const r of DOCS_ROUTES) {
      const froms = r.path === "/" ? ["/"] : [r.path, `${r.path}/`];
      for (const from of froms) {
        expect(rules.get(from), from).toEqual({ to: docsUrl(r.path), code: "301" });
      }
    }
  });

  it("covers the machine-readable files and ends on a splat for anything else", () => {
    expect(rules.get("/skill.md")?.to).toBe("https://distribute.you/docs/skill.md");
    expect(rules.get("/llms.txt")?.to).toBe("https://distribute.you/docs/llms.txt");
    expect(rules.get("/sitemap.xml")?.to).toBe("https://distribute.you/sitemap.xml");
    const all = [...rules.keys()];
    expect(all[all.length - 1]).toBe("/*");
    expect(rules.get("/*")).toEqual({ to: "https://distribute.you/docs/:splat", code: "301" });
  });

  it("the workflow publishes that bundle to the docs project", () => {
    const wf = readFileSync(path.resolve(__dirname, "../../../../.github/workflows/deploy-static-sites.yml"), "utf8");
    expect(wf).toContain("node apps/landing/scripts/docs-host-redirects.mjs docs-host-out");
    expect(wf).toContain("--project-name=distribute-docs");
  });
});
