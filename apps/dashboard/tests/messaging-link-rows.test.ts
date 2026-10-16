import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { linkErrorMessage } from "../src/lib/integration-write";
import { SENSITIVE_QUERY_ROOTS } from "../src/lib/persist-cache";
import { accountsOfChannel, linkPollMs, startMethods } from "../src/lib/messaging-accounts";

const SRC = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

describe("messaging apps link self-serve from Integrations", () => {
  it("mounts on the Integrations card", () => {
    expect(read("components/settings/brand-integrations-card.tsx")).toContain('rows.push(<MessagingLinkRows key="messaging" brandId={brandId} />);');
  });

  it("names the brand on the query string of every link call (the gateway reads no body)", () => {
    const api = read("lib/api.ts");
    const block = api.slice(api.indexOf("export async function listMatrixLinks("), api.indexOf("// ==================== POSTHOG + STRIPE"));
    expect(block.match(/brandId=\$\{encodeURIComponent\(brandId\)\}/g)?.length).toBe(5);
  });

  it("polls fast while a code is on screen, slower while an account is logged out, never otherwise", () => {
    expect(read("components/settings/messaging-link-rows.tsx")).toContain("linkPollMs(query.state.data?.accounts ?? [])");
    expect(linkPollMs([{ status: "waiting" }, { status: "linked" }])).toBe(3_000);
    // Re-linked Telegram 2026-10-15: the code was accepted, the bridge reconnected seconds later,
    // and the row said "Needs attention" until a manual reload.
    expect(linkPollMs([{ status: "linked", bridgeState: { state: "BAD_CREDENTIALS" } }])).toBe(10_000);
    expect(linkPollMs([{ status: "linked", needsRelink: true }])).toBe(10_000);
    expect(linkPollMs([{ status: "linked", bridgeState: { state: "CONNECTED" } }, { status: "failed" }])).toBe(false);
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

  it("LinkedIn starts with its own form; cookies are never a START method", () => {
    expect(startMethods(["password", "cookies"])).toEqual(["password"]);
    expect(startMethods(["phone", "qr"])).toEqual(["qr", "phone"]);
    const rows = read("components/settings/messaging-link-rows.tsx");
    expect(rows).toContain("answerMatrixLink(brandId, link.channel, linkId, input)");
    expect(rows).toContain("answer.mutate(values)");
    expect(rows).toContain('link.input?.type === "user_input"');
  });

  it("each linked account says whether the assistant may send from it (SOPHIE-WA-1016)", () => {
    const rows = read("components/settings/messaging-link-rows.tsx");
    // Only on a LINKED account, and only once crm-service serves the field.
    expect(rows).toContain("{linked && linkId && link.automationAllowed !== undefined ? (");
    expect(rows).toContain("Assistant sends from this number");
    expect(rows).toContain('role="switch"');
    expect(rows).toContain("aria-checked={allowed}");
    expect(rows).toContain("updateMatrixLink(brandId, linkId, { automationAllowed: next })");
    expect(rows).toContain("{!allowed ? <p");
    expect(rows).toContain("Mirrored in your inbox. Nothing automatic is sent from it.");
  });

  it("each linked account has a persona; an empty one speaks as the sales rep and clears it", () => {
    const rows = read("components/settings/messaging-link-rows.tsx");
    expect(rows).toContain("Speaks as");
    expect(rows).toContain("Leave empty to speak as your sales rep.");
    expect(rows).toContain("Instructions (optional)");
    expect(rows).toContain("{ name: p.name, role: p.role, instructions: p.instructions } : null");
    expect(rows).toContain("<SettingsSaveRow dirty={dirty}");
    // A write re-reads the list under the key the rows read.
    expect(rows).toContain('queryClient.invalidateQueries({ queryKey: ["matrixLinks", brandId] })');
  });

  it("the update names the brand in the query AND the body, and parses crm-service's answer", () => {
    const api = read("lib/api.ts");
    const fn = api.slice(api.indexOf("export async function updateMatrixLink("), api.indexOf("export async function unlinkMatrixLink("));
    expect(fn).toContain("?brandId=${encodeURIComponent(brandId)}");
    expect(fn).toContain("body: { brandId, ...patch }");
    expect(fn).toContain('method: "PATCH"');
    expect(fn).toContain("z.object({ link: MatrixLinkSchema }).safeParse(raw)");
    // Not yet live everywhere: an older crm-service answers without them.
    expect(api).toContain("automationAllowed: z.boolean().optional(),");
    expect(api).toContain(".object({ name: z.string().nullish(), role: z.string().nullish(), instructions: z.string().nullish() })\n    .nullish(),");
  });

  it("a cookies step (LinkedIn's login, 2026-10-10) shows a paste box instead of a dead 'Waiting for you'", () => {
    const rows = read("components/settings/messaging-link-rows.tsx");
    expect(rows).toContain('link.input?.type === "cookies" && link.input.cookies ? link.input.cookies : null');
    expect(rows).toContain("{waiting && !form && !session ? (");
    expect(rows).toContain("sessionValues(session.fields, parsePastedHeaders(pasted))");
    expect(rows).toContain("answer.mutate(read.values)");
    expect(read("lib/api.ts")).toContain("sources: z.array(z.object({ type: z.string(), name: z.string() })),");
  });
});
