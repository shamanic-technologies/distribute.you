import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { basicAuthOk } from "@/lib/clone-auth";
import {
  CLONES,
  CLONE_HOST_PREFIX,
  CLONE_HOST_SUFFIX,
  CLONE_ROUTE_PREFIX,
  cloneFor,
  cloneSlugForHost,
} from "@/lib/clone-catalogue";
import {
  clonePathFor,
  contentTypeFor,
  originPathFor,
  queryHash,
  withinRoot,
} from "@/lib/clone-files";
// The capture script, imported for the drift check below. It is plain ESM and its CLI
// block is guarded on argv, so importing it runs nothing.
import { diskPathFor, isAssetPath, referencesIn } from "../../scripts/clone-site.mjs";
import {
  EXTERNAL_DIR,
  externalPathFor,
  rewriteReferences,
  shouldMirrorHost,
} from "../../scripts/localise-clone.mjs";
import {
  CLONE_HOST_PREFIX as SCRIPT_HOST_PREFIX,
  CLONE_HOST_SUFFIX as SCRIPT_HOST_SUFFIX,
} from "../../scripts/clone-hosts.mjs";

const REPO_APP = path.resolve(__dirname, "../..");
const CLONES_DIR = path.join(REPO_APP, "clones");

describe("cloneSlugForHost", () => {
  it("resolves a catalogued clone host", () => {
    expect(cloneSlugForHost("lab-explee.distribute.you")).toBe("explee");
    expect(cloneSlugForHost("LAB-Explee.Distribute.You")).toBe("explee");
    expect(cloneSlugForHost("lab-explee.distribute.you:3000")).toBe("explee");
  });

  it("leaves every ordinary landing host alone", () => {
    for (const host of [
      "distribute.you",
      "www.distribute.you",
      "dashboard.distribute.you",
      "localhost:3000",
      "",
      null,
      undefined,
    ]) {
      expect(cloneSlugForHost(host)).toBeNull();
    }
  });

  it("refuses a host whose slug is not in the catalogue", () => {
    // The allowlist is what stops a guessed host from reaching a directory read.
    expect(cloneSlugForHost("lab-anything.distribute.you")).toBeNull();
    expect(cloneSlugForHost("lab-.distribute.you")).toBeNull();
    expect(cloneSlugForHost("lab-explee.evil.com")).toBeNull();
  });
});

describe("clonePathFor", () => {
  it("maps documents onto their index.html", () => {
    expect(clonePathFor("/")).toBe("index.html");
    expect(clonePathFor("/pricing")).toBe("pricing/index.html");
    expect(clonePathFor("/pricing/")).toBe("pricing/index.html");
    expect(clonePathFor("/a/b/c")).toBe("a/b/c/index.html");
  });

  it("passes an asset path through unchanged", () => {
    expect(clonePathFor("/_next/static/chunks/main.js")).toBe("_next/static/chunks/main.js");
    expect(clonePathFor("/static/images/hero.svg")).toBe("static/images/hero.svg");
  });

  it("stores a query-bearing URL beside its plain form", () => {
    const search = "?url=%2Fa.jpg&w=96&q=75";
    expect(clonePathFor("/_next/image", search)).toBe(`_next/image.__q${queryHash(search)}`);
    expect(clonePathFor("/a/logo.svg", search)).toBe(`a/logo.__q${queryHash(search)}.svg`);
  });

  it("refuses anything that could leave the clone root", () => {
    for (const attempt of [
      "/../secrets.env",
      "/a/../../etc/passwd",
      "/%2e%2e/%2e%2e/etc/passwd",
      "not-absolute",
      "/a/%00b",
    ]) {
      expect(clonePathFor(attempt)).toBeNull();
    }
  });

  it("keeps a resolved file inside the clone root", () => {
    const root = "/srv/clones/explee";
    expect(withinRoot(root, "/srv/clones/explee/index.html")).toBe(true);
    expect(withinRoot(root, "/srv/clones/explee-other/index.html")).toBe(false);
    expect(withinRoot(root, "/srv/clones/other/index.html")).toBe(false);
  });
});

describe("originPathFor", () => {
  // `request.url` inside the route is the request as it ARRIVED, so it already holds the
  // path the origin was asked for. Slicing the internal prefix off it — the obvious thing
  // to do under a rewrite — collapsed anything shorter than the prefix onto "/" (so
  // /version.json served the home page) and truncated everything longer (so every asset
  // 404'd while sitting on disk).
  it("returns an already-original path untouched", () => {
    expect(originPathFor("/", "/internal-clone", "explee")).toBe("/");
    expect(originPathFor("/version.json", "/internal-clone", "explee")).toBe("/version.json");
    expect(originPathFor("/static/images/a/b.png", "/internal-clone", "explee")).toBe(
      "/static/images/a/b.png",
    );
  });

  it("strips the internal prefix when it is genuinely there", () => {
    expect(originPathFor("/internal-clone/explee", "/internal-clone", "explee")).toBe("/");
    expect(originPathFor("/internal-clone/explee/a.png", "/internal-clone", "explee")).toBe("/a.png");
  });

  it("does not mistake a lookalike prefix for the real one", () => {
    expect(originPathFor("/internal-clone/explee-two/a.png", "/internal-clone", "explee")).toBe(
      "/internal-clone/explee-two/a.png",
    );
  });
});

