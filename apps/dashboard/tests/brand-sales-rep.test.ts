import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const CARD = readFileSync("src/components/settings/brand-sales-rep-card.tsx", "utf8");
const PAGE = readFileSync("src/components/v2/brand-settings-page.tsx", "utf8");
const API = readFileSync("src/lib/api.ts", "utf8");
const PERSIST = readFileSync("src/lib/persist-cache.ts", "utf8");

/**
 * A `not.toContain` guard reads the file its own explanation lives in, so a comment
 * that NAMES the forbidden literal fails the guard for the code that obeys it. Both
 * assertions below tripped on this card's own doc comment before it was stripped —
 * reword-the-comment is the other fix and it degrades the explanation, so strip.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const CARD_CODE = stripComments(CARD);

/** The function body, bounded by the next top-level declaration rather than a measured length. */
function sliceToNextExport(src: string, marker: string): string {
  const at = src.indexOf(marker);
  expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
  const next = src.indexOf("\nexport ", at + marker.length);
  return src.slice(at, next === -1 ? undefined : next);
}

describe("the brand states one person to reach", () => {
  it("is mounted on brand Settings, not on a campaign or offer surface", () => {
    expect(PAGE).toContain("<BrandSalesRepCard brandId={brandId}");
  });

  it("reads and writes the REP through the gateway, not the deprecated phone alias", () => {
    expect(API).toContain("`/brands/${brandId}/sales-rep`");
    expect(API).not.toContain("sales-rep-phone");
  });

  it("asks for the EMAIL as well as the number — the email is what the fleet copies", () => {
    expect(CARD).toContain('id="sales-rep-email"');
    expect(CARD).toContain('id="sales-rep-phone"');
  });

  it("sends BOTH facts on every write, because the write replaces the whole rep", () => {
    const body = sliceToNextExport(CARD, "const save = useMutation(");
    expect(body).toMatch(
      /setBrandSalesRep\(brandId, \{\s*salesRepEmail,\s*salesRepPhone,\s*salesRepFirstName,\s*salesRepRole,\s*\}\)/,
    );
  });

  it("asks for the rep's first name and role, both optional, to introduce them in the thread", () => {
    expect(CARD).toContain('id="sales-rep-first-name"');
    expect(CARD).toContain('id="sales-rep-role"');
    expect(CARD).toContain("introduce this person when we copy them into a prospect");
    // The producer's caps, as a courtesy; brand-service's 400 still decides.
    expect(CARD).toContain("maxLength={60}");
    expect(CARD).toContain("maxLength={100}");
  });

  it("sends a blank name or role as null, so clearing it on screen clears it stored", () => {
    // brand-service leaves an OMITTED name or role untouched, so the card never omits them.
    const body = sliceToNextExport(CARD, "const save = useMutation(");
    expect(body).toContain("const salesRepFirstName = next.firstName.trim() || null;");
    expect(body).toContain("const salesRepRole = next.role.trim() || null;");
  });

  it("a name or role alone is not a rep: removing email and phone removes it", () => {
    expect(CARD).toContain("return Boolean(rep.salesRepEmail || rep.salesRepPhone);");
  });

  it("clears by asking the producer to remove it, never by writing empty strings", () => {
    const body = sliceToNextExport(CARD, "const save = useMutation(");
    expect(body).toContain("clearBrandSalesRep(brandId)");
    expect(body).not.toContain('setBrandSalesRep(brandId, { salesRepEmail: "", salesRepPhone: "" })');
  });

  it("writes the response into the cache instead of re-reading it", () => {
    const body = sliceToNextExport(CARD, "const save = useMutation(");
    expect(body).toContain('queryClient.setQueryData(["brandSalesRep", brandId], next)');
    expect(body).not.toContain("invalidateQueries");
  });

  it("re-seeds from a fresher payload rather than latching once per mount", () => {
    // The first payload to settle is the on-disk one, so a boolean hydrated latch
    // would seed from the previous visit and ignore the server's answer.
    expect(CARD).toContain("seededFrom");
    expect(CARD).not.toContain("if (hydrated.current) return");
  });

  it("arms Save on a live compare of BOTH fields, never a sticky edited flag", () => {
    expect(CARD).toContain('email.trim() !== (saved.salesRepEmail ?? "")');
    expect(CARD).toContain('phone.trim() !== (saved.salesRepPhone ?? "")');
  });

  it("holds Save while a phone has no email beside it", () => {
    expect(CARD).toContain(
      "const phoneWithoutEmail = phone.trim().length > 0 && email.trim().length === 0;",
    );
    expect(CARD).toContain("disabled={phoneWithoutEmail}");
  });

  it("states WHY the phone alone is held, rather than greying a button with no reason", () => {
    // A disabled primary action with nothing beside it reads as a dead control.
    expect(CARD).toContain("{phoneWithoutEmail && (");
    expect(CARD).toContain("Add the email as well.");
  });

  it("an email with NO phone stays saveable — that rep is copied and never rung", () => {
    // The gate is one-directional on purpose: the AI meeting-booking channel
    // wants a rep it copies and never calls.
    expect(CARD).not.toContain("emailWithoutPhone");
  });

  it("renders the producer's own refusal and never err.message", () => {
    const body = sliceToNextExport(CARD, "function saveErrorMessage(");
    expect(body).toContain("body?.error");
    expect(CARD_CODE).not.toContain("err.message");
    expect(CARD_CODE).not.toContain("error.message");
  });

  it("does not re-implement what a valid rep is — brand-service owns that", () => {
    // A second copy of either rule is how the two come to disagree, and the
    // disagreement is a conversation forwarded to the wrong human.
    expect(CARD_CODE).not.toMatch(/E\.164|\\d\{8,15\}|replace\(\/\\D/);
    expect(CARD_CODE).not.toMatch(/@.*\\\.|includes\("@"\)|indexOf\("@"\)/);
  });

  it("says nobody is reached rather than showing two unexplained empty fields", () => {
    expect(CARD).toContain("No rep set, so nobody is copied or rung when a reply lands.");
  });

  it("persists its query root, so the fields paint from disk instead of cold-loading", () => {
    expect(PERSIST).toContain('"brandSalesRep"');
    expect(PERSIST).not.toContain('"brandSalesRepPhone"');
  });
});

describe("reading the rep's first name and role", () => {
  it("reads them when brand-service serves them, and null when it does not yet", async () => {
    const { NO_SALES_REP } = await import("../src/lib/api");
    expect(NO_SALES_REP).toEqual({
      salesRepEmail: null,
      salesRepPhone: null,
      salesRepFirstName: null,
      salesRepRole: null,
    });
    expect(API).toContain("salesRepFirstName: z.string().nullable().default(null)");
    expect(API).toContain("salesRepRole: z.string().nullable().default(null)");
  });
});
