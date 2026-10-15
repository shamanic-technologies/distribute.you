import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

describe("Telegram updates: every member connects their org's Telegram themselves", () => {
  const card = read("src/components/v2/telegram-updates-card.tsx");
  const api = read("src/lib/api.ts");
  const page = read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/account/page.tsx");

  it("is rendered on the Profile page, with no staff gate", () => {
    expect(page).toContain("<TelegramUpdatesCard />");
    expect(card).not.toMatch(/useStaffMode|StaffOnly|useIsAdminUser/);
  });

  it("reads, links and unlinks through the gateway's own-org routes", () => {
    expect(api).toContain("`/orgs/${encodeURIComponent(orgId)}/owner-telegram`, { token }");
    expect(api).toContain("`/orgs/${encodeURIComponent(orgId)}/owner-telegram/link-codes`, { token, method: \"POST\" }");
    expect(api).toContain("`/orgs/${encodeURIComponent(orgId)}/owner-telegram`, { token, method: \"DELETE\" }");
  });

  it("offers Connect, the connected state and Disconnect", () => {
    expect(card).toContain("Connect Telegram");
    expect(card).toContain('"Connected"');
    expect(card).toContain("Disconnect");
    expect(card).toContain("pendingLink.linkUrl");
  });

  it("copy carries no dash", () => {
    expect(card).not.toMatch(/[—–]/);
  });
});
