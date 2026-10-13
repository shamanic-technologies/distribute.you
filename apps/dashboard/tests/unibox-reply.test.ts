import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  newestThread,
  pendingReplies,
  replyBodyHtml,
  replyErrorMessage,
  replyTarget,
  type LocalReply,
} from "../src/lib/unibox-reply";

const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");

const presence = (source: string, emails: string[]) => ({ source, emails });
const item = (source: string, direction: string | null, from: string | null, at = "2026-10-13T10:00:00Z") => ({
  source,
  direction,
  from,
  at,
});

describe("who the reply box answers", () => {
  it("answers the address we wrote to, once they wrote back to our cold email", () => {
    const person = { presences: [presence("instantly", ["Robert@AcupunctureConnections.com"])] };
    const items = [item("instantly", "outbound", "Kevin <kevin@mail.distribute.you>"), item("instantly", "inbound", "Robert <robert@acupunctureconnections.com>")];
    expect(replyTarget(person, items)).toBe("robert@acupunctureconnections.com");
  });
  it("offers no box when they never wrote back to a cold email (no thread to answer)", () => {
    const person = { presences: [presence("instantly", ["a@x.com"]), presence("gmail", ["a@x.com"])] };
    expect(replyTarget(person, [item("instantly", "outbound", "us@d.com"), item("gmail", "inbound", "a@x.com")])).toBeNull();
  });
  it("offers no box for someone we never emailed (Gmail or CRM only)", () => {
    expect(replyTarget({ presences: [presence("gmail", ["a@x.com"])] }, [item("instantly", "inbound", "a@x.com")])).toBeNull();
  });
  it("picks the written-to address their latest reply came from, else the first written-to address", () => {
    const person = { presences: [presence("instantly", ["a@x.com", "b@x.com"])] };
    expect(replyTarget(person, [item("instantly", "inbound", "A <a@x.com>"), item("instantly", "inbound", "B <b@x.com>")])).toBe("b@x.com");
    expect(replyTarget(person, [item("instantly", "inbound", "Other <other@y.com>")])).toBe("a@x.com");
  });
});

describe("the typed text as the email body", () => {
  it("keeps paragraphs and line breaks, and escapes HTML", () => {
    expect(replyBodyHtml("  Hi Robert,\n\nThanks <3 & see you.\nKevin  ")).toBe("<p>Hi Robert,</p><p>Thanks &lt;3 &amp; see you.<br>Kevin</p>");
  });
});

describe("several threads", () => {
  it("answers in the thread with the newest message, whatever the order served", () => {
    expect(
      newestThread([
        { campaign_id: "old", last_message_at: "2026-10-01T00:00:00Z" },
        { campaign_id: "new", last_message_at: "2026-10-12T00:00:00Z" },
        { campaign_id: "none", last_message_at: null },
      ]),
    ).toBe("new");
  });
});

describe("a refused send", () => {
  it("is stated in our own words, by the producer's code", () => {
    expect(replyErrorMessage(409, "no_reply_to_thread")).toMatch(/no thread/);
    expect(replyErrorMessage(404, "campaign_not_found")).toMatch(/never emailed/);
    expect(replyErrorMessage(502, "mailbox_credential_unavailable")).toMatch(/not sent/);
    expect(replyErrorMessage(502, "reply_dispatch_failed")).toMatch(/Try again/);
    expect(replyErrorMessage(null, null)).toBe("Your reply was not sent. Try again.");
  });
  it("carries no em or en dash", () => {
    for (const s of [replyErrorMessage(409, "no_reply_to_thread"), replyErrorMessage(404, null), replyErrorMessage(500, "sending_account_unresolved"), replyErrorMessage(500, "reply_dispatch_failed")]) {
      expect(s).not.toMatch(/[–—]/);
    }
  });
});

describe("a reply sent from the screen", () => {
  const local: LocalReply = {
    sentAt: "2026-10-13T10:05:00Z",
    text: "Thanks",
    reply: { leadEmail: "a@x.com", accountEmail: "k@d.com", from: "Kevin <k@d.com>", subject: "Re: hi", messageId: "m1" },
  };
  it("shows until the served thread carries an outbound cold email from about then on", () => {
    expect(pendingReplies([local], [item("instantly", "outbound", "k@d.com", "2026-10-12T09:00:00Z")])).toEqual([local]);
    expect(pendingReplies([local], [item("instantly", "outbound", "k@d.com", "2026-10-13T10:05:02Z")])).toEqual([]);
    expect(pendingReplies([local], [item("gmail", "outbound", "k@d.com", "2026-10-13T10:06:00Z")])).toEqual([local]);
  });
});

describe("the reply writer", () => {
  it("declares a human send, names the brand in the query, and never picks a mailbox", () => {
    const api = read("lib/api.ts");
    const at = api.indexOf("export async function sendUniboxReply(");
    const fn = api.slice(at, api.indexOf("export async function withdrawCrmPairingRuling(", at));
    expect(fn).toContain('sent_by: "human"');
    expect(fn).toContain("`/replies?${new URLSearchParams({ brandId: q.brandId })}`");
    expect(fn).not.toContain("from:");
    expect(fn).not.toContain("account");
  });
  it("is wired under the open thread", () => {
    const view = read("components/v2/integrations-conversations.tsx");
    expect(view).toContain("const target = replyTarget(person, items);");
    expect(view).toContain("{target && (\n        <ReplyBox");
    expect(view).toContain("sendUniboxReply({ brandId, email, text: words })");
  });
});
