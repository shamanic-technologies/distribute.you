import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { linkErrorMessage } from "../src/lib/integration-write";
import { SENSITIVE_QUERY_ROOTS } from "../src/lib/persist-cache";
import { accountsOfChannel, startMethods } from "../src/lib/messaging-accounts";

const SRC = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("messaging apps link self-serve from Integrations", () => {
  it("mounts on the Integrations card", () => {
    expect(read("components/settings/brand-integrations-card.tsx")).toContain('rows.push(<MessagingLinkRows key="messaging" brandId={brandId} />);');
  });

  it("names the brand on the query string of every link call (the gateway reads no body)", () => {
    const api = read("lib/api.ts");
    const block = api.slice(api.indexOf("export async function listMatrixLinks("), api.indexOf("// ==================== POSTHOG + STRIPE"));
    expect(block.match(/brandId=\$\{encodeURIComponent\(brandId\)\}/g)?.length).toBe(4);
  });

  it("polls fast only while a code is on screen", () => {
    const rows = read("components/settings/messaging-link-rows.tsx");
    expect(rows).toContain('accounts.some((l) => l.status === "waiting") ? WAITING_POLL_MS : false');
  });

  it("never writes a live login code to disk", () => {
    expect(SENSITIVE_QUERY_ROOTS.has("matrixLinks")).toBe(true);
  });

  it("states a channel that is not available, with crm-service's reason, and no button", () => {
    const rows = read("components/settings/messaging-link-rows.tsx");
    expect(rows).toContain('label: "Not available yet", title: link.unavailableReason ?? undefined');
    expect(rows).toContain("{!link.available || attempting ? null : (");
  });

  it("passes the app's own refusal through", () => {
    // The served 422 shape, probed live 2026-10-01.
    expect(
      linkErrorMessage({ status: 422, body: { type: "bridge", bridgeError: { code: "FI.MAU.WHATSAPP.PHONE_NUMBER_TOO_SHORT", message: "Phone number too short" } } }),
    ).toBe("Phone number too short");
    expect(linkErrorMessage({ status: 409, body: { error: "Linking Telegram is not available yet." } })).toBe("Linking Telegram is not available yet.");
    expect(linkErrorMessage({ status: 502 })).toBe("We could not reach the app just now. Try again in a moment.");
  });

  it("a channel holds several accounts, each unlinked alone by its id (owner 2026-10-10)", () => {
    const rows = read("components/settings/messaging-link-rows.tsx");
    expect(rows).toContain("accountsOfChannel(data, link.channel)");
    expect(rows).toContain("unlinkMatrixLink(brandId, link.channel, linkId)");
    expect(rows).toContain('linkedCount > 0 ? "Add another account" : "Link"');
    expect(accountsOfChannel({ accounts: [{ channel: "whatsapp", n: 1 }, { channel: "linkedin", n: 2 }, { channel: "whatsapp", n: 3 }] }, "whatsapp").map((a) => a.n)).toEqual([1, 3]);
  });

  it("LinkedIn logs in with its own form; cookies are never offered to a customer", () => {
    expect(startMethods(["password", "cookies"])).toEqual(["password"]);
    expect(startMethods(["phone", "qr"])).toEqual(["qr", "phone"]);
    const rows = read("components/settings/messaging-link-rows.tsx");
    expect(rows).toContain("answerMatrixLink(brandId, link.channel, linkId, values)");
    expect(rows).toContain('link.input?.type === "user_input"');
  });
});
