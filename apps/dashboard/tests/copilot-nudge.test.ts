import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NUDGE_AFTER_IDLE_MS, NUDGE_AFTER_PAGE_MS, nudgeDelayMs, sessionIdFromUIStream } from "../src/lib/copilot-nudge";
import type { RecentAction } from "../src/lib/recent-actions";

const at = (kind: RecentAction["kind"], when: string): RecentAction => ({ at: when, kind, label: "x", page: "/p" });

describe("nudgeDelayMs", () => {
  it("asks shortly after a page opens, later after a click", () => {
    expect(nudgeDelayMs(at("page", "2026-10-15T10:00:00Z"), null)).toBe(NUDGE_AFTER_PAGE_MS);
    expect(nudgeDelayMs(at("click", "2026-10-15T10:00:00Z"), null)).toBe(NUDGE_AFTER_IDLE_MS);
  });

  it("does not ask again when nothing happened since the last ask", () => {
    expect(nudgeDelayMs(at("click", "2026-10-15T10:00:00Z"), "2026-10-15T10:00:05Z")).toBeNull();
    expect(nudgeDelayMs(undefined, null)).toBeNull();
  });

  it("asks again after a new action", () => {
    expect(nudgeDelayMs(at("page", "2026-10-15T10:01:00Z"), "2026-10-15T10:00:05Z")).toBe(NUDGE_AFTER_PAGE_MS);
  });
});

describe("sessionIdFromUIStream", () => {
  it("reads the session of a speak turn", () => {
    const text = [
      'data: {"type":"start"}',
      'data: {"type":"data-session","data":{"sessionId":"s-1"}}',
      'data: {"type":"text-delta","id":"t","delta":"Hi"}',
      "data: [DONE]",
    ].join("\n");
    expect(sessionIdFromUIStream(text)).toBe("s-1");
  });

  it("is null when the stream names no session", () => {
    expect(sessionIdFromUIStream('data: {"type":"start"}\ndata: [DONE]')).toBeNull();
  });
});

describe("call sites", () => {
  const chat = readFileSync(new URL("../src/components/v2/copilot-chat.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../src/app/(authed)/api/v1/chat/route.ts", import.meta.url), "utf8");

  it("the Copilot asks only while open, idle and not typing", () => {
    expect(chat).toContain("if (!dockOpen || phase !== \"ready\" || busy || draft.trim()) return;");
    expect(chat).toContain("nudge: true,");
  });

  it("a speak turn reloads the stored conversation", () => {
    const at = chat.indexOf("const askNudge = useCallback(");
    const body = chat.slice(at, chat.indexOf("useEffect(", at));
    expect(body).toContain("getChatSessionHistory(sid)");
    expect(body).toContain("setHistoryChoices(choicesByTurn(h.messages))");
  });

  it("the proxy forwards a nudge without a message and passes a quiet answer through", () => {
    expect(route).toContain("nudge === true ? { nudge: true, configKey } : { message, configKey }");
    expect(route).toContain('backendRes.headers.get("content-type")?.includes("application/json")');
  });
});
