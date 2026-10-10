import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { conversationItemTag, standingTag } from "../src/lib/conversation-timeline";

/**
 * Owner 2026-10-10: in the people list every Cold lead's tag was grey (its family's colour),
 * "Website visit" included. A person's tag takes the colour the thread gives the same fact.
 */
describe("a person's tag is coloured like the same fact in the thread", () => {
  it("Contacted stays grey; Website visit amber like the thread; an opt-out red", () => {
    expect(standingTag("contacted", "Contacted").tone).toBe("neutral");
    expect(standingTag("website_visit", "Website visit").tone).toBe(conversationItemTag("website_visit").tone);
    expect(standingTag("website_visit", "Website visit").icon).toBe("visit");
    expect(standingTag("opted_out", "Opted out").tone).toBe(conversationItemTag("unsubscribed").tone);
    expect(standingTag("sales_interest", "Sales interest").tone).toBe("hot");
    expect(standingTag("customer", "Customer").tone).toBe("won");
    expect(standingTag("engaged", "Engaged").tone).toBe("reply");
    expect(standingTag("not_interested", "Not interested").tone).toBe("lost");
  });

  it("keeps the caller's label and stays neutral on a word it does not know", () => {
    expect(standingTag("something_new", "Something new")).toEqual({ label: "Something new", tone: "neutral", icon: "dot" });
  });

  it("the list row and the thread header both draw it, never the family's colour", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/integrations-conversations.tsx"), "utf8");
    expect(src).toContain("standingTag(state, label)");
    expect(src.match(/<PersonTag label=\{status\} state=\{person\.state\} \/>/g)?.length).toBe(2);
    expect(src).not.toContain("familyLook(");
  });
});
