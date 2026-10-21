import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleCalendarLine, type GoogleCalendarItem } from "../src/components/settings/google-calendar-line";
import { calendarLine, finishErrorMessage, parseGoogleReturn, returnWithOutcome } from "../src/lib/google-connect";
import { disconnectGoogleCalendar, listGoogleCalendars, startGoogleConnect } from "../src/lib/api";

// GOOGLE-CALENDAR-INTEGRATIONS-ROW-1021: a Google Calendar row in Integrations, on its own
// Google consent, finished by the same callback as Gmail.

const SRC = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

function stubFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("connect start", () => {
  it("the calendar asks its own consent: connection=calendar beside redirectUri", async () => {
    const calls = stubFetch({ url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" });
    await startGoogleConnect("https://dashboard.distribute.you/services/crm/oauth/callback", "t", "calendar");
    expect(calls[0].url).toContain("/orgs/google/auth/start");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      redirectUri: "https://dashboard.distribute.you/services/crm/oauth/callback",
      connection: "calendar",
    });
  });

  it("the Gmail mailbox start is unchanged: no connection field", async () => {
    const calls = stubFetch({ url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" });
    await startGoogleConnect("https://d/cb", "t");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ redirectUri: "https://d/cb" });
  });

  it("the calendar row starts the calendar consent and remembers it on the trip", () => {
    const card = read("components/settings/brand-integrations-card.tsx");
    expect(card).toContain('startGoogleConnect(googleCallbackUrl(window.location.origin), undefined, "calendar")');
    expect(card).toContain('JSON.stringify({ orgId, returnTo, connection: "calendar" })');
    expect(card).toContain('JSON.stringify({ orgId, returnTo, connection: "mailbox" })');
    expect(card).toContain('rows.splice(1, 0, <GoogleCalendarRow key="google-calendar" orgId={orgId} />);');
  });

  it("Gmail and Google Calendar wear their own product marks, never the Google G", () => {
    const card = read("components/settings/brand-integrations-card.tsx");
    expect(card).toContain('<ProductMark src="/integration-logos/gmail.svg" />');
    expect(card).toContain('<ProductMark src="/integration-logos/google-calendar.svg" />');
    expect(card).not.toContain('domain="gmail.com"');
    expect(card).not.toContain('domain="calendar.google.com"');
  });

  it("only staff mode sees the calendar row until Google verifies its scopes (GCAL-VERIFY-VIDEO-1021)", () => {
    const card = read("components/settings/brand-integrations-card.tsx");
    expect(card).toContain('import { useStaffMode } from "@/lib/use-staff-mode";');
    expect(card).toContain('if (staffMode) rows.splice(1, 0, <GoogleCalendarRow key="google-calendar" orgId={orgId} />);');
    expect(card.match(/<GoogleCalendarRow /g)?.length).toBe(1);
  });
});

describe("callback outcome", () => {
  it("a trip remembers its connection; an older trip was a mailbox", () => {
    expect(parseGoogleReturn(JSON.stringify({ orgId: "o", returnTo: "/x", connection: "calendar" }))?.connection).toBe("calendar");
    expect(parseGoogleReturn(JSON.stringify({ orgId: "o", returnTo: "/x" }))?.connection).toBe("mailbox");
  });

  it("the Gmail row reads its outcome as before", () => {
    expect(returnWithOutcome("/v2/x#integrations", { connected: true }, "mailbox")).toBe("/v2/x?gmail=connected#integrations");
    expect(returnWithOutcome("/v2/x#integrations", { error: "No" })).toBe("/v2/x?gmailError=No#integrations");
  });

  it("the calendar outcome lands on the calendar row, clearing a stale Gmail one", () => {
    expect(returnWithOutcome("/v2/x?gmailError=Old#integrations", { connected: true }, "calendar")).toBe("/v2/x?calendar=connected#integrations");
    expect(returnWithOutcome("/v2/x#integrations", { error: "No" }, "calendar")).toBe("/v2/x?calendarError=No#integrations");
  });

  it("the callback page routes the outcome by the trip's connection", () => {
    const page = read("app/(authed)/services/crm/oauth/callback/page.tsx");
    expect(page).toContain("done.connection ?? trip.connection");
    expect(page).toContain("finishErrorMessage(trip.connection, err)");
  });

  it("the calendar row reads its own error param", () => {
    expect(read("components/settings/brand-integrations-card.tsx")).toContain('search?.get("calendarError")');
  });
});

