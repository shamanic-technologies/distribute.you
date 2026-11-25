import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { archiveSlugForHost } from "@/lib/archive-catalogue";
import { cloneSlugForHost } from "@/lib/clone-catalogue";
import {
  PROTOTYPES,
  PROTOTYPE_ROUTE_PREFIX,
  byteRangeFor,
  prototypeFor,
  prototypeSlugForHost,
} from "@/lib/prototype-catalogue";

const REPO_APP = path.resolve(__dirname, "../..");
const PROTOTYPES_DIR = path.join(REPO_APP, "prototypes");

function read(relative: string): string {
  return readFileSync(path.join(REPO_APP, relative), "utf8");
}

function filesUnder(root: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(root, prefix))) {
    const relative = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(path.join(root, relative)).isDirectory()) out.push(...filesUnder(root, relative));
    else out.push(relative);
  }
  return out;
}

describe("prototypeSlugForHost", () => {
  it("resolves a catalogued prototype host", () => {
    expect(prototypeSlugForHost("lab-distry.distribute.you")).toBe("distry");
    expect(prototypeSlugForHost("LAB-Distry.Distribute.You:3000")).toBe("distry");
  });

  it("leaves every ordinary host and every made-up lab host alone", () => {
    for (const host of ["distribute.you", "dashboard.distribute.you", "localhost:3000", "", null, undefined]) {
      expect(prototypeSlugForHost(host)).toBeNull();
    }
    expect(prototypeSlugForHost("lab-anything.distribute.you")).toBeNull();
    expect(prototypeSlugForHost("lab-distry.evil.com")).toBeNull();
  });

  it("shares no slug with a clone or an archive", () => {
    // The proxy resolves clones, then archives, then prototypes: a shared slug would be
    // served from the wrong directory without anyone noticing.
    for (const prototype of PROTOTYPES) {
      const host = `lab-${prototype.slug}.distribute.you`;
      expect(cloneSlugForHost(host)).toBeNull();
      expect(archiveSlugForHost(host)).toBeNull();
      expect(prototype.slug).toMatch(/^[a-z0-9-]+$/);
      expect(prototypeFor(prototype.slug)).toBe(prototype);
    }
    expect(prototypeFor("nope")).toBeNull();
  });
});

describe("a prototype is gated like every lab host", () => {
  const proxy = read("src/proxy.ts");

  it("goes through the one lab gate (password, robots) before anything is served", () => {
    expect(proxy).toContain("prototypeSlugForHost(host)");
    const serve = proxy.slice(proxy.indexOf("function servePrototype("), proxy.indexOf("function labGate("));
    // Index compare: the gate must come before every way out of the function.
    expect(serve.indexOf("labGate(request")).toBeGreaterThan(-1);
    expect(serve.indexOf("labGate(request")).toBeLessThan(serve.indexOf("NextResponse.next("));
    expect(serve.indexOf("labGate(request")).toBeLessThan(serve.indexOf("NextResponse.rewrite("));
  });

  it("closes the skin route on every other host", () => {
    const offLab = proxy.slice(proxy.indexOf("function offLabHost("));
    expect(offLab).toContain("pathname.startsWith(SKIN_ROUTE_PREFIX)");
  });

  it("closes the internal route on every other host", () => {
    // Routable means addressable: without this the prototype has a password-free door.
    const offLab = proxy.slice(proxy.indexOf("function offLabHost("));
    expect(offLab).toContain("pathname.startsWith(PROTOTYPE_ROUTE_PREFIX)");
    expect(PROTOTYPE_ROUTE_PREFIX).toBe("/internal-prototype");
    expect(existsSync(path.join(REPO_APP, "src/app/internal-prototype/[slug]/[[...path]]/route.ts"))).toBe(true);
  });

  it("is copied into the image", () => {
    // Nothing imports the directory, so Next's tracing never sees it.
    expect(read("Dockerfile")).toContain("/repo/apps/landing/prototypes ./apps/landing/prototypes");
  });

  it("wears the live menu, footer and figures, never the analytics head", () => {
    const route = read("src/app/internal-prototype/[slug]/[[...path]]/route.ts");
    expect(route).toContain("withSiteChrome(");
    expect(route).toContain("withLiveFigures(");
    for (const banned of ["staticResponse", "renderedResponse", "decorateHtml", "analyticsHead"]) {
      expect(route, banned).not.toContain(banned);
    }
    expect(route).toContain('"x-robots-tag": "noindex, nofollow"');
    expect(route).toContain('"cache-control": "no-store"');
  });
});

