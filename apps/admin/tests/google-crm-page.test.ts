import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.join(__dirname, "../src/app");
const crmDir = path.join(root, "(authed)/(dashboard)/orgs/[orgId]/services/crm");
const pagePath = path.join(crmDir, "page.tsx");
const callbackPath = path.join(root, "(authed)/services/crm/oauth/callback/route.ts");
const connectBtnPath = path.join(crmDir, "_components/connect-google-button.tsx");
const syncBtnPath = path.join(crmDir, "_components/sync-now-button.tsx");
const pollHelperPath = path.join(crmDir, "_components/poll-sync-job.ts");
const messagesListPath = path.join(crmDir, "_components/messages-list.tsx");
const parsePath = path.join(crmDir, "_components/parse-gmail-payload.ts");
const clientPath = path.join(crmDir, "_components/google-crm-client.tsx");
const hookPath = path.join(crmDir, "_components/use-google-sync.ts");
const apiPath = path.join(root, "../lib/api.ts");
const persistCachePath = path.join(root, "../lib/persist-cache.ts");

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

describe("Sync flow (shared hook: async job + poll)", () => {
  const btn = fs.readFileSync(syncBtnPath, "utf-8");
  const hook = fs.readFileSync(hookPath, "utf-8");
  const helper = fs.readFileSync(pollHelperPath, "utf-8");

  it("hook posts to /api/v1/orgs/google/sync", () => {
    expect(hook).toContain("/api/v1/orgs/google/sync");
    expect(hook).toContain('method: "POST"');
  });

  it("hook captures jobId from 202 response", () => {
    expect(hook).toContain("jobId");
  });

  it("hook polls GET /api/v1/orgs/google/sync/{jobId}", () => {
    expect(hook).toMatch(/\/api\/v1\/orgs\/google\/sync\/\$\{[^}]*jobId[^}]*\}/);
  });

  it("hook invalidates the CRM React Query roots after a sync (revalidate)", () => {
    expect(hook).toContain("invalidateQueries");
    expect(hook).toContain('"googleMessages"');
    expect(hook).toContain('"googleContacts"');
    expect(hook).toContain('"googleAccounts"');
  });

  it("helper handles running, succeeded, failed status values", () => {
    expect(helper).toContain('"running"');
    expect(helper).toContain('"succeeded"');
    expect(helper).toContain('"failed"');
  });

  it("button renders summary fields from poll response", () => {
    expect(btn).toContain("summary");
    expect(btn).toContain("accounts");
    expect(btn).toContain("gmail");
    expect(btn).toContain("contacts");
    expect(btn).toContain("inserted");
    expect(btn).toContain("updated");
  });

  it("hook cleans up polling on unmount via AbortController", () => {
    expect(hook).toContain("AbortController");
    expect(hook).toContain("useEffect");
    expect(hook).toContain(".abort()");
  });

  it("hook caps polling duration via MAX_POLL_MS (10 min)", () => {
    expect(hook).toContain("MAX_POLL_MS");
    expect(helper).toMatch(/10\s*\*\s*60\s*\*\s*1000/);
  });
});

describe("Messages list", () => {
  const content = fs.readFileSync(messagesListPath, "utf-8");

  it("paginates via nextCursor + onLoadMore (parent-driven)", () => {
    expect(content).toContain("nextCursor");
    expect(content).toContain("onLoadMore");
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

  it("prefers typed google-service fields (fromEmail/subject/snippet/sentAt)", () => {
    expect(content).toContain("fromEmail");
    expect(content).toContain("sentAt");
  });
});

describe("CRM page is a server shell over a client React Query surface", () => {
  const content = fs.readFileSync(pagePath, "utf-8");

  it("page.tsx does not have 'use client' directive", () => {
    expect(content).not.toMatch(/^["']use client["']/m);
  });

  it("page.tsx no longer one-shot fetches the lists server-side", () => {
    expect(content).not.toContain("Promise.all");
    expect(content).not.toContain("/v1/orgs/google/messages");
  });

  it("page.tsx reads connected and error from searchParams", () => {
    expect(content).toContain("searchParams");
    expect(content).toContain("connected");
    expect(content).toContain("error");
  });

  it("page.tsx renders the client GoogleCrmClient", () => {
    expect(content).toContain("GoogleCrmClient");
  });
});

describe("GoogleCrmClient — local-first React Query surface", () => {
  const content = fs.readFileSync(clientPath, "utf-8");

  it("is a client component", () => {
    expect(content).toMatch(/^["']use client["']/m);
  });

  it("reads accounts via useAuthQuery (local-first SWR), not a server fetch", () => {
    expect(content).toContain("useAuthQuery");
    expect(content).toContain('["googleAccounts"]');
  });

  it("fires a background sync on open + keeps the manual Sync now button", () => {
    expect(content).toContain("useGoogleSync");
    expect(content).toContain("silent: true");
    expect(content).toContain("SyncNowButton");
  });

  it("renders the CrmWorkspace contacts surface (table + detail panel)", () => {
    expect(content).toContain("CrmWorkspace");
  });
});

describe("CrmWorkspace — contacts table + detail panel", () => {
  const wsPath = path.join(crmDir, "_components/crm-workspace.tsx");
  const editorPath = path.join(crmDir, "_components/contact-links-editor.tsx");
  const threadPath = path.join(crmDir, "_components/contact-thread.tsx");
  const ws = fs.readFileSync(wsPath, "utf-8");
  const editor = fs.readFileSync(editorPath, "utf-8");
  const thread = fs.readFileSync(threadPath, "utf-8");

  it("filters + paginates contacts via listGoogleContacts", () => {
    expect(ws).toContain("listGoogleContacts");
    expect(ws).toContain('["googleContacts"');
    expect(ws).toContain("Load more");
  });

  it("links a contact to orgs/brands/features and saves via saveContactLinks", () => {
    expect(editor).toContain("saveContactLinks");
    expect(editor).toContain("Organizations");
    expect(editor).toContain("Brands");
    expect(editor).toContain("Features");
    expect(editor).toContain("/api/admin/orgs");
    expect(editor).toContain("listAdminBrands");
  });

  it("shows the per-contact Gmail thread filtered by participant, newest first", () => {
    expect(thread).toContain("listGoogleMessages");
    expect(thread).toContain("participant");
    expect(thread).toContain('["googleMessages"');
  });
});

describe("Typed google-service readers (additive/optional + safeParse)", () => {
  const content = fs.readFileSync(apiPath, "utf-8");

  it("declares typed message + contact readers hitting the locked paths", () => {
    expect(content).toContain("listGoogleMessages");
    expect(content).toContain("listGoogleContacts");
    expect(content).toContain("listGoogleAccounts");
    expect(content).toContain("/orgs/google/messages");
    expect(content).toContain("/orgs/google/contacts");
  });

  it("safeParses list responses (wire-shape rot → caught error)", () => {
    expect(content).toContain("GoogleMessagesPageSchema.safeParse");
    expect(content).toContain("GoogleContactsPageSchema.safeParse");
  });

  it("typed fields are optional (additive rollout) — nullish, not required", () => {
    expect(content).toContain("fromEmail: z.string().nullish()");
    expect(content).toContain("displayName: z.string().nullish()");
  });
});

describe("Persist allowlist", () => {
  const content = fs.readFileSync(persistCachePath, "utf-8");

  it("persists the tiny googleAccounts root (connect-state)", () => {
    expect(content).toContain('"googleAccounts"');
  });

  it("does NOT persist the message/contact entity lists (invariant)", () => {
    expect(content).not.toContain('"googleMessages"');
    expect(content).not.toContain('"googleContacts"');
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
