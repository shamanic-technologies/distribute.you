import { describe, it, expect } from "vitest";
import { parseGmailBody } from "../src/app/(authed)/(dashboard)/orgs/[orgId]/services/crm/_components/parse-gmail-body";

function b64url(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("parseGmailBody", () => {
  it("returns all-null when payload is undefined", () => {
    expect(parseGmailBody(undefined)).toEqual({ html: null, text: null, attachments: [] });
  });

  it("returns all-null when payload is null", () => {
    expect(parseGmailBody(null)).toEqual({ html: null, text: null, attachments: [] });
  });

  it("decodes single-part text/plain body", () => {
    const payload = {
      mimeType: "text/plain",
      body: { size: 5, data: b64url("Hello") },
    };
    const out = parseGmailBody(payload);
    expect(out).toEqual({ html: null, text: "Hello", attachments: [] });
  });

  it("decodes single-part text/html body", () => {
    const html = "<p>Hi <b>there</b></p>";
    const payload = {
      mimeType: "text/html",
      body: { size: html.length, data: b64url(html) },
    };
    const out = parseGmailBody(payload);
    expect(out).toEqual({ html, text: null, attachments: [] });
  });

  it("multipart/alternative: returns both html and text", () => {
    const text = "plain version";
    const html = "<p>html version</p>";
    const payload = {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { size: text.length, data: b64url(text) } },
        { mimeType: "text/html", body: { size: html.length, data: b64url(html) } },
      ],
    };
    const out = parseGmailBody(payload);
    expect(out.html).toBe(html);
    expect(out.text).toBe(text);
    expect(out.attachments).toEqual([]);
  });

  it("multipart/mixed: extracts attachments metadata, no body bytes", () => {
    const html = "<p>see attached</p>";
    const payload = {
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [{ mimeType: "text/html", body: { size: html.length, data: b64url(html) } }],
        },
        {
          mimeType: "image/png",
          filename: "logo.png",
          body: { size: 1234, attachmentId: "ATT_001" },
        },
        {
          mimeType: "application/pdf",
          filename: "invoice.pdf",
          body: { size: 5678, attachmentId: "ATT_002" },
        },
      ],
    };
    const out = parseGmailBody(payload);
    expect(out.html).toBe(html);
    expect(out.attachments).toEqual([
      { filename: "logo.png", mimeType: "image/png", size: 1234, attachmentId: "ATT_001" },
      { filename: "invoice.pdf", mimeType: "application/pdf", size: 5678, attachmentId: "ATT_002" },
    ]);
  });

  it("recursively walks nested parts", () => {
    const html = "<p>deep</p>";
    const payload = {
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/related",
          parts: [
            {
              mimeType: "multipart/alternative",
              parts: [
                { mimeType: "text/plain", body: { size: 2, data: b64url("hi") } },
                { mimeType: "text/html", body: { size: html.length, data: b64url(html) } },
              ],
            },
          ],
        },
      ],
    };
    const out = parseGmailBody(payload);
    expect(out.html).toBe(html);
    expect(out.text).toBe("hi");
  });

  it("decodes UTF-8 multibyte chars correctly", () => {
    const text = "Héllo — 日本語";
    const payload = {
      mimeType: "text/plain",
      body: { size: text.length, data: b64url(text) },
    };
    const out = parseGmailBody(payload);
    expect(out.text).toBe(text);
  });

  it("treats parts with filename as attachments even if mimeType is text/*", () => {
    const payload = {
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "text/csv",
          filename: "data.csv",
          body: { size: 100, attachmentId: "ATT_CSV" },
        },
      ],
    };
    const out = parseGmailBody(payload);
    expect(out.attachments).toEqual([
      { filename: "data.csv", mimeType: "text/csv", size: 100, attachmentId: "ATT_CSV" },
    ]);
    expect(out.text).toBeNull();
  });

  it("first html part wins (ignores subsequent html parts)", () => {
    const first = "<p>first</p>";
    const second = "<p>second</p>";
    const payload = {
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "text/html", body: { size: first.length, data: b64url(first) } },
        { mimeType: "text/html", body: { size: second.length, data: b64url(second) } },
      ],
    };
    const out = parseGmailBody(payload);
    expect(out.html).toBe(first);
  });
});
