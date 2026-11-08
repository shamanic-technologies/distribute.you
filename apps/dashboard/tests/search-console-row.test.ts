import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchConsoleLine, type SearchConsoleItem } from "../src/components/settings/search-console-line";
import {
  OUTCOME_PARAMS,
  finishErrorMessage,
  parseGoogleReturn,
  returnWithOutcome,
  searchConsoleAccountLine,
  searchConsolePropertyLine,
  searchConsoleSiteName,
} from "../src/lib/google-connect";
import { disconnectSearchConsole, finishGoogleConnect, listSearchConsoleAccounts, startGoogleConnect } from "../src/lib/api";

// GSC-CONNECTOR-1108: a Google Search Console row in Integrations, on its own Google consent,
// finished by the same callback as Gmail. Each site says whether its clicks count and for which brand.

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

const ACCOUNT = {
  email: "kevin@distribute.you",
  status: "active",
  connectedAt: "2026-11-08T10:00:00Z",
  lastSyncedAt: "2026-11-08T10:01:00Z",
  lastSyncError: null,
  properties: [
    { siteUrl: "sc-domain:distribute.you", permissionLevel: "siteOwner", brandId: "b1", status: "counting", lastSyncedAt: null, lastSyncError: null },
    { siteUrl: "https://distribute.you/", permissionLevel: "siteOwner", brandId: "b1", status: "covered", lastSyncedAt: null, lastSyncError: null },
    { siteUrl: "https://blog.example.com/", permissionLevel: "siteFullUser", brandId: null, status: "no_brand", lastSyncedAt: null, lastSyncError: null },
  ],
};

describe("api readers", () => {
  it("connect start asks the Search Console consent: connection=search_console beside redirectUri", async () => {
    const calls = stubFetch({ url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" });
    await startGoogleConnect("https://d/cb", "t", "search_console");
    expect(calls[0].url).toContain("/orgs/google/auth/start");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ redirectUri: "https://d/cb", connection: "search_console" });
  });

  it("the callback accepts a stored search_console connection", async () => {
    stubFetch({ success: true, connection: "search_console", googleAccountEmail: "kevin@distribute.you", googleAccountId: "x", syncJobId: null });
    await expect(finishGoogleConnect("c", "s", "t")).resolves.toMatchObject({ connection: "search_console" });
  });

  it("lists accounts with their properties", async () => {
    const calls = stubFetch({ accounts: [ACCOUNT] });
    const out = await listSearchConsoleAccounts("t");
    expect(calls[0].url).toContain("/orgs/google/search-console/accounts");
    expect(out.accounts[0].properties).toHaveLength(3);
  });

  it("a changed shape fails loud", async () => {
    stubFetch({ accounts: [{ email: "x" }] });
    await expect(listSearchConsoleAccounts("t")).rejects.toThrow("unexpected shape");
  });

  it("disconnect deletes the account by email", async () => {
    const calls = stubFetch({ disconnected: true, email: "a@b.c", grant: "revoked" });
    await disconnectSearchConsole("a@b.c", "t");
    expect(calls[0].url).toContain("/orgs/google/search-console/accounts/a%40b.c");
    expect(calls[0].init.method).toBe("DELETE");
  });
});

describe("the trip", () => {
  it("remembers a Search Console trip and returns its outcome on its own params", () => {
    expect(parseGoogleReturn(JSON.stringify({ orgId: "o", returnTo: "/x", connection: "search_console" }))?.connection).toBe("search_console");
    expect(returnWithOutcome("/x#integrations", { connected: true }, "search_console")).toBe(`/x?${OUTCOME_PARAMS.search_console.connected}=connected#integrations`);
  });

  it("an unticked Search Console box asks to keep it ticked", () => {
    expect(finishErrorMessage("search_console", { status: 400, body: { reason: "search_console_permission_missing" } })).toBe(
      "Keep the Search Console box ticked and try again.",
    );
    expect(finishErrorMessage("search_console", new Error("x"))).toBe("We could not connect Google Search Console. Try again.");
  });
});

describe("plain words", () => {
  it("names a domain property by its domain, a URL prefix by its URL", () => {
    expect(searchConsoleSiteName("sc-domain:distribute.you")).toBe("distribute.you");
    expect(searchConsoleSiteName("https://blog.example.com/")).toBe("https://blog.example.com");
  });

  it("a dead token offers Reconnect; a failing read retries on its own", () => {
    expect(searchConsoleAccountLine({ status: "active" })).toEqual({ text: null, tone: "ok", reconnect: false });
    expect(searchConsoleAccountLine({ status: "reconnect_required" }).reconnect).toBe(true);
    expect(searchConsoleAccountLine({ status: "sync_failing" }).reconnect).toBe(false);
  });

  it("an unknown status is loud, never healthy", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(searchConsoleAccountLine({ status: "new_state" }).reconnect).toBe(true);
    expect(searchConsolePropertyLine({ siteUrl: "x", brandId: null, status: "new_state" }, null).tone).toBe("warn");
    expect(err).toHaveBeenCalledTimes(2);
    err.mockRestore();
  });

  it("every property verdict says what happens, the counting one names the brand", () => {
    expect(searchConsolePropertyLine({ siteUrl: "x", brandId: "b1", status: "counting" }, "Distribute.you").text).toBe(
      "Counts your Google search clicks for Distribute.you.",
    );
    for (const status of ["pending", "covered", "no_brand", "brand_ambiguous", "unverified", "not_listed", "disconnected"]) {
      const line = searchConsolePropertyLine({ siteUrl: "x", brandId: null, status }, null);
      expect(line.text.length).toBeGreaterThan(0);
      expect(line.text).not.toMatch(/[—–]/);
    }
  });
});

describe("the row", () => {
  const render = (account: SearchConsoleItem, confirming = false) =>
    renderToStaticMarkup(
      createElement(SearchConsoleLine, {
        account,
        brandNames: new Map([["b1", "Distribute.you"]]),
        confirming,
        removing: false,
        reconnecting: false,
        onReconnect: () => {},
        onAskDisconnect: () => {},
        onConfirmDisconnect: () => {},
        onKeep: () => {},
      }),
    );

  it("lists each site with its verdict and no Reconnect while healthy", () => {
    const html = render(ACCOUNT);
    expect(html).toContain("distribute.you");
    expect(html).toContain("Counts your Google search clicks for Distribute.you.");
    expect(html).toContain("Already counted by another property of this site.");
    expect(html).toContain("No brand here uses this site");
    expect(html).not.toContain("search-console-reconnect");
  });

  it("a dead token shows Reconnect", () => {
    expect(render({ ...ACCOUNT, status: "reconnect_required" })).toContain("search-console-reconnect");
  });

  it("disconnect says what stays", () => {
    expect(render(ACCOUNT, true)).toContain("Clicks already counted stay on your dashboard.");
  });
});

describe("the card", () => {
  it("sits beside Gmail and Google Calendar and runs the same connect flow", () => {
    const card = read("components/settings/brand-integrations-card.tsx");
    expect(card).toContain('rows.splice(2, 0, <SearchConsoleRow key="google-search-console" orgId={orgId} />);');
    expect(card).toContain('startGoogleConnect(googleCallbackUrl(window.location.origin), undefined, "search_console")');
    expect(card).toContain('JSON.stringify({ orgId, returnTo, connection: "search_console" })');
    expect(card).toContain('<ProductMark src="/integration-logos/google-search-console.svg" />');
  });
});
