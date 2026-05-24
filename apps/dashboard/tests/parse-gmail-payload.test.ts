import { describe, it, expect } from "vitest";
import { parseGmailPayload } from "../src/app/(authed)/(dashboard)/orgs/[orgId]/services/crm/_components/parse-gmail-payload";

describe("parseGmailPayload", () => {
  it("extracts subject, from, date from inner Gmail payload headers, snippet from envelope", () => {
    const message = {
      id: "abc",
      payload: {
        snippet: "Hello there",
        payload: {
          headers: [
            { name: "Subject", value: "Welcome" },
            { name: "From", value: "alice@example.com" },
            { name: "Date", value: "Mon, 04 May 2026 12:00:00 +0000" },
            { name: "To", value: "bob@example.com" },
          ],
        },
      },
    };
    const parsed = parseGmailPayload(message);
    expect(parsed).toEqual({
      subject: "Welcome",
      from: "alice@example.com",
      date: "Mon, 04 May 2026 12:00:00 +0000",
      snippet: "Hello there",
    });
  });

  it("matches headers case-insensitively", () => {
    const message = {
      id: "abc",
      payload: {
        snippet: "snip",
        payload: {
          headers: [
            { name: "subject", value: "lower" },
            { name: "FROM", value: "x@y.z" },
            { name: "date", value: "today" },
          ],
        },
      },
    };
    const parsed = parseGmailPayload(message);
    expect(parsed.subject).toBe("lower");
    expect(parsed.from).toBe("x@y.z");
    expect(parsed.date).toBe("today");
  });

  it("returns null for missing headers (no silent default)", () => {
    const message = {
      id: "abc",
      payload: {
        snippet: "only snippet",
        payload: { headers: [] },
      },
    };
    const parsed = parseGmailPayload(message);
    expect(parsed.subject).toBeNull();
    expect(parsed.from).toBeNull();
    expect(parsed.date).toBeNull();
    expect(parsed.snippet).toBe("only snippet");
  });

  it("returns null snippet when neither envelope.snippet nor message.snippet present", () => {
    const message = {
      id: "abc",
      payload: {
        payload: { headers: [{ name: "Subject", value: "x" }] },
      },
    };
    const parsed = parseGmailPayload(message);
    expect(parsed.snippet).toBeNull();
    expect(parsed.subject).toBe("x");
  });

  it("falls back to top-level message.snippet when envelope has no snippet", () => {
    const message = {
      id: "abc",
      snippet: "top-level snip",
      payload: {
        payload: { headers: [{ name: "Subject", value: "x" }] },
      },
    };
    const parsed = parseGmailPayload(message);
    expect(parsed.snippet).toBe("top-level snip");
  });

  it("returns all-null when envelope missing", () => {
    const parsed = parseGmailPayload({ id: "abc" });
    expect(parsed).toEqual({
      subject: null,
      from: null,
      date: null,
      snippet: null,
    });
  });

  it("returns all-null when envelope present but inner payload missing", () => {
    const parsed = parseGmailPayload({ id: "abc", payload: { snippet: "s" } });
    expect(parsed).toEqual({
      subject: null,
      from: null,
      date: null,
      snippet: "s",
    });
  });
});
