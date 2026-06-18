import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  isSessionNotFoundError,
  clearStoredSession,
  SESSION_NOT_FOUND_NOTICE,
} from "../src/lib/chat-session";

const SRC = path.resolve(__dirname, "..");

/**
 * In-memory localStorage shim — the dashboard tests run in plain Node
 * without jsdom, so we install a minimal global to exercise clearStoredSession.
 */
function installLocalStorageShim() {
  const store = new Map<string, string>();
  const shim = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  vi.stubGlobal("localStorage", shim);
  return shim;
}

describe("chat-session helpers", () => {
  beforeEach(() => {
    installLocalStorageShim();
  });

  describe("isSessionNotFoundError", () => {
    it("returns true for session_not_found code", () => {
      expect(
        isSessionNotFoundError({ code: "session_not_found", message: "x" }),
      ).toBe(true);
    });

    it("returns false for other error codes", () => {
      expect(
        isSessionNotFoundError({ code: "rate_limited", message: "x" }),
      ).toBe(false);
      expect(
        isSessionNotFoundError({ code: "model_overloaded", message: "x" }),
      ).toBe(false);
    });

    it("returns false for null / undefined", () => {
      expect(isSessionNotFoundError(null)).toBe(false);
      expect(isSessionNotFoundError(undefined)).toBe(false);
    });
  });

  describe("clearStoredSession", () => {
    it("removes the given key from localStorage", () => {
      localStorage.setItem("workflow-chat-session:abc", "sess-123");
      clearStoredSession("workflow-chat-session:abc");
      expect(localStorage.getItem("workflow-chat-session:abc")).toBeNull();
    });

    it("does not throw when key does not exist", () => {
      expect(() => clearStoredSession("nonexistent")).not.toThrow();
    });
  });

  it("exposes a non-empty toast notice constant", () => {
    expect(SESSION_NOT_FOUND_NOTICE.length).toBeGreaterThan(0);
    expect(SESSION_NOT_FOUND_NOTICE.toLowerCase()).toContain("session");
  });
});

describe("chat components wire session_not_found recovery", () => {
  const components = [
    "src/components/workflows/workflow-chat.tsx",
    "src/components/press-kits/press-kit-chat.tsx",
  ];

  for (const rel of components) {
    describe(rel, () => {
      const src = fs.readFileSync(path.join(SRC, rel), "utf-8");

      it("imports session helpers from @/lib/chat-session", () => {
        expect(src).toMatch(/from\s+["']@\/lib\/chat-session["']/);
      });

      it("calls isSessionNotFoundError on data-error-info events", () => {
        expect(src).toContain("isSessionNotFoundError");
      });

      it("clears the stored session on session_not_found", () => {
        expect(src).toContain("clearStoredSession");
      });

      it("renders the session reset notice constant", () => {
        expect(src).toContain("SESSION_NOT_FOUND_NOTICE");
      });
    });
  }
});