describe("the reader and the capture script agree on every path", () => {
  // A disagreement here is the worst kind of bug this feature can have: a 404 on an
  // asset that is sitting on disk, which reads as a bad capture rather than as drift.
  const cases: Array<[string, string]> = [
    ["/", ""],
    ["/pricing", ""],
    ["/pricing/", ""],
    ["/_next/static/chunks/main.js", ""],
    ["/static/images/hero.svg", ""],
    ["/deep/nested/path/page", ""],
    ["/_next/image", "?url=%2Fa.jpg&w=96&q=75"],
    ["/a/logo.svg", "?v=2"],
    ["/style.css", "?hash=abc"],
  ];

  it.each(cases)("%s%s", (pathname, search) => {
    expect(clonePathFor(pathname, search)).toBe(diskPathFor(pathname, search));
  });

  it("hashes a query the same way on both sides", () => {
    expect(queryHash("?w=96")).toHaveLength(10);
  });
});

describe("the capture script only queues assets", () => {
  it("takes stylesheets, scripts and images, and leaves page links alone", () => {
    // Following document links is what turns a one-page mirror into a site crawl:
    // explee links a page per country, which pulled 839 files and 171MB on the first run.
    const html = `
      <link rel="stylesheet" href="/css/site.css">
      <script src="/_next/static/chunks/main.js"></script>
      <img src="/img/hero.png" srcset="/img/hero@2x.png 2x, /img/hero.png 1x">
      <a href="/b2b-database/locations/greece">Greece</a>
      <a href="/pricing">Pricing</a>
    `;
    const refs = referencesIn(html, "https://example.com/", "html");

    expect(refs).toContain("/css/site.css");
    expect(refs).toContain("/_next/static/chunks/main.js");
    expect(refs).toContain("/img/hero.png");
    expect(refs).toContain("/img/hero@2x.png");
    expect(refs).not.toContain("/b2b-database/locations/greece");
    expect(refs).not.toContain("/pricing");
  });

  it("decodes the escaped ampersands of a srcset candidate", () => {
    // Markup escapes them, and the origin answers 400 on the escaped form — which is how
    // the testimonial avatars went missing on the first capture.
    const html = `<img srcset="/_next/image?url=%2Fa.jpg&amp;w=96&amp;q=75 1x">`;
    expect(referencesIn(html, "https://example.com/", "html")).toContain(
      "/_next/image?url=%2Fa.jpg&w=96&q=75",
    );
  });

  it("reads the chunks a bundle names but no markup mentions", () => {
    const js = `t.u=function(e){return"static/chunks/"+e};import("/_next/static/chunks/lazy-42.js")`;
    expect(referencesIn(js, "https://example.com/_next/static/chunks/main.js", "other")).toContain(
      "/_next/static/chunks/lazy-42.js",
    );
  });

  it("knows an asset from a page", () => {
    expect(isAssetPath("/_next/static/chunks/main.js")).toBe(true);
    expect(isAssetPath("/img/hero.png")).toBe(true);
    expect(isAssetPath("/_next/image?url=x")).toBe(true);
    expect(isAssetPath("/pricing")).toBe(false);
    expect(isAssetPath("/b2b-database/locations/greece")).toBe(false);
  });
});

