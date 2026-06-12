import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { focusManager } from "@tanstack/react-query";
import {
  computeFocused,
  installIdleFocusManager,
} from "../src/lib/idle-focus-manager";

describe("computeFocused", () => {
  it("focused only when visible AND not idle", () => {
    expect(computeFocused("visible", false)).toBe(true);
    expect(computeFocused("visible", true)).toBe(false);
    expect(computeFocused("hidden", false)).toBe(false);
    expect(computeFocused("hidden", true)).toBe(false);
  });
});

type Handlers = Record<string, Set<() => void>>;

function makeTarget() {
  const handlers: Handlers = {};
  return {
    handlers,
    addEventListener: (type: string, h: () => void) => {
      (handlers[type] ??= new Set()).add(h);
    },
    removeEventListener: (type: string, h: () => void) => {
      handlers[type]?.delete(h);
    },
    dispatch: (type: string) => handlers[type]?.forEach((h) => h()),
  };
}

describe("installIdleFocusManager", () => {
  let teardown: () => void;
  let win: ReturnType<typeof makeTarget>;
  let doc: ReturnType<typeof makeTarget> & { visibilityState: string };

  beforeEach(() => {
    vi.useFakeTimers();
    win = makeTarget();
    doc = Object.assign(makeTarget(), { visibilityState: "visible" });
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
  });

  afterEach(() => {
    teardown?.();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllTimers();
    focusManager.setEventListener(() => () => {});
  });

  it("is focused initially, goes unfocused after the idle timeout, refocuses on activity", () => {
    teardown = installIdleFocusManager(2000);
    expect(focusManager.isFocused()).toBe(true);

    // No interaction for the idle window → unfocused (polling pauses).
    vi.advanceTimersByTime(2000);
    expect(focusManager.isFocused()).toBe(false);

    // User moves the mouse → focused again (polling resumes).
    win.dispatch("mousemove");
    expect(focusManager.isFocused()).toBe(true);
  });

  it("goes unfocused when the tab is hidden even while active", () => {
    teardown = installIdleFocusManager(2000);
    expect(focusManager.isFocused()).toBe(true);

    doc.visibilityState = "hidden";
    doc.dispatch("visibilitychange");
    expect(focusManager.isFocused()).toBe(false);

    // Returning to the tab restores focus.
    doc.visibilityState = "visible";
    doc.dispatch("visibilitychange");
    expect(focusManager.isFocused()).toBe(true);
  });
});
