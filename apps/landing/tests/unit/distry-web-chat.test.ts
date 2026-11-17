import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isVisitorId, parseWebAnswer } from "../../src/lib/chat/distry-web";

const APP = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(APP, p), "utf8");

describe("the answer chat-service serves for a page message", () => {
  it("is read as served", () => {
    expect(parseWebAnswer({ status: "answered", reply: "Hi", handOff: null, askForContact: false, messagesLeft: 4, continuedOn: null })).toEqual({
      status: "answered", reply: "Hi", askForContact: false, messagesLeft: 4, continuedOn: null,
    });
    expect(parseWebAnswer({ status: "contact_needed", reply: null, askForContact: true, messagesLeft: 0, continuedOn: "whatsapp" })).toEqual({
      status: "contact_needed", reply: null, askForContact: true, messagesLeft: 0, continuedOn: "whatsapp",
    });
  });

  it("is refused when it is not the documented shape", () => {
    for (const body of [null, "x", {}, { status: "done", reply: "x" }, { status: "answered", reply: 3 }]) {
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
});
