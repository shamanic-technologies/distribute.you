import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.join(__dirname, "../src/app");
const crmDir = path.join(root, "(dashboard)/orgs/[orgId]/services/crm");
const pagePath = path.join(crmDir, "page.tsx");
const callbackPath = path.join(root, "services/crm/oauth/callback/route.ts");
const connectBtnPath = path.join(crmDir, "_components/connect-google-button.tsx");
const syncBtnPath = path.join(crmDir, "_components/sync-now-button.tsx");
const pollHelperPath = path.join(crmDir, "_components/poll-sync-job.ts");
const messagesListPath = path.join(crmDir, "_components/messages-list.tsx");
const parsePath = path.join(crmDir, "_components/parse-gmail-payload.ts");

describe("Google CRM page files", () => {
  it("page exists", () => {
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("oauth callback route exists at /services/crm/oauth/callback", () => {
    expect(fs.existsSync(callbackPath)).toBe(true);
  });

  it("connect-google-button exists", () => {
    expect(fs.existsSync(connectBtnPath)).toBe(true);
  });

  it("sync-now-button exists", () => {
    expect(fs.existsSync(syncBtnPath)).toBe(true);
  });

  it("messages-list exists", () => {
    expect(fs.existsSync(messagesListPath)).toBe(true);
  });

  it("parse-gmail-payload helper exists", () => {
    expect(fs.existsSync(parsePath)).toBe(true);
  });
});

describe("Connect Google button", () => {
  const content = fs.readFileSync(connectBtnPath, "utf-8");

  it("posts to /api/v1/orgs/google/auth/start", () => {
    expect(content).toContain("/api/v1/orgs/google/auth/start");
    expect(content).toContain('method: "POST"');
  });

  it("includes redirectUri in body", () => {
    expect(content).toContain("redirectUri");
    expect(content).toContain("/services/crm/oauth/callback");
  });

  it("redirects via window.location.assign", () => {
    expect(content).toContain("window.location.assign");
  });
});

describe("Sync now button (async job + poll)", () => {
  const btn = fs.readFileSync(syncBtnPath, "utf-8");
  const helper = fs.readFileSync(pollHelperPath, "utf-8");

  it("posts to /api/v1/orgs/google/sync", () => {
    expect(btn).toContain("/api/v1/orgs/google/sync");
    expect(btn).toContain('method: "POST"');
  });

  it("captures jobId from 202 response", () => {
    expect(btn).toContain("jobId");
  });

  it("polls GET /api/v1/orgs/google/sync/{jobId}", () => {
    expect(btn).toMatch(/\/api\/v1\/orgs\/google\/sync\/\$\{[^}]*jobId[^}]*\}/);
  });

  it("helper handles running, succeeded, failed status values", () => {
    expect(helper).toContain('"running"');
    expect(helper).toContain('"succeeded"');
    expect(helper).toContain('"failed"');
  });

  it("renders summary fields from poll response", () => {
    expect(btn).toContain("summary");
    expect(btn).toContain("accounts");
    expect(btn).toContain("gmail");
    expect(btn).toContain("contacts");
    expect(btn).toContain("inserted");
    expect(btn).toContain("updated");
  });

  it("cleans up polling on unmount via AbortController", () => {
    expect(btn).toContain("AbortController");
    expect(btn).toContain("useEffect");
    expect(btn).toContain(".abort()");
  });

  it("caps polling duration via MAX_POLL_MS (10 min)", () => {
    expect(btn).toContain("MAX_POLL_MS");
    expect(helper).toMatch(/10\s*\*\s*60\s*\*\s*1000/);
  });
});

describe("Messages list", () => {
  const content = fs.readFileSync(messagesListPath, "utf-8");

  it("paginates with nextCursor", () => {
    expect(content).toContain("nextCursor");
    expect(content).toContain("/api/v1/orgs/google/messages");
    expect(content).toContain("cursor=");
  });

  it("renders subject, from, date, snippet", () => {
    expect(content).toContain("subject");
    expect(content).toContain("from");
    expect(content).toContain("date");
    expect(content).toContain("snippet");
  });

  it("Load more button hides when nextCursor is null", () => {
    expect(content).toMatch(/nextCursor\s*&&/);
  });
});

describe("CRM page server fetch", () => {
  const content = fs.readFileSync(pagePath, "utf-8");

  it("does not have 'use client' directive", () => {
    expect(content).not.toMatch(/^["']use client["']/m);
  });

  it("fetches /v1/orgs/google/messages with limit=50", () => {
    expect(content).toContain("/v1/orgs/google/messages");
    expect(content).toContain("limit=50");
  });

  it("reads connected and error from searchParams", () => {
    expect(content).toContain("searchParams");
    expect(content).toContain("connected");
    expect(content).toContain("error");
  });

  it("imports ConnectGoogleButton, SyncNowButton, MessagesList", () => {
    expect(content).toContain("ConnectGoogleButton");
    expect(content).toContain("SyncNowButton");
    expect(content).toContain("MessagesList");
  });
});

describe("OAuth callback route", () => {
  const content = fs.readFileSync(callbackPath, "utf-8");

  it("calls /v1/orgs/google/auth/callback", () => {
    expect(content).toContain("/v1/orgs/google/auth/callback");
  });

  it("redirects to /orgs/{orgId}/services/crm with connected or error param", () => {
    expect(content).toContain("/services/crm");
    expect(content).toContain("connected=1");
    expect(content).toContain("error=");
  });

  it("uses Clerk auth() for orgId", () => {
    expect(content).toContain('from "@clerk/nextjs/server"');
    expect(content).toContain("auth()");
  });
});

describe("No silent fallbacks in CRM dir", () => {
  const files = [pagePath, connectBtnPath, syncBtnPath, messagesListPath, parsePath, callbackPath];

  for (const file of files) {
    it(`${path.basename(file)} has no '?? "Unknown"' or '?? "—"' fallbacks`, () => {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain('?? "Unknown"');
      expect(content).not.toContain("?? 'Unknown'");
      expect(content).not.toContain('?? "—"');
      expect(content).not.toContain("?? '—'");
      expect(content).not.toContain('?? "N/A"');
    });
  }
});
