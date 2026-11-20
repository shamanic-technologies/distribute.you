import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COPILOT_SNAPSHOT_MAX_CHARS,
  clearCopilotSnapshot,
  copilotSnapshotKey,
  readCopilotSnapshot,
  userIdFromSessionCookie,
  writeCopilotSnapshot,
} from "../src/lib/copilot-snapshot";

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const jwt = (sub: string) => `${b64url({ alg: "RS256" })}.${b64url({ sub, sid: "sess_1" })}.sig`;

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}

const KEY = "copilot-session:org_1:user_1:brand_1";
const history = { sessionId: "s1", brandIds: ["brand_1"], messages: [{ role: "user", content: "hi" }], hasOlder: false };

describe("Copilot saved conversation (MON-PAGE-SPEED-ROOT-1120)", () => {
  it("round-trips the conversation under the user-scoped key", () => {
    const st = memoryStorage();
    expect(writeCopilotSnapshot(st, KEY, history)).toBe(true);
    expect([...st.m.keys()]).toEqual([copilotSnapshotKey(KEY)]);
    expect(readCopilotSnapshot(st, KEY)).toEqual(history);
  });

  it("keeps nothing without a signed-in user key", () => {
    const st = memoryStorage();
    expect(writeCopilotSnapshot(st, null, history)).toBe(false);
    expect(readCopilotSnapshot(st, null)).toBeNull();
    expect(st.m.size).toBe(0);
  });

  it("drops a copy over the cap instead of keeping a stale one", () => {
    const st = memoryStorage();
    writeCopilotSnapshot(st, KEY, history);
    const big = { ...history, messages: [{ role: "user", content: "x".repeat(COPILOT_SNAPSHOT_MAX_CHARS) }] };
    expect(writeCopilotSnapshot(st, KEY, big)).toBe(false);
    expect(readCopilotSnapshot(st, KEY)).toBeNull();
  });

  it("an unreadable copy reads as none, loudly", () => {
    const st = memoryStorage();
    st.setItem(copilotSnapshotKey(KEY), "{not json");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(readCopilotSnapshot(st, KEY)).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("clear removes it; a refusing storage never throws", () => {
    const st = memoryStorage();
    writeCopilotSnapshot(st, KEY, history);
    clearCopilotSnapshot(st, KEY);
    expect(readCopilotSnapshot(st, KEY)).toBeNull();
    const refusing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(readCopilotSnapshot(refusing, KEY)).toBeNull();
    expect(writeCopilotSnapshot(refusing, KEY, history)).toBe(false);
    expect(() => clearCopilotSnapshot(refusing, KEY)).not.toThrow();
  });

  it("the panel paints the saved copy before asking chat-service, and re-saves every answer", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/copilot-chat.tsx"), "utf8");
    const at = src.indexOf("const saved = parseSavedChatSession(readCopilotSnapshot(");
    const ask = src.indexOf("const latest = await getLatestChatSession(COPILOT_CONFIG_KEY, { limit: CHAT_HISTORY_PAGE_SIZE });", at);
    expect(at).toBeGreaterThan(0);
    expect(ask).toBeGreaterThan(at);
    // Shown and marked ready BEFORE the network read starts.
    const paint = src.indexOf("show(saved);", at);
    expect(paint).toBeGreaterThan(at);
    expect(paint).toBeLessThan(ask);
    // Every fresh answer is saved; a new chat forgets the copy.
    expect(src).toContain("writeCopilotSnapshot(storage, storageKey, h);");
    expect(src).toMatch(/saveSessionId\(storageKey, null\);\s*clearCopilotSnapshot\(/);
  });

  it("names the signed-in user from Clerk's session cookie before clerk-js boots", () => {
    expect(userIdFromSessionCookie(`_ga=1; __session=${jwt("user_abc")}; x=y`)).toBe("user_abc");
    expect(userIdFromSessionCookie(`__client_uat=1; __session_NmYW9ItM=${jwt("user_suffixed")}`)).toBe("user_suffixed");
    expect(userIdFromSessionCookie("__session=not-a-jwt")).toBeNull();
    expect(userIdFromSessionCookie(`__session=${jwt("org_x")}`)).toBeNull();
    expect(userIdFromSessionCookie("")).toBeNull();
    expect(userIdFromSessionCookie(null)).toBeNull();
  });

  it("the panel keys the saved copy on Clerk's user, else the session cookie's", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/copilot-chat.tsx"), "utf8");
    expect(src).toContain("const userId = clerkUserId ?? cookieUserId;");
    expect(src).toContain("setCookieUserId(userIdFromSessionCookie(document.cookie));");
  });
});
