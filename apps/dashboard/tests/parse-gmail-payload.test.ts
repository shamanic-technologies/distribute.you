import { describe, it, expect } from "vitest";
import { parseGmailPayload } from "../src/app/(dashboard)/orgs/[orgId]/services/crm/_components/parse-gmail-payload";

describe("parseGmailPayload", () => {
  it("extracts subject, from, date, snippet from full payload", () => {
    const message = {
      id: "abc",
      snippet: "Hello there",
      payload: {
        headers: [
          { name: "Subject", value: "Welcome" },
          { name: "From", value: "alice@example.com" },
          { name: "Date", value: "Mon, 04 May 2026 12:00:00 +0000" },
          { name: "To", value: "bob@example.com" },
        ],
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
      snippet: "snip",
      payload: {
        headers: [
          { name: "subject", value: "lower" },
          { name: "FROM", value: "x@y.z" },
          { name: "date", value: "today" },
        ],
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
      snippet: "only snippet",
      payload: { headers: [] },
    };
    const parsed = parseGmailPayload(message);
    expect(parsed.subject).toBeNull();
    expect(parsed.from).toBeNull();
    expect(parsed.date).toBeNull();
    expect(parsed.snippet).toBe("only snippet");
  });

  it("returns null snippet when payload.snippet is absent", () => {
    const message = {
      id: "abc",
      payload: { headers: [{ name: "Subject", value: "x" }] },
    };
    const parsed = parseGmailPayload(message);
    expect(parsed.snippet).toBeNull();
    expect(parsed.subject).toBe("x");
  });

  it("returns all-null when payload missing", () => {
    const parsed = parseGmailPayload({ id: "abc" });
    expect(parsed).toEqual({
      subject: null,
      from: null,
      date: null,
      snippet: null,
    });
  });
});
