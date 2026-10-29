#!/usr/bin/env node
/**
 * No URL we ever published may 404 (SITE-FOUNDATION-1029 no-go).
 *
 *   node scripts/check-public-urls.mjs <base> [--docs-base <url>]
 *
 * Reads the LIVE sitemaps (https://distribute.you/sitemap.xml and the docs sitemap),
 * replays every path against <base> (a local `next start`, or prod after the merge) and
 * passes only when each answers 200, or a redirect whose target answers 200. Docs URLs
 * are checked at `--docs-base` (default: <base>, i.e. once the docs live under /docs the
 * old docs.distribute.you paths are expected to answer there or redirect there).
 * Exit code 1 on any failure, with the failing URLs listed.
 */
const args = process.argv.slice(2);
const base = (args[0] ?? "").replace(/\/$/, "");
if (!base) {
  console.error("usage: check-public-urls.mjs <base> [--docs-base <url>] [--docs-prefix /docs]");
  process.exit(2);
}
const opt = (name) => {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : undefined;
};
const docsBase = (opt("--docs-base") ?? base).replace(/\/$/, "");
const docsPrefix = opt("--docs-prefix") ?? "";

async function locs(url) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 url-check" } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
}

async function check(url) {
  let res = await fetch(url, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 url-check" } });
  if (res.status === 200) return { url, ok: true, status: "200" };
  if (res.status >= 300 && res.status < 400) {
    const to = new URL(res.headers.get("location") ?? "", url).toString();
    const hop = await fetch(to, { headers: { "user-agent": "Mozilla/5.0 url-check" } });
    return { url, ok: hop.status === 200, status: `${res.status} -> ${to} ${hop.status}` };
  }
  return { url, ok: false, status: String(res.status) };
}

const site = await locs("https://distribute.you/sitemap.xml");
const docs = await locs("https://docs.distribute.you/sitemap.xml");
const targets = [
  ...site.map((p) => `${base}${p}`),
  ...docs.map((p) => `${docsBase}${docsPrefix}${p}`),
];
const results = [];
for (let i = 0; i < targets.length; i += 6) {
  results.push(...(await Promise.all(targets.slice(i, i + 6).map(check))));
}
const bad = results.filter((r) => !r.ok);
console.log(`${results.length - bad.length}/${results.length} OK (${site.length} sitemap + ${docs.length} docs URLs)`);
for (const r of results.filter((x) => x.status !== "200")) console.log(`${r.ok ? "redirect" : "FAIL"} ${r.url} ${r.status}`);
process.exit(bad.length ? 1 : 0);
