import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { IP_MESSAGE_LIMIT, IP_WINDOW_MS, createIpGuard, isVisitorId, parseWebAnswer, relayWebMessage } from "../../src/lib/chat/distry-web";

const APP = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(APP, p), "utf8");

describe("the answer chat-service serves for a page message", () => {
  const account = { signedIn: false, email: null };

  it("is read as served", () => {
    expect(parseWebAnswer({ status: "answered", reply: "Hi", choices: null, handOff: null, continuedOn: null, account })).toEqual({
      status: "answered", reply: "Hi", choices: null, continuedOn: null, account,
    });
    expect(
      parseWebAnswer({
        status: "answered",
        reply: "Here is your plan.",
        choices: { question: "Run it?", choices: [{ label: "Yes" }, { label: "Change who we reach", description: "Pick other companies" }] },
        continuedOn: "email",
        account: { signedIn: true, email: "a@b.co" },
      }),
    ).toEqual({
      status: "answered",
      reply: "Here is your plan.",
      choices: { question: "Run it?", choices: [{ label: "Yes", description: null }, { label: "Change who we reach", description: "Pick other companies" }] },
      continuedOn: "email",
      account: { signedIn: true, email: "a@b.co" },
    });
    expect(parseWebAnswer({ status: "in_progress", reply: null, choices: null, continuedOn: "whatsapp", account })?.continuedOn).toBe("whatsapp");
  });

  it("is refused when it is not the documented shape", () => {
    for (const body of [
      null,
      "x",
      {},
      { status: "done", reply: "x", choices: null, account },
      { status: "answered", reply: 3, choices: null, account },
      // The cap is gone: its status is no longer one the producer serves.
      { status: "contact_needed", reply: null, choices: null, account },
      { status: "answered", reply: "x", choices: null },
      { status: "answered", reply: "x", choices: { choices: [{ label: 3 }] }, account },
      { status: "answered", reply: "x", choices: { choices: [] }, account },
    ]) {
      expect(parseWebAnswer(body)).toBeNull();
    }
  });

  it("accepts only an id the site minted", () => {
    expect(isVisitorId("a".repeat(32))).toBe(true);
    for (const id of [null, undefined, "", "short", "a".repeat(200), "has space ".repeat(3), "<script>".repeat(3)]) {
      expect(isVisitorId(id)).toBe(false);
    }
  });
});

describe("the route and the panel", () => {
  const route = read("src/app/api/chat/distry/route.ts");
  const script = read("public/landing/distry/distry.js");

  it("stays closed off the skin hosts, and checks the host before anything else", () => {
    // Index compare: the host gate comes before the body is read and before the relay.
    const gate = route.indexOf("prototypeSlugForHost(request.headers.get(\"host\")) === null");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(route.indexOf("request.json()"));
    expect(gate).toBeLessThan(route.indexOf("relayWebMessage(visitorId"));
  });

  it("keeps the visitor id out of the page's reach", () => {
    expect(route).toContain("HttpOnly; Secure; SameSite=Lax");
    expect(script).not.toContain("dy_visitor");
  });

  it("opens the panel on a click on Distry and falls back to WhatsApp when the chat cannot answer", () => {
    expect(script).toContain('fetch("/api/chat/distry"');
    expect(script).toContain("function openChat(");
    expect(script).toContain("Continue on WhatsApp");
  });

  it("holds no answer count and no ask-for-contact wall", () => {
    for (const source of [script, route, read("src/lib/chat/distry-web.ts")]) {
      for (const gone of ["askForContact", "messagesLeft", "contact_needed"]) expect(source).not.toContain(gone);
    }
  });

  it("shows the choices as buttons and sends the picked label as the next message", () => {
    expect(script).toContain("dc-choices");
    expect(script).toContain("send(choice.label)");
    for (const css of ["public/landing/distry/skin.css", "public/landing/distry/home.css"]) expect(read(css)).toContain(".dc-choices button");
  });

  it("asks again with the same message id while a long turn is still running", () => {
    // The id is minted once per message, outside the loop that re-asks.
    expect(script.match(/const messageId =/g)).toHaveLength(1);
    expect(script).toContain("await ask(messageId, text)");
    const at = script.indexOf("async function ask(messageId, text)");
    const loop = script.slice(at, script.indexOf("async function send(", at));
    expect(at).toBeGreaterThan(-1);
    expect(loop).toContain('answer.status === "in_progress"');
    expect(loop).toContain("JSON.stringify({ messageId, text })");
    expect(loop).not.toContain("Math.random");
  });

  it("checks the address before the relay", () => {
    const guard = route.indexOf("ipGuard.allow(");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(route.indexOf("relayWebMessage(visitorId"));
  });
});

describe("the relay", () => {
  const env = { CHAT_SERVICE_URL: "http://chat", CHAT_SERVICE_API_KEY: "k" };
  const account = { signedIn: false, email: null };

  it("answers in_progress when the turn outlasts the wait, so the page asks again", async () => {
    const slow = (() => Promise.reject(Object.assign(new Error("timed out"), { name: "TimeoutError" }))) as unknown as typeof fetch;
    expect(await relayWebMessage("v".repeat(32), "m12345678", "hi", { fetchImpl: slow, env })).toEqual({
      ok: true,
      answer: { status: "in_progress", reply: null, choices: null, continuedOn: null, account },
    });
  });

  it("fails loud on anything else", async () => {
    const down = (() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as typeof fetch;
    expect(await relayWebMessage("v".repeat(32), "m12345678", "hi", { fetchImpl: down, env })).toEqual({ ok: false, reason: "unreachable" });
    const odd = (async () => new Response(JSON.stringify({ status: "contact_needed" }), { status: 200 })) as unknown as typeof fetch;
    expect(await relayWebMessage("v".repeat(32), "m12345678", "hi", { fetchImpl: odd, env })).toEqual({ ok: false, reason: "refused" });
    expect(await relayWebMessage("v".repeat(32), "m12345678", "hi", { fetchImpl: odd, env: {} })).toEqual({ ok: false, reason: "not_configured" });
  });
});

describe("the speed guard per address", () => {
  it("cuts a script and never a person", () => {
    const guard = createIpGuard();
    const t0 = 1_000_000;
    // A script: one new message a second from one address.
    let refused = 0;
    for (let i = 0; i < IP_MESSAGE_LIMIT + 20; i++) if (!guard.allow("1.1.1.1", `m${i}`, t0 + i * 1000)) refused++;
    expect(refused).toBe(20);
    // Another address is not touched by it.
    expect(guard.allow("2.2.2.2", "a", t0)).toBe(true);
    // A person: 40 messages over an hour, and the same message asked again while it runs.
    const person = createIpGuard();
    for (let i = 0; i < 40; i++) {
      expect(person.allow("3.3.3.3", `p${i}`, t0 + i * 90_000)).toBe(true);
      for (let again = 0; again < 30; again++) expect(person.allow("3.3.3.3", `p${i}`, t0 + i * 90_000 + again * 3000)).toBe(true);
    }
    // The window slides: the script's address writes again once it has passed.
    expect(guard.allow("1.1.1.1", "later", t0 + IP_WINDOW_MS + (IP_MESSAGE_LIMIT + 20) * 1000)).toBe(true);
  });
});