describe("unticked calendar box", () => {
  it("says to keep the calendar box ticked", () => {
    const err = { status: 400, body: { reason: "calendar_permission_missing", error: "Google did not grant calendar access." } };
    expect(finishErrorMessage("calendar", err)).toBe("Keep the calendar box ticked and try again.");
  });

  it("any other failure is our own plain copy, and Gmail's is unchanged", () => {
    expect(finishErrorMessage("calendar", { status: 502, body: null })).toBe("We could not connect this calendar. Try again.");
    expect(finishErrorMessage("mailbox", { status: 400, body: { reason: "calendar_permission_missing" } })).toBe("We could not connect this mailbox. Try again.");
  });
});

describe("list and disconnect", () => {
  const cal = { email: "jary@studio.com", connectedAt: "2026-10-21T10:00:00Z", lastSyncedAt: null, lastSyncError: null };

  it("lists the org's calendars from the gateway", async () => {
    const calls = stubFetch({ calendars: [{ ...cal, status: "active", attendance: "meet" }] });
    const { calendars } = await listGoogleCalendars("t");
    expect(calls[0].url).toContain("/orgs/google/calendar/accounts");
    expect(calendars[0].email).toBe("jary@studio.com");
  });

  it("disconnects one calendar by its address", async () => {
    const calls = stubFetch({ disconnected: true, email: "jary@studio.com", grant: "revoked" });
    await disconnectGoogleCalendar("jary+x@studio.com", "t");
    expect(calls[0].url).toContain("/orgs/google/calendar/accounts/jary%2Bx%40studio.com");
    expect(calls[0].init.method).toBe("DELETE");
  });

  const noop = () => {};
  const render = (c: GoogleCalendarItem, confirming = false) =>
    renderToStaticMarkup(
      createElement(GoogleCalendarLine, {
        calendar: c,
        confirming,
        removing: false,
        reconnecting: false,
        onReconnect: noop,
        onAskDisconnect: noop,
        onConfirmDisconnect: noop,
        onKeep: noop,
      }),
    );

  it("healthy: meetings and Meet attendance, no Reconnect", () => {
    const html = render({ email: cal.email, status: "active", attendance: "meet" });
    expect(html).toContain("jary@studio.com");
    expect(html).toContain("We see your booked meetings and who joined your Google Meet calls.");
    expect(html).not.toContain('data-testid="calendar-reconnect"');
    expect(html).toContain("Disconnect");
  });

  it("Meet permission missing: attendance is off, Reconnect offered", () => {
    const html = render({ email: cal.email, status: "active", attendance: "meet_permission_missing" });
    expect(html).toContain("Attendance is off.");
    expect(html).toContain('data-testid="calendar-reconnect"');
  });

  it("sync failing: reading stopped, Reconnect offered", () => {
    const html = render({ email: cal.email, status: "sync_failing", attendance: "meet" });
    expect(html).toContain("We stopped reading this calendar.");
    expect(html).toContain('data-testid="calendar-reconnect"');
  });

  it("Disconnect says what it deletes before it runs", () => {
    const html = render({ email: cal.email, status: "active", attendance: "meet" }, true);
    expect(html).toContain("Yes, disconnect");
    expect(html).toContain("deletes its meetings from distribute.you");
  });

  it("an unknown status never reads healthy", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(calendarLine({ status: "paused", attendance: "meet" }).tone).toBe("warn");
    spy.mockRestore();
  });

  it("no dash characters in the copy", () => {
    const copy = [
      read("components/settings/google-calendar-line.tsx"),
      read("lib/google-connect.ts").slice(read("lib/google-connect.ts").indexOf("export function finishErrorMessage")),
    ].join("");
    expect(copy).not.toMatch(/[—–]/);
  });
});