describe("rapatriating a cross-origin asset", () => {
  it("mirrors an asset host and leaves the trackers alone", () => {
    expect(shouldMirrorHost("framerusercontent.com", "image/avif")).toBe(true);
    expect(shouldMirrorHost("fonts.gstatic.com", "font/woff2")).toBe(true);
    expect(shouldMirrorHost("app.framerstatic.com", "text/javascript")).toBe(true);

    // Not the page: rewriting a beacon's endpoint onto our host would not make the clone
    // more local, it would 404 in a way that reads as a broken capture.
    expect(shouldMirrorHost("www.googletagmanager.com", "application/javascript")).toBe(false);
    expect(shouldMirrorHost("connect.facebook.net", "application/x-javascript")).toBe(false);
    expect(shouldMirrorHost("snap.licdn.com", "application/javascript")).toBe(false);
    expect(shouldMirrorHost("player.vimeo.com", "text/html")).toBe(false);
    expect(shouldMirrorHost("api.example.com", "application/json")).toBe(false);
  });

  it("REFUSES a blank host", () => {
    // A response can carry no host (a data: or blob: url). An empty host in the rewrite
    // replaces every `https://` in the clone: it broke `xmlns="http://www.w3.org/..."`,
    // their own canonical, and the three analytics tags that had been left alone on
    // purpose. Guarded at both ends.
    expect(shouldMirrorHost("", "image/png")).toBe(false);
    expect(shouldMirrorHost("localhost", "image/png")).toBe(false);
    const text = 'xmlns="http://www.w3.org/2000/svg" src="https://cdn.example.com/a.png"';
    expect(rewriteReferences(text, ["", "cdn.example.com"])).toBe(
      `xmlns="http://www.w3.org/2000/svg" src="/${EXTERNAL_DIR}/cdn.example.com/a.png"`,
    );
  });

  it("replaces the ORIGIN and never a path", () => {
    // A bundle that concatenates an origin with a path still resolves.
    expect(rewriteReferences('u="https://cdn.example.com"+p', ["cdn.example.com"])).toBe(
      `u="/${EXTERNAL_DIR}/cdn.example.com"+p`,
    );
    expect(rewriteReferences("http://cdn.example.com/a", ["cdn.example.com"])).toBe(
      `/${EXTERNAL_DIR}/cdn.example.com/a`,
    );
  });

  it("does not let a shorter host claim a longer one's references", () => {
    const text = "https://framer.com/a https://framerusercontent.com/b";
    expect(rewriteReferences(text, ["framer.com", "framerusercontent.com"])).toBe(
      `/${EXTERNAL_DIR}/framer.com/a /${EXTERNAL_DIR}/framerusercontent.com/b`,
    );
  });

  it("stores a mirrored asset under its own host", () => {
    expect(externalPathFor("cdn.example.com", "a/b.png")).toBe(
      `/${EXTERNAL_DIR}/cdn.example.com/a/b.png`,
    );
  });
});

describe("contentTypeFor", () => {
  it("names the type a browser needs", () => {
    expect(contentTypeFor("a/index.html")).toBe("text/html; charset=utf-8");
    expect(contentTypeFor("a/site.css")).toBe("text/css; charset=utf-8");
    expect(contentTypeFor("a/main.js")).toBe("text/javascript; charset=utf-8");
    expect(contentTypeFor("a/font.woff2")).toBe("font/woff2");
    expect(contentTypeFor("a/logo.svg")).toBe("image/svg+xml");
    expect(contentTypeFor("a/photo.avif")).toBe("image/avif");
  });

  it("falls back to a byte stream rather than guessing", () => {
    expect(contentTypeFor("a/mystery.xyz")).toBe("application/octet-stream");
  });
});

describe("basicAuthOk", () => {
  const expected = "distribute:s3cret";
  const header = `Basic ${Buffer.from(expected).toString("base64")}`;

  it("accepts the configured pair", () => {
    expect(basicAuthOk(header, expected)).toBe(true);
    expect(basicAuthOk(header.replace("Basic", "basic"), expected)).toBe(true);
  });

  it("rejects a wrong pair, a malformed header, and no header", () => {
    expect(basicAuthOk(`Basic ${Buffer.from("distribute:wrong").toString("base64")}`, expected)).toBe(false);
    expect(basicAuthOk("Basic !!!not-base64!!!", expected)).toBe(false);
    expect(basicAuthOk("Bearer token", expected)).toBe(false);
    expect(basicAuthOk(null, expected)).toBe(false);
  });

  it("LOCKS the clones when the secret is unset", () => {
    // An unset variable must never open a competitor's copy to the internet.
    expect(basicAuthOk(header, undefined)).toBe(false);
    expect(basicAuthOk(header, "")).toBe(false);
    expect(basicAuthOk(header, "no-colon")).toBe(false);
  });
});

