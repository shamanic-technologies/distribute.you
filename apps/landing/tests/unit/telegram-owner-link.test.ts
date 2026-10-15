import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  activeThreads: vi.fn(async () => [] as string[]),
  addMessage: vi.fn(async () => undefined),
  threadForCode: vi.fn(async () => null as string | null),
  threadForTelegramMessage: vi.fn(async () => null as string | null),
}));
vi.mock("@/lib/chat/store", () => store);

import { POST } from "@/app/api/chat/telegram/route";
import { OWNER_LINK_REPLIES, startCode } from "@/lib/chat/owner-link";

const TEAM_CHAT = "1000";
const CUSTOMER_CHAT = 2000;

type Call = { url: string; body: Record<string, unknown>; headers: Record<string, string> };
let calls: Call[];
let linkStatus: number;

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = "bot-token";
  process.env.TELEGRAM_OWNER_CHAT_ID = TEAM_CHAT;
  process.env.TELEGRAM_WEBHOOK_SECRET = "hook-secret";
  process.env.CLIENT_SERVICE_URL = "http://client-service:8080";
  process.env.CLIENT_SERVICE_API_KEY = "client-key";
  calls = [];
  linkStatus = 200;
  for (const fn of Object.values(store)) fn.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
      if (url.includes("/internal/owner-telegram/links")) {
        return new Response(JSON.stringify({ error: "x" }), { status: linkStatus });
      }
      return Response.json({ ok: true, result: { message_id: 1 } });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

function update(chatId: number | string, text: string) {
  return new Request("http://landing/api/chat/telegram", {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": "hook-secret" },
    body: JSON.stringify({ message: { message_id: 7, chat: { id: Number(chatId) }, text } }),
  });
}

const linkCalls = () => calls.filter((c) => c.url.endsWith("/internal/owner-telegram/links"));
const telegramSends = () => calls.filter((c) => c.url.includes("api.telegram.org"));

describe("startCode", () => {
  it("reads the code of /start <code>, with or without the bot's name", () => {
    expect(startCode("/start abc_DEF-123")).toBe("abc_DEF-123");
    expect(startCode("/start@distribute_you_bot abc")).toBe("abc");
    expect(startCode("/start")).toBeNull();
    expect(startCode("/start two words")).toBeNull();
    expect(startCode("hello /start abc")).toBeNull();
  });
});

describe("Telegram webhook: /start <code> links a customer's chat", () => {
  it("hands the code and chat id from a NON-team chat to client-service, and stays silent (client-service says Connected)", async () => {
    const res = await POST(update(CUSTOMER_CHAT, "/start code123"));
    expect(res.status).toBe(200);
    expect(linkCalls()).toHaveLength(1);
    expect(linkCalls()[0].body).toEqual({ code: "code123", chatId: String(CUSTOMER_CHAT) });
    expect(linkCalls()[0].headers["x-api-key"]).toBe("client-key");
    expect(telegramSends()).toHaveLength(0);
  });

  it("links from the team chat too (the owner may link other orgs)", async () => {
    await POST(update(TEAM_CHAT, "/start code123"));
    expect(linkCalls()[0].body).toEqual({ code: "code123", chatId: TEAM_CHAT });
    expect(store.activeThreads).not.toHaveBeenCalled();
    expect(store.addMessage).not.toHaveBeenCalled();
  });

  it.each([
    [404, "unknown"],
    [410, "expired"],
    [409, "used"],
    [502, "unavailable"],
  ] as const)("answers a plain line in that chat when client-service says %i", async (status, outcome) => {
    linkStatus = status;
    const res = await POST(update(CUSTOMER_CHAT, "/start badcode"));
    expect(res.status).toBe(200);
    expect(telegramSends()).toHaveLength(1);
    expect(telegramSends()[0].body).toMatchObject({ chat_id: CUSTOMER_CHAT, text: OWNER_LINK_REPLIES[outcome] });
  });

  it("every answer is short plain copy without dashes", () => {
    for (const text of Object.values(OWNER_LINK_REPLIES)) {
      expect(text).not.toMatch(/[—–]/);
      expect(text.length).toBeLessThan(120);
    }
  });
});

describe("Telegram webhook: the team chat is unchanged", () => {
  it("drops any other message from a non-team chat", async () => {
    await POST(update(CUSTOMER_CHAT, "hello"));
    await POST(update(CUSTOMER_CHAT, "/start"));
    expect(calls).toHaveLength(0);
    expect(store.addMessage).not.toHaveBeenCalled();
  });

  it("bare /start in the team chat answers the team's Connected line", async () => {
    await POST(update(TEAM_CHAT, "/start"));
    expect(linkCalls()).toHaveLength(0);
    expect(telegramSends()).toHaveLength(1);
    expect(String(telegramSends()[0].body.text)).toMatch(/^Connected\. Visitor messages/);
    expect(telegramSends()[0].body.chat_id).toBe(TEAM_CHAT);
  });

  it("#code text still routes to the visitor's thread", async () => {
    store.threadForCode.mockResolvedValueOnce("thread-1");
    await POST(update(TEAM_CHAT, "#abc123 hi there"));
    expect(linkCalls()).toHaveLength(0);
    expect(store.threadForCode).toHaveBeenCalledWith("abc123");
    expect(store.addMessage).toHaveBeenCalledWith({ threadId: "thread-1", sender: "team", body: "hi there", telegramMessageId: 7 });
  });

  it("a plain reply with one active visitor still goes to that visitor", async () => {
    store.activeThreads.mockResolvedValueOnce(["thread-2"]);
    await POST(update(TEAM_CHAT, "hello visitor"));
    expect(store.addMessage).toHaveBeenCalledWith({ threadId: "thread-2", sender: "team", body: "hello visitor", telegramMessageId: 7 });
  });
});
