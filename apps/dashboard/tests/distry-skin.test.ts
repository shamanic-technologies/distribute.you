import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { wearsDistrySkin } from "../src/components/v2/get-started/distry-skin";

const APP = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(APP, p), "utf8");

describe("the Distry skin on the sign-up walk is a private switch", () => {
  it("is off for every visitor who did not ask for it", () => {
    expect(wearsDistrySkin(null, undefined)).toBe(false);
    expect(wearsDistrySkin(null, "off")).toBe(false);
    expect(wearsDistrySkin(null, "anything")).toBe(false);
  });

  it("turns on by the query or the remembered cookie, and off by the query", () => {
    expect(wearsDistrySkin("distry", undefined)).toBe(true);
    expect(wearsDistrySkin(null, "distry")).toBe(true);
    expect(wearsDistrySkin("off", "distry")).toBe(false);
  });

  it("is rendered by the page only behind that switch", () => {
    const page = read("src/app/(authed)/get-started/page.tsx");
    expect(page).toContain("wearsDistrySkin(skinQuery");
    expect(page).toContain("{skin ? <DistrySkin />");
  });

  it("ships every file the skin loads, and the script is the landing's", () => {
    const skin = read("src/components/v2/get-started/distry-skin.tsx");
    const css = read("public/distry/get-started.css");
    const refs = new Set<string>();
    for (const source of [skin, css]) for (const m of source.matchAll(/\/distry\/([A-Za-z0-9._/-]+\.[a-z0-9]+)/g)) refs.add(m[1]);
    expect(refs.size).toBeGreaterThan(2);
    for (const ref of refs) expect(existsSync(path.join(APP, "public/distry", ref)), ref).toBe(true);
    // One motion script for both apps: a fix lands in both or in neither.
    expect(read("public/distry/distry.js")).toBe(readFileSync(path.join(APP, "../landing/public/landing/distry/distry.js"), "utf8"));
  });

  it("carries no floating envelopes and no Distry bubble (owner 2026-11-27: « on n'a pas 5 ans »)", () => {
    const skin = read("src/components/v2/get-started/distry-skin.tsx");
    expect(skin).not.toContain('id="fireflies"');
    expect(skin).not.toContain('id="buddy"');
    expect(read("public/distry/distry.js")).not.toContain("f.letter");
  });
});
