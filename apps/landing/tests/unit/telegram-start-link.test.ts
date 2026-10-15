import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  activeThreads: vi.fn(async () => [] as string[]),
  addMessage: vi.fn(async () => undefined),
  threadForCode: vi.fn(async () => null as string | null),
  threadForTelegramMessage: vi.fn(async () => null as string | null),
}));
vi.mock("@/lib/chat/store", () => store);

import { POST } from "@/app/api/chat/telegram/route";
import { LINK_REPLIES, startLinkCode } from "@/lib/chat/owner-telegram-link";

const TEAM_CHAT = "111";
const CUSTOMER_CHAT = 222333;
const SECRET = "hook-secret";

type Call = { url: string; body: Record<string, unknown>; headers: Record<string, string> };
let calls: Call[];
let clientServiceAnswer: () => Response | Promise<Response>;

function update(chatId: number | string, text: string, extra: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/chat/telegram", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": SECRET },
    body: JSON.stringify({ message: { message_id: 9, chat: { id: Number(chatId) }, text, ...extra } }),
  });
}

const linkCalls = () => calls.filter((c) => c.url.includes("/internal/owner-telegram/links"));
const telegramSends = () => calls.filter((c) => c.url.includes("api.telegram.org"));

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = "bot-token";
  process.env.TELEGRAM_OWNER_CHAT_ID = TEAM_CHAT;
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
  process.env.CLIENT_SERVICE_URL = "http://client-service:8080";
  process.env.CLIENT_SERVICE_API_KEY = "cs-key";
  calls = [];
  clientServiceAnswer = () =>
    Response.json({ orgId: "o", orgName: "Org", linkedAt: "2026-10-14T00:00:00Z", confirmationSent: true });
  Object.values(store).forEach((fn) => fn.mockClear());
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init.body)),
        headers: init.headers as Record<string, string>,
      });
      if (String(input).includes("api.telegram.org")) {
        return Response.json({ ok: true, result: { message_id: 42 } });
      }
      return clientServiceAnswer();
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("startLinkCode", () => {
  it("reads the code of a deep-link start", () => {
    expect(startLinkCode("/start abc123")).toBe("abc123");
    expect(startLinkCode("  /start   abc123  ")).toBe("abc123");
    expect(startLinkCode("/start@distribute_you_bot abc123")).toBe("abc123");
  });
  it("is null for a bare /start and for anything else", () => {
    expect(startLinkCode("/start")).toBeNull();
    expect(startLinkCode("/start ")).toBeNull();
    expect(startLinkCode("/starter abc")).toBeNull();
    expect(startLinkCode("hello /start abc")).toBeNull();
    expect(startLinkCode("#abc123 hi")).toBeNull();
  });
});

