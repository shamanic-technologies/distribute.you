import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GmailMailboxLine, type GmailMailbox } from "../src/components/settings/gmail-mailbox-line";
import { GMAIL_SEND_SCOPE, canSendFrom, withLoginHint } from "../src/lib/google-connect";

// GMAIL-NEEDS-SEND-ACCESS-1014: a mailbox connected before send access was asked for
// says so and offers Reconnect; a mailbox with it shows nothing new.

const READ = "https://www.googleapis.com/auth/gmail.readonly";
const base = { status: "active", gmailUnavailableReason: null } as const;
const withSend: GmailMailbox = { ...base, email: "kevin@brand.com", scopes: [READ, GMAIL_SEND_SCOPE] };
const withoutSend: GmailMailbox = { ...base, email: "old@brand.com", scopes: [READ] };

const noop = () => {};
const render = (account: GmailMailbox, confirming = false) =>
  renderToStaticMarkup(
    createElement(GmailMailboxLine, {
      account,
      confirming,
      removing: false,
      reconnecting: false,
      onReconnect: noop,
      onAskDisconnect: noop,
      onConfirmDisconnect: noop,
      onKeep: noop,
    }),
  );

describe("Gmail send access", () => {
  it("reads send access off the served scopes", () => {
    expect(canSendFrom(withSend)).toBe(true);
    expect(canSendFrom(withoutSend)).toBe(false);
    expect(canSendFrom({ scopes: [] })).toBe(false);
  });

  it("a mailbox without send access says so and offers Reconnect", () => {
    const html = render(withoutSend);
    expect(html).toContain('data-testid="gmail-needs-send-access"');
    expect(html).toContain("Sign in again so follow-ups can reply from this mailbox. The mailbox history stays.");
    expect(html).toContain(">Reconnect</button>");
    expect(html).toContain(">Disconnect</button>");
  });

  it("a mailbox with send access shows nothing new", () => {
    const html = render(withSend);
    expect(html).not.toContain("gmail-needs-send-access");
    expect(html).not.toContain("gmail-reconnect");
    expect(html).toContain(">Disconnect</button>");
  });

  it("Disconnect says what it deletes before it runs, and offers Reconnect instead", () => {
    for (const account of [withSend, withoutSend]) {
      const html = render(account, true);
      expect(html).toContain(`Disconnecting stops reading ${account.email} and deletes the mailbox history from distribute.you.`);
      expect(html).toContain(">Yes, disconnect</button>");
      expect(html).toContain(">Reconnect instead</button>");
      expect(html).not.toContain("gmail-needs-send-access");
    }
  });

  it("Reconnect preselects the address it was clicked on and keeps every other parameter", () => {
    const url = withLoginHint("https://accounts.google.com/o/oauth2/v2/auth?client_id=c&state=s&scope=a+b", "old@brand.com");
    const u = new URL(url);
    expect(u.searchParams.get("login_hint")).toBe("old@brand.com");
    expect(u.searchParams.get("client_id")).toBe("c");
    expect(u.searchParams.get("state")).toBe("s");
    expect(u.searchParams.get("scope")).toBe("a b");
  });

  it("the Gmail row renders each mailbox through that line and reconnects with its address", () => {
    const card = readFileSync(join(__dirname, "..", "src", "components", "settings", "brand-integrations-card.tsx"), "utf8");
    expect(card).toContain("<GmailMailboxLine");
    expect(card).toContain("connect.mutate(a.email)");
    expect(card).toContain("withLoginHint(url, email)");
  });

  it("the account schema reads the served scopes", () => {
    const api = readFileSync(join(__dirname, "..", "src", "lib", "api.ts"), "utf8");
    expect(api).toMatch(/gmailUnavailableReason: z\.string\(\)\.nullable\(\),\n  scopes: z\.array\(z\.string\(\)\),/);
  });
});
