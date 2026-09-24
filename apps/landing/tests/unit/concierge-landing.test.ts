import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CONCIERGE_PATH, CONTACT, renderConciergePage } from "../../src/lib/pages/concierge";
import { cleanBody, cleanContact, cleanEmail, explicitCode, makeRateLimiter, relayText, threadCode } from "../../src/lib/chat/rules";

const read = (p: string) => readFileSync(path.resolve(__dirname, "../..", p), "utf8");
const visibleText = (html: string) =>
  html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");

describe("/lp/concierge: the message-the-assistant candidate", () => {
  const html = renderConciergePage();

  it("is a noindexed candidate at its own URL", () => {
    expect(CONCIERGE_PATH).toBe("/lp/concierge");
    expect(read("src/app/lp/concierge/route.ts")).toContain("renderedResponse(renderConciergePage(), request)");
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(read("src/app/sitemap.ts")).not.toContain("/lp/");
  });

  it("offers every contact channel, each tagged for the funnel", () => {
    expect(CONTACT).toEqual({ email: "grow@distribute.you", whatsapp: "33680478702", telegram: "kevin_lourd" });
    expect(html).toContain('href="mailto:grow@distribute.you?');
    expect(html).toContain('href="https://wa.me/33680478702?text=');
    expect(html).toContain('href="https://t.me/kevin_lourd"');
    for (const channel of ["chat", "whatsapp", "email", "telegram", "mcp", "api"]) {
      expect(html, channel).toContain(`data-contact="${channel}"`);
    }
    expect(html).toContain('posthog.capture(name');
    expect(html).toContain('track("contact_clicked"');
  });

  it("carries no signup form and no dashboard pricing: the pitch is no app", () => {
    expect(html).not.toContain(">Start free</a>");
    expect(html).toContain('data-where="nav">Chat now</button>');
    expect(html).not.toMatch(/<form class="launch"/);
    expect(html).not.toContain('id="pricing"');
    expect(html).not.toContain('id="pipeline"');
    expect(html).toContain('id="proof"');
    expect(html).toContain('id="faq"');
  });

  it("the chat widget talks to the bridge and states when it is offline", () => {
    expect(html).toContain('fetch("/api/chat/messages"');
    expect(html).not.toContain("/api/chat/email");
    expect(html).toContain('id="cc-gate"');
    expect(html).toContain("your email or phone number, so we can reach you if you get disconnected");
    expect(html).toContain("contact: contact, body: body");
    // The gate's own regexes survive the template literal with single backslashes.
    expect(html).toContain("/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/");
    expect(html).toContain("The chat is offline.");
  });

  it("its own copy carries no em-dash", () => {
    const own = visibleText(html.slice(0, html.indexOf("<!-- Proof -->")));
    expect(own).not.toContain("—");
  });
});

describe("chat rules", () => {
  it("validates the message and the email", () => {
    expect(cleanBody("  hi \r\n")).toBe("hi");
    expect(cleanBody("")).toBeNull();
    expect(cleanBody("x".repeat(2001))).toBeNull();
    expect(cleanBody(3)).toBeNull();
    expect(cleanEmail(" a@b.co ")).toBe("a@b.co");
    expect(cleanEmail("nope")).toBeNull();
  });

  it("accepts an email or a 7 to 15 digit phone as the contact, nothing else", () => {
    expect(cleanContact(" Jane@Acme.io ")).toBe("Jane@Acme.io");
    expect(cleanContact("+33 6 80 47 87 02")).toBe("+33680478702");
    expect(cleanContact("(555) 123-4567")).toBe("5551234567");
    expect(cleanContact("12345")).toBeNull();
    expect(cleanContact("call me")).toBeNull();
    expect(cleanContact("")).toBeNull();
    expect(cleanContact(undefined)).toBeNull();
  });

  it("shows the team a short code and reads a #code reply", () => {
    expect(threadCode("3f2a9c1e-0000-4000-8000-000000000000")).toBe("3f2a9c");
    const t = relayText({ code: "3f2a9c", body: "hello", page: "/", country: "FR", contact: "a@b.co", isFirst: true });
    expect(t.startsWith("💬 #3f2a9c · / · FR · a@b.co\nhello")).toBe(true);
    expect(t).toContain("Reply to this message");
    expect(explicitCode("#3F2A9C  sure thing")).toEqual({ code: "3f2a9c", body: "sure thing" });
    expect(explicitCode("no code here")).toBeNull();
  });

  it("rate-limits per key in a window", () => {
    const allow = makeRateLimiter(2, 1000);
    expect([allow("ip", 0), allow("ip", 1), allow("ip", 2), allow("other", 2), allow("ip", 1001)]).toEqual([
      true, true, false, true, true,
    ]);
  });
});

const store = vi.hoisted(() => ({
  createThread: vi.fn(),
  openThread: vi.fn(),
  addMessage: vi.fn(),
  listMessages: vi.fn(),
  threadForTelegramMessage: vi.fn(),
  threadForCode: vi.fn(),
}));
vi.mock("../../src/lib/chat/store", () => store);