describe("Telegram webhook: /start <code> links a chat", () => {
  it("forwards a non-team chat's code with its chat id, and sends nothing more on success", async () => {
    const res = await POST(update(CUSTOMER_CHAT, "/start code-1"));
    expect(res.status).toBe(200);
    expect(linkCalls()).toHaveLength(1);
    expect(linkCalls()[0].url).toBe("http://client-service:8080/internal/owner-telegram/links");
    expect(linkCalls()[0].body).toEqual({ code: "code-1", chatId: String(CUSTOMER_CHAT) });
    expect(linkCalls()[0].headers["x-api-key"]).toBe("cs-key");
    expect(telegramSends()).toHaveLength(0);
  });

  it.each([
    [404, LINK_REPLIES.link_code_unknown],
    [410, LINK_REPLIES.link_code_expired],
    [409, LINK_REPLIES.link_code_used],
  ])("answers a %i refusal with a plain line in that chat", async (status, reply) => {
    clientServiceAnswer = () => Response.json({ error: "x" }, { status });
    const res = await POST(update(CUSTOMER_CHAT, "/start code-1"));
    expect(res.status).toBe(200);
    expect(telegramSends()).toHaveLength(1);
    expect(telegramSends()[0].body).toMatchObject({ chat_id: String(CUSTOMER_CHAT), text: reply });
  });

  it("answers a client-service 5xx with the retry line and logs it", async () => {
    clientServiceAnswer = () => new Response("boom", { status: 502 });
    const res = await POST(update(CUSTOMER_CHAT, "/start code-1"));
    expect(res.status).toBe(200);
    expect(telegramSends()[0].body).toMatchObject({ chat_id: String(CUSTOMER_CHAT), text: LINK_REPLIES.failed });
    expect(console.error).toHaveBeenCalled();
  });

  it("answers an unreachable client-service with the retry line", async () => {
    clientServiceAnswer = () => {
      throw new TypeError("fetch failed");
    };
    const res = await POST(update(CUSTOMER_CHAT, "/start code-1"));
    expect(res.status).toBe(200);
    expect(telegramSends()[0].body).toMatchObject({ text: LINK_REPLIES.failed });
  });

  it("answers the retry line, without calling client-service, when its env is missing", async () => {
    delete process.env.CLIENT_SERVICE_API_KEY;
    const res = await POST(update(CUSTOMER_CHAT, "/start code-1"));
    expect(res.status).toBe(200);
    expect(linkCalls()).toHaveLength(0);
    expect(telegramSends()[0].body).toMatchObject({ text: LINK_REPLIES.failed });
    expect(console.error).toHaveBeenCalled();
  });

  it("still answers 200 when the reply itself cannot be sent", async () => {
    clientServiceAnswer = () => Response.json({ error: "x" }, { status: 410 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (String(input).includes("api.telegram.org")) throw new TypeError("telegram down");
        return clientServiceAnswer();
      }),
    );
    const res = await POST(update(CUSTOMER_CHAT, "/start code-1"));
    expect(res.status).toBe(200);
  });

  it("forwards the team chat's code too, without touching visitor routing", async () => {
    const res = await POST(update(TEAM_CHAT, "/start code-2"));
    expect(res.status).toBe(200);
    expect(linkCalls()[0].body).toEqual({ code: "code-2", chatId: TEAM_CHAT });
    expect(store.addMessage).not.toHaveBeenCalled();
    expect(telegramSends()).toHaveLength(0);
  });
});

describe("Telegram webhook: everything else is unchanged", () => {
  it("answers a bare /start from the team chat with the Connected line", async () => {
    await POST(update(TEAM_CHAT, "/start"));
    expect(linkCalls()).toHaveLength(0);
    expect(telegramSends()).toHaveLength(1);
    expect(telegramSends()[0].body).toMatchObject({
      chat_id: TEAM_CHAT,
      text: "Connected. Visitor messages from distribute.you land here. Reply to one to answer in the chat.",
    });
  });

  it("routes a team #code message to its visitor thread", async () => {
    store.threadForCode.mockResolvedValueOnce("thread-1");
    await POST(update(TEAM_CHAT, "#abc123 hello there"));
    expect(store.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: "thread-1", sender: "team", body: "hello there" }),
    );
    expect(linkCalls()).toHaveLength(0);
  });

  it("routes a team reply to the relayed message's thread", async () => {
    store.threadForTelegramMessage.mockResolvedValueOnce("thread-2");
    await POST(update(TEAM_CHAT, "on it", { reply_to_message: { message_id: 5 } }));
    expect(store.addMessage).toHaveBeenCalledWith(expect.objectContaining({ threadId: "thread-2", body: "on it" }));
  });

  it.each(["hello", "/start", "#abc123 hi"])("ignores %j from a non-team chat", async (text) => {
    const res = await POST(update(CUSTOMER_CHAT, text));
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(0);
    expect(store.addMessage).not.toHaveBeenCalled();
    expect(store.activeThreads).not.toHaveBeenCalled();
  });

  it("still refuses a wrong webhook secret", async () => {
    const req = new Request("http://localhost/api/chat/telegram", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "nope" },
      body: JSON.stringify({ message: { message_id: 1, chat: { id: CUSTOMER_CHAT }, text: "/start code" } }),
    });
    expect((await POST(req)).status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});
