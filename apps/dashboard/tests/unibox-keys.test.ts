import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { uniboxKeyAction, type UniboxKeyInput } from "../src/lib/unibox-keys";

const base: UniboxKeyInput = { key: "", typing: false, inSearch: false, modified: false, pane: "list", hasOpen: true, openIndex: 3, count: 10 };
const press = (key: string, over: Partial<UniboxKeyInput> = {}) => uniboxKeyAction({ ...base, key, ...over });

describe("Unibox keyboard (owner 2026-10-10)", () => {
  it("Up/Down in the list open the previous/next person from the one open", () => {
    expect(press("ArrowDown")).toEqual({ type: "open", index: 4 });
    expect(press("ArrowUp")).toEqual({ type: "open", index: 2 });
    expect(press("j")).toEqual({ type: "open", index: 4 });
    expect(press("k")).toEqual({ type: "open", index: 2 });
  });

  it("stops at both ends, and starts at the top when nobody is open", () => {
    expect(press("ArrowUp", { openIndex: 0 })).toBeNull();
    expect(press("ArrowDown", { openIndex: 9 })).toBeNull();
    expect(press("ArrowDown", { openIndex: -1 })).toEqual({ type: "open", index: 0 });
  });

  it("Right goes to the thread, Left back to the list", () => {
    expect(press("ArrowRight")).toEqual({ type: "pane", pane: "thread" });
    expect(press("ArrowRight", { hasOpen: false, openIndex: -1 })).toBeNull();
    // A shared link can open someone beyond the pages loaded so far: the thread is still theirs.
    expect(press("ArrowRight", { hasOpen: true, openIndex: -1 })).toEqual({ type: "pane", pane: "thread" });
    expect(press("ArrowLeft", { pane: "thread" })).toEqual({ type: "pane", pane: "list" });
  });

  it("Up/Down in the thread scroll it and never change the person", () => {
    expect(press("ArrowDown", { pane: "thread" })).toEqual({ type: "scroll", direction: 1 });
    expect(press("ArrowUp", { pane: "thread" })).toEqual({ type: "scroll", direction: -1 });
  });

  it("leaves typing and modified keys alone; Down from the search opens the first person", () => {
    expect(press("ArrowDown", { typing: true })).toBeNull();
    expect(press("ArrowDown", { modified: true })).toBeNull();
    expect(press("ArrowDown", { typing: true, inSearch: true })).toEqual({ type: "open", index: 0 });
    expect(press("/")).toEqual({ type: "search" });
  });

  it("the Unibox uses this keyboard, not the shared cursor-only row keys", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/integrations-conversations.tsx"), "utf8");
    expect(src).toContain("uniboxKeyAction(");
    expect(src).not.toContain("useRowKeys(");
  });
});