describe("chat routes", () => {
  const sent: string[] = [];
  beforeEach(() => {
    vi.resetAllMocks();
    sent.length = 0;
    process.env.TELEGRAM_BOT_TOKEN = "tok";
    process.env.TELEGRAM_OWNER_CHAT_ID = "42";
    process.env.TELEGRAM_WEBHOOK_SECRET = "s3cret";
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body).text);
      return new Response(JSON.stringify({ ok: true, result: { message_id: 900 + sent.length } }));
    }));
  });

  it("is offline (503) when the Telegram bridge is not configured", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const { POST, GET } = await import("../../src/app/api/chat/messages/route");
    const res = await POST(new Request("https://distribute.you/api/chat/messages", { method: "POST", body: JSON.stringify({ body: "hi" }) }));
    expect(res.status).toBe(503);
    expect(await (await GET(new Request("https://distribute.you/api/chat/messages"))).json()).toEqual({ online: false, messages: [] });
  });

  it("refuses to open a conversation without an email or phone", async () => {
    const { POST } = await import("../../src/app/api/chat/messages/route");
    const res = await POST(new Request("https://distribute.you/api/chat/messages", {
      method: "POST", headers: { "cf-connecting-ip": "2.2.2.2" }, body: JSON.stringify({ body: "hi", contact: "nope" }),
    }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "contact_required" });
    expect(store.createThread).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it("opens a thread, relays the first message to Telegram, stores it with the relay id", async () => {
    store.createThread.mockResolvedValue({ id: "3f2a9c1e-0000-4000-8000-000000000000", secret: "sec" });
    const { POST } = await import("../../src/app/api/chat/messages/route");
    const res = await POST(new Request("https://distribute.you/api/chat/messages", {
      method: "POST", headers: { "cf-ipcountry": "FR", "cf-connecting-ip": "1.1.1.1" },
      body: JSON.stringify({ body: "Need clients", page: "/", contact: "jane@acme.io" }),
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ thread: { id: "3f2a9c1e-0000-4000-8000-000000000000", secret: "sec" } });
    expect(store.createThread).toHaveBeenCalledWith({ page: "/", country: "FR", contact: "jane@acme.io" });
    expect(sent[0]).toContain("💬 #3f2a9c · / · FR · jane@acme.io\nNeed clients");
    expect(store.addMessage).toHaveBeenCalledWith({
      threadId: "3f2a9c1e-0000-4000-8000-000000000000", sender: "visitor", body: "Need clients", telegramMessageId: 901,
    });
  });

  it("refuses a thread whose secret does not match", async () => {
    store.openThread.mockResolvedValue(null);
    const { GET } = await import("../../src/app/api/chat/messages/route");
    const res = await GET(new Request("https://distribute.you/api/chat/messages?id=x&secret=wrong"));
    expect(res.status).toBe(404);
  });

  it("webhook: a team reply to a relayed message lands in that visitor's thread", async () => {
    store.threadForTelegramMessage.mockResolvedValue("thread-1");
    const { POST } = await import("../../src/app/api/chat/telegram/route");
    const res = await POST(new Request("https://distribute.you/api/chat/telegram", {
      method: "POST", headers: { "x-telegram-bot-api-secret-token": "s3cret" },
      body: JSON.stringify({ message: { message_id: 77, chat: { id: 42 }, text: "Happy to help!", reply_to_message: { message_id: 901 } } }),
    }));
    expect(res.status).toBe(200);
    expect(store.threadForTelegramMessage).toHaveBeenCalledWith(901);
    expect(store.addMessage).toHaveBeenCalledWith({ threadId: "thread-1", sender: "team", body: "Happy to help!", telegramMessageId: 77 });
  });

  it("webhook: rejects a wrong secret and ignores anyone but the team chat", async () => {
    const { POST } = await import("../../src/app/api/chat/telegram/route");
    const bad = await POST(new Request("https://distribute.you/api/chat/telegram", { method: "POST", headers: { "x-telegram-bot-api-secret-token": "no" }, body: "{}" }));
    expect(bad.status).toBe(403);
    const stranger = await POST(new Request("https://distribute.you/api/chat/telegram", {
      method: "POST", headers: { "x-telegram-bot-api-secret-token": "s3cret" },
      body: JSON.stringify({ message: { message_id: 5, chat: { id: 999 }, text: "#3f2a9c spam" } }),
    }));
    expect(stranger.status).toBe(200);
    expect(store.addMessage).not.toHaveBeenCalled();
  });

  it("webhook: an unaddressed team message is bounced back with instructions, not lost silently", async () => {
    const { POST } = await import("../../src/app/api/chat/telegram/route");
    await POST(new Request("https://distribute.you/api/chat/telegram", {
      method: "POST", headers: { "x-telegram-bot-api-secret-token": "s3cret" },
      body: JSON.stringify({ message: { message_id: 6, chat: { id: 42 }, text: "hello?" } }),
    }));
    expect(store.addMessage).not.toHaveBeenCalled();
    expect(sent[0]).toContain("Not sent");
  });
});
