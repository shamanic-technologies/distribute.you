#!/usr/bin/env node
/**
 * Builds what the `distribute-docs` Cloudflare Pages project serves now that the docs live
 * under the landing (SITE-FOUNDATION-1029): no page, only a `_redirects` file that sends
 * every docs.distribute.you URL to its twin under https://distribute.you/docs with ONE
 * 301 (each route listed with and without its old trailing slash, so no second hop).
 *
 *   node apps/landing/scripts/docs-host-redirects.mjs <out-dir>
 *
 * Routes are read from `src/lib/docs/docs-routes.ts` (the one list), so a docs page added
 * later redirects without an edit here; anything else falls to the splat rule.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = process.argv[2];
if (!out) {
  console.error("usage: docs-host-redirects.mjs <out-dir>");
  process.exit(2);
}
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "../src/lib/docs/docs-routes.ts"), "utf8");
const list = src.slice(src.indexOf("export const DOCS_ROUTES"));
const paths = [...list.matchAll(/\bpath: "([^"]+)"/g)].map((m) => m[1]);
if (paths.length < 20) throw new Error(`docs-host-redirects: only ${paths.length} routes parsed`);

const TO = "https://distribute.you/docs";
const lines = ["/ " + TO + " 301", "/index.html " + TO + " 301"];
for (const p of paths.filter((p) => p !== "/")) {
  lines.push(`${p} ${TO}${p} 301`, `${p}/ ${TO}${p} 301`);
}
lines.push(
  `/llms.txt ${TO}/llms.txt 301`,
  `/skill.md ${TO}/skill.md 301`,
  `/og-image.png ${TO}/og-image.png 301`,
  "/sitemap.xml https://distribute.you/sitemap.xml 301",
  "/robots.txt https://distribute.you/robots.txt 301",
  `/* ${TO}/:splat 301`,
);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "_redirects"), lines.join("\n") + "\n");
// Pages refuses an upload with no document; this one is never served (`/` redirects first).
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${TO}"><link rel="canonical" href="${TO}"><a href="${TO}">distribute.you/docs</a>\n`,
);
console.log(`${lines.length} redirect rules written to ${join(out, "_redirects")}`);
