import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A state that reports itself UNFINISHED must offer a way to finish it.
 *
 * Connecting a CRM is two writes — the credential to key-service, the connection
 * to crm-service — so there is a real middle state where the first landed and
 * the second did not. The row has always named it honestly ("Not finished"), and
 * for as long as it existed the only control it rendered was the one that throws
 * the credential away. The customer's own words: they gave both credentials and
 * the row says it is not finished. Their only move was a button called
 * "Disconnect", on something that had never connected.
 *
 * It is the shape this repo already records for the card-removal gate: the
 * surface that reports a failure refuses the only recovery from it. Nothing goes
 * red — every state is correct, every label is true, and the person is stuck.
 *
 * What made it reachable at all was a producer bug (crm-service opened its run
 * with an empty brand list, so the connect answered 502 before any token was
 * read — crm-service#19, distribute.you#4339). That is fixed. This is the half
 * that makes the state recoverable whenever it happens again, for any reason:
 * a refused token, a closed tab, a wrong sub-account id.
 */

const CARD = readFileSync(
  join(process.cwd(), "src/components/settings/brand-integrations-card.tsx"),
  "utf8",
);

describe("the unfinished state has a way forward", () => {
  it("names the state once, off the two reads that decide it", () => {
    expect(CARD).toContain("const unfinished = credentialStored && !connection;");
  });

  it("declares it ABOVE the render that reads it", () => {
    // A const a render reads from an earlier line is a TDZ throw at render time,
    // which tsc cannot see and a source-substring guard cannot see either unless
    // it compares the two positions.
    const decl = CARD.indexOf("const unfinished =");
    const use = CARD.indexOf("unfinished ? \"Finish connecting\"");
    expect(decl).toBeGreaterThan(-1);
    expect(use).toBeGreaterThan(-1);
    expect(decl).toBeLessThan(use);
  });

  it("renders the forward button whenever there is no connection", () => {
    // Keyed on the CONNECTION, never on the credential: the credential being
    // stored is exactly the case that used to lose the button.
    expect(CARD).toContain("{connection ? null : (");
    expect(CARD).toContain('unfinished ? "Finish connecting" : "Connect"');
  });

  it("keeps the way OUT beside it rather than in place of it", () => {
    expect(CARD).toContain("{connection || credentialStored ? (");
    expect(CARD).toContain("setConfirmingRemove(true)");
  });

  it("does not gate the forward button on the credential being absent", () => {
    // The shipped bug, pinned so it cannot come back: one ternary that handed
    // the whole control slot to the remove button the moment a key was stored.
    expect(CARD).not.toContain("{connection || credentialStored ? (\n            confirmingRemove");
  });
});

describe("the remove button says what it removes", () => {
  it("disconnects a connection and removes a credential", () => {
    expect(CARD).toContain('const removeLabel = connection ? "Disconnect" : "Remove";');
  });

  it("uses that label on the button and on its confirmation", () => {
    expect(CARD).toContain("{removeLabel}");
    expect(CARD).toContain("`Yes, ${removeLabel.toLowerCase()}`");
  });

  it("does not promise to stop a sync that never started", () => {
    // Telling somebody nothing ever connected for that "this stops the syncing"
    // is a claim about work that never ran.
    expect(CARD).toContain("This forgets the token you gave us.");
  });
});

describe("a retry keeps the credential it already has", () => {
  it("skips the credential write when the customer left the secret blank", () => {
    expect(CARD).toContain('const typedSecret = (values.token ?? "").trim();');
    expect(CARD).toContain("if (typedSecret || !credentialStored) {");
  });

  it("never writes the raw field, which would blank a working credential", () => {
    // `setBrandKey(brandId, def.slug, values.token ?? "")` on an untouched form
    // destroys the token to answer a question the field says to leave alone.
    expect(CARD).not.toContain('setBrandKey(brandId, def.slug, values.token');
    expect(CARD).toContain("setBrandKey(brandId, def.slug, typedSecret)");
  });

  it("asks missingFields the same question the form answers", () => {
    expect(CARD).toContain("missingFields(def, values, { credentialStored })");
  });

  it("says the secret is optional where the customer is looking", () => {
    expect(CARD).toContain("f.secret && credentialStored");
    expect(CARD).toContain("Leave blank to keep the");
  });
});

describe("the row states what is left to do", () => {
  it("explains the unfinished state rather than leaving the pill to carry it", () => {
    expect(CARD).toContain("We have your token. Finish connecting to check it against");
  });
});
