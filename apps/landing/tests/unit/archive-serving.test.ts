import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ARCHIVES,
  ARCHIVE_HOST_PREFIX,
  ARCHIVE_HOST_SUFFIX,
  ARCHIVE_ROUTE_PREFIX,
  archiveFor,
  archiveSlugForHost,
} from "@/lib/archive-catalogue";
import { clonePathFor } from "@/lib/clone-files";

const REPO_APP = path.resolve(__dirname, "../..");
const ARCHIVES_DIR = path.join(REPO_APP, "archives");

function read(relative: string): string {
  return readFileSync(path.join(REPO_APP, relative), "utf8");
}

/** Every stored file of an archive, relative to its root. */
function filesUnder(root: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(root, prefix))) {
    const relative = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(path.join(root, relative)).isDirectory()) out.push(...filesUnder(root, relative));
    else out.push(relative);
  }
  return out;
}

describe("archiveSlugForHost", () => {
  it("resolves a catalogued archive host", () => {
    expect(archiveSlugForHost("lab-2026-06-15.distribute.you")).toBe("2026-06-15");
    expect(archiveSlugForHost("LAB-2026-06-15.Distribute.You")).toBe("2026-06-15");
    expect(archiveSlugForHost("lab-2026-06-15.distribute.you:3000")).toBe("2026-06-15");
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
      expect(archiveSlugForHost(host)).toBeNull();
    }
  });

  it("refuses a host whose slug is not in the catalogue", () => {
    // The allowlist is what stops a guessed host from reaching a directory read — a date
    // is an especially guessable slug.
    expect(archiveSlugForHost("lab-2026-06-16.distribute.you")).toBeNull();
    expect(archiveSlugForHost("lab-2020-01-01.distribute.you")).toBeNull();
    expect(archiveSlugForHost("lab-.distribute.you")).toBeNull();
    expect(archiveSlugForHost("lab-2026-06-15.evil.com")).toBeNull();
  });

  it("shares the host family with the clones and collides with none of them", () => {
    const clones = readdirSync(path.join(REPO_APP, "clones")).filter((entry) =>
      statSync(path.join(REPO_APP, "clones", entry)).isDirectory(),
    );
    for (const archive of ARCHIVES) expect(clones).not.toContain(archive.slug);
    expect(ARCHIVE_HOST_PREFIX).toBe("lab-");
    expect(ARCHIVE_HOST_SUFFIX).toBe(".distribute.you");
  });
});