describe("every prototype is on disk, with every file it references", () => {
  // The prototype's page lives outside `public/` (behind the password); its stylesheet,
  // script and pictures are the shared skin's, under `public/landing/distry/`.
  const SKIN_DIR = path.join(REPO_APP, "public/landing/distry");

  it("has an index and every local file it references", () => {
    for (const prototype of PROTOTYPES) {
      const index = path.join(PROTOTYPES_DIR, prototype.slug, "index.html");
      expect(existsSync(index), `${prototype.slug}/index.html is missing`).toBe(true);
      const html = readFileSync(index, "utf8");
      expect(html.length).toBeGreaterThan(1000);
      expect(html).toContain('name="robots" content="noindex, nofollow"');

      const sources = [html, ...filesUnder(SKIN_DIR).filter((f) => /\.(css|js)$/.test(f)).map((f) => readFileSync(path.join(SKIN_DIR, f), "utf8"))];
      const refs = new Set<string>();
      for (const source of sources) {
        for (const match of source.matchAll(/["'( ]\/landing\/distry\/([A-Za-z0-9._/-]+\.[a-z0-9]+)/g)) refs.add(match[1]);
      }
      expect(refs.size).toBeGreaterThan(5);
      for (const ref of refs) {
        expect(existsSync(path.join(SKIN_DIR, ref)), `/landing/distry/${ref} is referenced but not on disk`).toBe(true);
      }
    }
  });

  it("keeps the image weight a visitor can wait for", () => {
    for (const file of filesUnder(SKIN_DIR)) {
      const limit = /\.(mp4|webm)$/.test(file) ? 6_000_000 : 900_000;
      expect(statSync(path.join(SKIN_DIR, file)).size, file).toBeLessThan(limit);
    }
  });
});

describe("byteRangeFor", () => {
  it("reads the ranges a video element sends", () => {
    expect(byteRangeFor("bytes=0-", 1000)).toEqual({ start: 0, end: 999 });
    expect(byteRangeFor("bytes=0-1", 1000)).toEqual({ start: 0, end: 1 });
    expect(byteRangeFor("bytes=500-", 1000)).toEqual({ start: 500, end: 999 });
    expect(byteRangeFor("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
    expect(byteRangeFor("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
  });

  it("answers the whole file for anything else", () => {
    for (const header of [null, "", "bytes=-", "bytes=abc-", "bytes=1000-", "bytes=5-2", "items=0-5", "bytes=0-1,5-6", "bytes=-0"]) {
      expect(byteRangeFor(header, 1000)).toBeNull();
    }
  });
});

describe("the Distry home wears the live site's chrome and figures", () => {
  const html = read("prototypes/distry/index.html");

  it("draws the real menu and footer from the page catalogue", async () => {
    const { withSiteChrome, navHtml } = await import("@/lib/site-chrome");
    expect(html).toContain("<!--site-nav-->");
    expect(html).toContain("<!--site-footer-->");
    const out = withSiteChrome(html, "/");
    expect(out).not.toContain("<!--site-nav-->");
    expect(out).toContain(navHtml("/"));
    expect(out).toContain('data-footer="home"');
  });

  it("states the homepage's client figures under the keys the live pass reseeds", async () => {
    const { reseedProofCards, reseedShowcaseCards } = await import("@/lib/showcase-outcomes");
    const { reseedFounderCount } = await import("@/lib/founder-count");
    const payload = {
      brands: [
        {
          brand: { id: "b-1", name: "Doc Dinners", domain: "docdinners.com" },
          outcomes: [
            { key: "contacted", label: "contacted", peopleReached: 20001, costPerReachUsd: null },
            { key: "conversation", label: "conversation", peopleReached: 41, costPerReachUsd: 71 },
            { key: "meeting_booked", label: "meeting", peopleReached: 4, costPerReachUsd: null },
          ],
          measured: true,
          unmeasuredReason: null,
        },
      ],
    };
    // The lab home ships no proof card (price cards stand there, owner 2026-11-25): the proof reseed is a no-op.
    expect(reseedProofCards(html, payload)).toBe(html);
    // Its client cards state meetings booked only, and the reseed keeps to the cell on screen.
    const hero = reseedShowcaseCards(html, payload);
    expect(hero).toContain('data-brand="docdinners.com" data-steps="4"');
    expect(html).toContain('<div class="showcase-grid" id="live-cards">');
    expect(html).toContain('<a class="show-card yours"');
    expect(reseedFounderCount(html, 237)).toContain("Loved by 230+ founders");
  });
});
