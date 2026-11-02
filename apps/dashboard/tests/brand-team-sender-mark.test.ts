import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isBrandTeamAddress } from "../src/lib/conversation-sources";

describe("a message the brand's own team sent wears its logo (owner 2026-11-02)", () => {
  it("recognises the brand's domain and its subdomains", () => {
    expect(isBrandTeamAddress("chaim@beyondlogic.tech", "beyondlogic.tech")).toBe(true);
    expect(isBrandTeamAddress("Chaim@Mail.BeyondLogic.tech", "www.beyondlogic.tech")).toBe(true);
  });

  it("our own sending mailboxes and unknowns keep the Distribute mark", () => {
    expect(isBrandTeamAddress("kevin.l@hellodistribute.com", "beyondlogic.tech")).toBe(false);
    expect(isBrandTeamAddress("x@notbeyondlogic.tech", "beyondlogic.tech")).toBe(false);
    expect(isBrandTeamAddress(null, "beyondlogic.tech")).toBe(false);
    expect(isBrandTeamAddress("chaim@beyondlogic.tech", null)).toBe(false);
  });

  it("the thread's message header draws the sender's mark through the check", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/integrations-conversations.tsx"), "utf8");
    expect(src).toContain("isBrandTeamAddress(sender.email, brandDomain)");
    expect(src.match(/\{senderMark\(16\)\}/g)?.length).toBe(2);
  });
});