describe("the catalogue", () => {
  it("has files on disk for every entry", () => {
    // A host that resolves and 404s its way through the whole site reads as a broken
    // capture rather than as a missing directory.
    for (const archive of ARCHIVES) {
      const root = path.join(ARCHIVES_DIR, archive.slug);
      expect(existsSync(root), `${archive.slug} has no directory`).toBe(true);
      expect(existsSync(path.join(root, "index.html")), `${archive.slug} has no home page`).toBe(
        true,
      );
    }
  });

  it("pins the commit each archive was taken from, and the day it was live", () => {
    // An archive is rebuildable rather than hand-curated: the commit is what
    // scripts/capture-archive.mjs reads, so a question about what is in here is answered
    // by re-running it.
    for (const archive of ARCHIVES) {
      expect(archive.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(archive.servedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(archive.slug).toBe(archive.servedOn);
      expect(archive.note.length).toBeGreaterThan(0);
      expect(archive.departures.length).toBeGreaterThan(0);
    }
  });

  it("is the only thing the capture script will rebuild", () => {
    // The script holds its own recipes because it answers how an archive was BUILT while
    // the catalogue answers what is SERVED. The slugs must still agree, or a re-capture
    // writes a directory nothing serves.
    const script = read("scripts/capture-archive.mjs");
    for (const archive of ARCHIVES) {
      expect(script).toContain(`"${archive.slug}"`);
      expect(script).toContain(archive.commit);
    }
  });

  it("answers by slug", () => {
    for (const archive of ARCHIVES) expect(archiveFor(archive.slug)?.commit).toBe(archive.commit);
    expect(archiveFor("nope")).toBeNull();
  });
});

describe("the 2026-06-15 capture", () => {
  const root = path.join(ARCHIVES_DIR, "2026-06-15");
  const pages = filesUnder(root).filter((file) => file.endsWith(".html"));

  it("carries every page the commit served, reachable at the URL it served it from", () => {
    // The capture read the route handlers themselves, so this is the count they produced.
    // Each URL is walked through the SAME reader the route uses — a disagreement here is
    // a 404 on a page sitting on disk.
    expect(pages.length).toBe(22);
    for (const url of ["/", "/pro", "/agency", "/pricing", "/performance", "/how-it-works", "/use-cases"]) {
      const stored = clonePathFor(url);
      expect(stored).not.toBeNull();
      expect(existsSync(path.join(root, stored as string)), `${url} unreachable`).toBe(true);
    }
    for (const url of [
      "/cold-email-cost-guide",
      "/cold-email-cost-guide/cold-email-roi",
      "/cold-email-for-saas-founders/b2b-cold-email-reply-rate",
      "/cold-email-vs-linkedin/multichannel-outreach-strategy",
    ]) {
      expect(existsSync(path.join(root, clonePathFor(url) as string)), `${url} unreachable`).toBe(
        true,
      );
    }
  });

  it("renders without its own server: no relative asset reference survives", () => {
    // Every page referenced `css/styles.css` RELATIVELY and only rendered because the
    // handler rewrote it per request. On a sub-page that resolves one directory too deep,
    // so raw bytes would serve 15 of 22 pages unstyled.
    for (const page of pages) {
      const html = readFileSync(path.join(root, page), "utf8");
      expect(html, page).not.toMatch(/(href|src)="(css|js|logo)\//);
      expect(html, page).toContain('href="/landing/css/styles.css"');
    }
    for (const asset of ["landing/css/styles.css", "landing/js/components.js", "landing/js/main.js"]) {
      expect(existsSync(path.join(root, asset)), asset).toBe(true);
    }
  });

  it("states a figure rather than the token that fetched it", () => {
    // A raw token renders as __OPEN_RATE__ on the page; a figure fetched today is this
    // year's number printed on last year's page. The capture bakes the handler's own
    // last-known-good constants, which is what it served whenever the API was down.
    for (const page of pages) {
      expect(readFileSync(path.join(root, page), "utf8"), page).not.toMatch(/__[A-Z_]+__/);
    }
    expect(readFileSync(path.join(root, "performance/index.html"), "utf8")).toContain("$1.42");
  });

  it("reports into none of our analytics", () => {
    // The handler injected these three into every page it served. An archive that
    // reported into them would write today's browsing into the record of a date that is
    // over. The pages' OWN GTM container is a different thing and is kept as shipped: it
    // was never configured, so it reports to nothing, and removing it would be editing
    // the photograph.
    for (const page of pages) {
      const html = readFileSync(path.join(root, page), "utf8");
      expect(html, page).not.toContain("G-YJHNGLEJPP");
      expect(html, page).not.toContain("AW-18233267088");
      expect(html, page).not.toContain("posthog");
    }
  });
});

describe("the serving surface", () => {
  const proxy = read("src/proxy.ts");
  const route = read("src/app/internal-archive/[slug]/[[...path]]/route.ts");

  it("leaves an ordinary landing request before doing any work", () => {
    // This file runs on EVERY request the landing serves. Both host checks bail on the
    // same `lab-` prefix, and nothing may be added above them.
    const body = proxy.slice(proxy.indexOf("export default function proxy("));
    const readHost = body.indexOf('request.headers.get("host")');
    const archiveCheck = body.indexOf("archiveSlugForHost(host)");
    const exit = body.indexOf("return offLabHost(request);");
    expect(readHost).toBeGreaterThan(-1);
    expect(archiveCheck).toBeGreaterThan(readHost);
    expect(exit).toBeGreaterThan(archiveCheck);
    expect(body.slice(0, exit)).not.toMatch(/await|readFile|fetch\(/);
  });

  it("puts an archive behind the same password as a clone", () => {
    // One gate for the whole lab host family: a second copy is a second place for the
    // password to be forgotten, and the archive is the copy that would forget it.
    const gate = proxy.slice(proxy.indexOf("function serveLab("));
    expect(gate).toContain("CLONE_BASIC_AUTH");
    expect(gate).toContain("www-authenticate");
    const robots = gate.indexOf('"/robots.txt"');
    const auth = gate.indexOf("basicAuthOk(");
    expect(robots).toBeGreaterThan(-1);
    expect(robots).toBeLessThan(auth);
  });

  it("closes the internal route on every host that is not a lab host", () => {
    // The rewrite target has to be routable, so it is addressable too — and reaching it
    // on distribute.you would serve a retired claim of ours with no password on it.
    expect(ARCHIVE_ROUTE_PREFIX.startsWith("/_")).toBe(false);
    expect(ARCHIVE_ROUTE_PREFIX).not.toBe("/internal-clone");
    const guard = proxy.slice(proxy.indexOf("function offLabHost("));
    expect(guard).toContain("startsWith(ARCHIVE_ROUTE_PREFIX)");
    expect(guard).toContain("status: 404");
  });

  it("serves the archived bytes and injects nothing of today's", () => {
    // `staticResponse()` exists to rewrite the LIVE pages — tokens, Organization JSON-LD,
    // analytics. Applying any of it to a page from a date that is over would make the
    // archive lie about that date.
    expect(route).not.toContain("staticResponse");
    expect(route).not.toContain("analyticsHead");
    expect(route).not.toContain("withCanonicalOrganization");
    expect(route).not.toContain("withLivePerformanceMetrics");
  });

  it("never lets an archived response be indexed or shared-cached", () => {
    const headerBlocks = route.match(/"x-robots-tag": "noindex, nofollow"/g) ?? [];
    // Every response shape the route can emit: the 404 and the served file.
    expect(headerBlocks.length).toBeGreaterThanOrEqual(2);
    expect(route).toContain('"cache-control": "no-store"');
  });

  it("is carried into the image, which nothing else would do", () => {
    // Nothing imports the archives, so Next's file tracing never sees them and the
    // standalone output does not carry them — without the COPY the host 404s on every
    // path while the container is otherwise healthy.
    expect(read("Dockerfile")).toContain("/repo/apps/landing/archives ./apps/landing/archives");
  });
});