describe("the catalogue matches what is on disk", () => {
  it("names slugs a host can carry, once each", () => {
    const slugs = CLONES.map((clone) => clone.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("starts every clone as an unmodified copy", () => {
    // The whole point at t=0. A clone becomes ours deliberately, never by default.
    for (const clone of CLONES) {
      expect(clone.brandised).toBe(false);
      expect(clone.source).toMatch(/^https:\/\//);
    }
  });

  it("carries no page of our own", () => {
    // `lab-distribute` hosted the landing that now serves at `/`; it was promoted into
    // `public/landing/index-v2.html` and retired here, so the catalogue is competitor
    // photographs again and nothing more. A page of ours served through the clone
    // machinery is behind a password and noindex — the wrong home for anything live.
    expect(cloneSlugForHost("lab-distribute.distribute.you")).toBeNull();
    expect(existsSync(path.join(CLONES_DIR, "distribute"))).toBe(false);
  });

  it("states which hosts a clone rapatriated, and mirrors them on disk", () => {
    // Non-empty is the one sanctioned exception to leaving the bytes alone, so it is
    // recorded rather than inferred — and the directory has to actually be there.
    for (const clone of CLONES) {
      expect(Array.isArray(clone.localisedHosts)).toBe(true);
      for (const host of clone.localisedHosts) {
        expect(host).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
        const dir = path.join(CLONES_DIR, clone.slug, EXTERNAL_DIR, host);
        expect(existsSync(dir), `${clone.slug} claims ${host} but ${EXTERNAL_DIR}/${host} is missing`).toBe(true);
      }
    }
  });

  it("has files for every entry", () => {
    for (const clone of CLONES) {
      const index = path.join(CLONES_DIR, clone.slug, "index.html");
      expect(existsSync(index), `${clone.slug}/index.html is missing`).toBe(true);
      expect(statSync(index).size).toBeGreaterThan(1000);
    }
  });

  it("spells the host the same way in the scripts as in the app", () => {
    // The capture and verify scripts run under plain node and cannot import the TypeScript
    // catalogue, so they keep their own copy of these two. A drift would point them at a
    // host nothing serves.
    expect(SCRIPT_HOST_PREFIX).toBe(CLONE_HOST_PREFIX);
    expect(SCRIPT_HOST_SUFFIX).toBe(CLONE_HOST_SUFFIX);
  });

  it("resolves each entry by slug", () => {
    for (const clone of CLONES) expect(cloneFor(clone.slug)?.source).toBe(clone.source);
    expect(cloneFor("nope")).toBeNull();
  });
});

describe("the serving surface", () => {
  const proxy = readFileSync(path.join(REPO_APP, "src/proxy.ts"), "utf8");
  const route = readFileSync(
    path.join(REPO_APP, "src/app/internal-clone/[slug]/[[...path]]/route.ts"),
    "utf8",
  );

  it("leaves an ordinary landing request before doing any work", () => {
    // This file runs on EVERY request the landing serves. The host check is the first
    // statement of the function and nothing may be added above it.
    const body = proxy.slice(proxy.indexOf("export default function proxy("));
    const firstStatement = body.indexOf("const slug = cloneSlugForHost(");
    const earlyReturn = body.indexOf("if (slug === null) return offCloneHost(request);");
    expect(firstStatement).toBeGreaterThan(-1);
    expect(earlyReturn).toBeGreaterThan(firstStatement);
    expect(body.slice(0, firstStatement)).not.toMatch(/await|readFile|fetch\(/);
  });

  it("tells crawlers to stay away before it asks for the password", () => {
    const robots = proxy.indexOf('"/robots.txt"');
    const auth = proxy.indexOf("basicAuthOk(");
    expect(robots).toBeGreaterThan(-1);
    expect(robots).toBeLessThan(auth);
    expect(proxy).toContain("Disallow: /");
  });

  it("locks every clone host behind the password", () => {
    expect(proxy).toContain("www-authenticate");
    expect(proxy).toContain("CLONE_BASIC_AUTH");
  });

  it("never lets a clone response be indexed or shared-cached", () => {
    const headerBlocks = route.match(/"x-robots-tag": "noindex, nofollow"/g) ?? [];
    // Every response shape the route can emit: the 404 and the served file.
    expect(headerBlocks.length).toBeGreaterThanOrEqual(2);
    expect(route).toContain('"cache-control": "no-store"');
  });

  it("closes the internal route on every host that is not a clone", () => {
    // The rewrite target has to be routable, so it is addressable too — and reaching it
    // on distribute.you would be a second door onto the clones with no password on it.
    // (`_clone` was the first attempt and is a PRIVATE app-router folder: excluded from
    // routing, so every rewrite onto it fell through to the 404 page.)
    expect(CLONE_ROUTE_PREFIX.startsWith("/_")).toBe(false);
    expect(proxy).toContain("function offCloneHost(");
    const guard = proxy.slice(proxy.indexOf("function offCloneHost("));
    expect(guard).toContain("startsWith(CLONE_ROUTE_PREFIX)");
    expect(guard).toContain("status: 404");
  });

  it("serves the origin's bytes and injects nothing of ours", () => {
    // `staticResponse()` exists to rewrite our own pages — tokens, Organization JSON-LD,
    // analytics. A clone must reach the browser exactly as the origin sent it.
    expect(route).not.toContain("staticResponse");
    expect(route).not.toContain("analyticsHead");
    expect(route).not.toContain("withCanonicalOrganization");
  });
});
