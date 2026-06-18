import { describe, it, expect } from "vitest";
import { parseGmailPayload } from "../src/app/(authed)/(dashboard)/orgs/[orgId]/services/crm/_components/parse-gmail-payload";
import { parseGmailBody } from "../src/app/(authed)/(dashboard)/orgs/[orgId]/services/crm/_components/parse-gmail-body";

function b64url(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Mirrors the actual shape stored in google-service.gmail_messages_raw.payload
// (raw Gmail Users.messages.get response). The dashboard receives this verbatim
// in items[i].payload from /v1/orgs/google/messages.
describe("Real bronze Gmail envelope shape", () => {
  const bodyText =
    "Hello Jennifer Dillon,\r\n\r\nThanks for getting back to me,\r\nI think we met a few months ago in South Roberthaven, right?";

  const envelope = {
    id: "19992fa44af188d4",
    threadId: "19992f878afa2bf6",
    historyId: "1206655",
    internalDate: "1759107497000",
    sizeEstimate: 6263,
    snippet: "Hello Jennifer Dillon, Thanks for getting back to me",
    labelIds: ["Label_1", "IMPORTANT", "CATEGORY_PERSONAL"],
    payload: {
      partId: "",
      mimeType: "text/plain",
      filename: "",
      headers: [
        { name: "From", value: "aniadanilova171610@gmail.com" },
        { name: "To", value: "kevin@pressbeat.io" },
        { name: "Subject", value: "Re: Chat with Wendy - wbx neo" },
        { name: "Date", value: "Sun, 28 Sep 2025 19:58:17 -0500" },
        { name: "Content-Type", value: 'text/plain; charset="UTF-8"' },
      ],
      body: { size: bodyText.length, data: b64url(bodyText) },
    },
  };

  const message = {
    id: "398ac187-1015-472e-8ac6-d2cf71cc2c2d",
    googleAccountId: "00000000-0000-0000-0000-000000000000",
    gmailMessageId: "19992fa44af188d4",
    threadId: "19992f878afa2bf6",
    historyId: "1206655",
    fetchedAt: "2026-05-11T00:00:00Z",
    payload: envelope,
  };

  it("parseGmailPayload reads subject/from/date from envelope.payload.headers", () => {
    const parsed = parseGmailPayload(message);
    expect(parsed.subject).toBe("Re: Chat with Wendy - wbx neo");
    expect(parsed.from).toBe("aniadanilova171610@gmail.com");
    expect(parsed.date).toBe("Sun, 28 Sep 2025 19:58:17 -0500");
    expect(parsed.snippet).toBe("Hello Jennifer Dillon, Thanks for getting back to me");
  });

  it("parseGmailBody decodes envelope.payload (the inner Gmail mime payload)", () => {
    const body = parseGmailBody(message.payload.payload);
    expect(body.text).toBe(bodyText);
    expect(body.html).toBeNull();
    expect(body.attachments).toEqual([]);
  });

  it("envelope.labelIds is preserved (not at top level)", () => {
    expect(message.payload.labelIds).toEqual(["Label_1", "IMPORTANT", "CATEGORY_PERSONAL"]);
  });
});
