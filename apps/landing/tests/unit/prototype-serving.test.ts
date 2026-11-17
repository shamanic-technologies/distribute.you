import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { archiveSlugForHost } from "@/lib/archive-catalogue";
import { cloneSlugForHost } from "@/lib/clone-catalogue";
import { clonePathFor } from "@/lib/clone-files";
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

  it("goes through the one lab gate (password, robots, rewrite)", () => {
    expect(proxy).toContain("prototypeSlugForHost(host)");
    expect(proxy).toContain("serveLab(request, `${PROTOTYPE_ROUTE_PREFIX}/${prototype}`");
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

  it("never reaches the live page pipeline", () => {
    const route = read("src/app/internal-prototype/[slug]/[[...path]]/route.ts");
    expect(route).not.toContain("static-html");
    expect(route).toContain('"x-robots-tag": "noindex, nofollow"');
    expect(route).toContain('"cache-control": "no-store"');
  });
});

describe("every prototype is on disk and self-contained", () => {
  it("has an index and every local file it references", () => {
    for (const prototype of PROTOTYPES) {
      const root = path.join(PROTOTYPES_DIR, prototype.slug);
      const index = path.join(root, "index.html");
      expect(existsSync(index), `${prototype.slug}/index.html is missing`).toBe(true);
      const html = readFileSync(index, "utf8");
      expect(html.length).toBeGreaterThan(1000);
      expect(html).toContain('name="robots" content="noindex, nofollow"');

      const sources = [html, ...filesUnder(root).filter((f) => /\.(css|js)$/.test(f)).map((f) => readFileSync(path.join(root, f), "utf8"))];
      const refs = new Set<string>();
      for (const source of sources) {
        for (const match of source.matchAll(/["'(]\/(assets\/[A-Za-z0-9._/-]+|[a-z-]+\.(?:css|js))[?"')]/g)) refs.add(match[1]);
      }
      expect(refs.size).toBeGreaterThan(5);
      for (const ref of refs) {
        const relative = clonePathFor(`/${ref}`);
        expect(relative, ref).not.toBeNull();
        expect(existsSync(path.join(root, relative!)), `${prototype.slug} references /${ref}, which is not on disk`).toBe(true);
      }
    }
  });

  it("keeps the image weight a visitor can wait for", () => {
    for (const prototype of PROTOTYPES) {
      const root = path.join(PROTOTYPES_DIR, prototype.slug);
      for (const file of filesUnder(root)) {
        const limit = /\.(mp4|webm)$/.test(file) ? 6_000_000 : 900_000;
        expect(statSync(path.join(root, file)).size, file).toBeLessThan(limit);
      }
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
