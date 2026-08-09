import { describe, expect, it } from "vitest";
import {
  renderStaffDigestHtml,
  renderStaffDigestSubject,
  renderStaffDigestText,
  staffDigestHasContent,
  summarizeStaffDigest,
  type ClerkUser,
} from "../src/lib/staff-digest";

// `staff-digest.ts` carries no `@/` import on purpose, so these are REAL unit
// tests rather than source-substring guards. Keep it alias-free.

const WINDOW_END = new Date("2026-08-09T01:30:00.000Z");
const WINDOW_START = new Date("2026-08-08T01:30:00.000Z");

function user(over: Partial<ClerkUser> & { id: string }): ClerkUser {
  return {
    created_at: new Date("2026-01-01T00:00:00.000Z").getTime(),
    email_addresses: [{ email_address: `${over.id}@example.test` }],
    ...over,
  } as ClerkUser;
}

const at = (iso: string) => new Date(iso).getTime();

describe("summarizeStaffDigest", () => {
  it("reports a user created inside the window as a signup", () => {
    const s = summarizeStaffDigest(
      [user({ id: "new", created_at: at("2026-08-08T09:00:00.000Z") })],
      WINDOW_START,
      WINDOW_END,
    );
    expect(s.signups.map((p) => p.email)).toEqual(["new@example.test"]);
    expect(s.signins).toHaveLength(0);
  });

  it("reports a returning user as a sign-in, not a signup", () => {
    const s = summarizeStaffDigest(
      [user({ id: "old", last_sign_in_at: at("2026-08-08T12:00:00.000Z") })],
      WINDOW_START,
      WINDOW_END,
    );
    expect(s.signups).toHaveLength(0);
    expect(s.signins.map((p) => p.email)).toEqual(["old@example.test"]);
  });

  it("counts a brand-new user ONCE, as a signup", () => {
    // A signup necessarily also signs in. Listing the same person under both
    // headings would read as two events when it was one.
    const s = summarizeStaffDigest(
      [
        user({
          id: "both",
          created_at: at("2026-08-08T09:00:00.000Z"),
          last_sign_in_at: at("2026-08-08T09:00:05.000Z"),
        }),
      ],
      WINDOW_START,
      WINDOW_END,
    );
    expect(s.signups).toHaveLength(1);
    expect(s.signins).toHaveLength(0);
  });

  it("excludes activity outside the window on both edges", () => {
    const s = summarizeStaffDigest(
      [
        user({ id: "before", last_sign_in_at: WINDOW_START.getTime() - 1 }),
        user({ id: "after", last_sign_in_at: WINDOW_END.getTime() }),
        user({ id: "inside", last_sign_in_at: WINDOW_START.getTime() }),
      ],
      WINDOW_START,
      WINDOW_END,
    );
    // Start is inclusive, end exclusive — so a run at exactly the end instant
    // belongs to tomorrow's digest and can never be double-reported.
    expect(s.signins.map((p) => p.email)).toEqual(["inside@example.test"]);
  });

  it("treats an absent last_sign_in_at as never signed in, not as epoch", () => {
    const s = summarizeStaffDigest(
      [user({ id: "never", last_sign_in_at: null }), user({ id: "missing" })],
      WINDOW_START,
      WINDOW_END,
    );
    expect(s.signins).toHaveLength(0);
    expect(s.signups).toHaveLength(0);
  });

  it("drops a user with no email address rather than inventing one", () => {
    const s = summarizeStaffDigest(
      [user({ id: "ghost", email_addresses: [], created_at: at("2026-08-08T09:00:00.000Z") })],
      WINDOW_START,
      WINDOW_END,
    );
    expect(s.signups).toHaveLength(0);
  });

  it("orders each section most recent first", () => {
    const s = summarizeStaffDigest(
      [
        user({ id: "early", last_sign_in_at: at("2026-08-08T06:00:00.000Z") }),
        user({ id: "late", last_sign_in_at: at("2026-08-08T22:00:00.000Z") }),
      ],
      WINDOW_START,
      WINDOW_END,
    );
    expect(s.signins.map((p) => p.email)).toEqual([
      "late@example.test",
      "early@example.test",
    ]);
  });
});

describe("staffDigestHasContent", () => {
  it("is false for a day with nothing to report", () => {
    // A 100-a-month budget cannot afford an email that says nothing happened.
    const s = summarizeStaffDigest([], WINDOW_START, WINDOW_END);
    expect(staffDigestHasContent(s)).toBe(false);
  });

  it("is true as soon as either section has a row", () => {
    const s = summarizeStaffDigest(
      [user({ id: "x", last_sign_in_at: at("2026-08-08T10:00:00.000Z") })],
      WINDOW_START,
      WINDOW_END,
    );
    expect(staffDigestHasContent(s)).toBe(true);
  });
});

describe("rendering", () => {
  const summary = summarizeStaffDigest(
    [
      user({
        id: "signup",
        created_at: at("2026-08-08T09:00:00.000Z"),
        first_name: "Ada",
        last_name: "Lovelace",
      }),
      user({ id: "a", last_sign_in_at: at("2026-08-08T10:00:00.000Z") }),
      user({ id: "b", last_sign_in_at: at("2026-08-08T11:00:00.000Z") }),
    ],
    WINDOW_START,
    WINDOW_END,
  );

  it("states both counts in the subject, pluralised", () => {
    expect(renderStaffDigestSubject(summary)).toBe("Yesterday: 1 signup, 2 sign-ins");
  });

  it("omits a section that has no rows instead of printing an empty heading", () => {
    const onlySignins = summarizeStaffDigest(
      [user({ id: "a", last_sign_in_at: at("2026-08-08T10:00:00.000Z") })],
      WINDOW_START,
      WINDOW_END,
    );
    const html = renderStaffDigestHtml(onlySignins);
    expect(html).not.toContain("Signups");
    expect(html).toContain("Sign-ins");
    expect(renderStaffDigestSubject(onlySignins)).toBe("Yesterday: 1 sign-in");
  });

  it("renders the name beside the address when Clerk has one", () => {
    expect(renderStaffDigestText(summary)).toContain("Ada Lovelace <signup@example.test>");
  });

  it("escapes a name that would otherwise inject markup", () => {
    const nasty = summarizeStaffDigest(
      [
        user({
          id: "xss",
          created_at: at("2026-08-08T09:00:00.000Z"),
          first_name: "<script>alert(1)</script>",
        }),
      ],
      WINDOW_START,
      WINDOW_END,
    );
    const html = renderStaffDigestHtml(nasty);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
