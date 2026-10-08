import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { QueryClient, QueryObserver, keepPreviousData } from "@tanstack/react-query";
import { ownQueryData } from "../src/lib/own-query-data";

/**
 * Unibox showed the PREVIOUS person's lead-service facts on a CRM-only person
 * (prod 2026-10-08: patti watson carried Erika Jackson's "Interested reply / Meeting
 * booked"). Her lead row is null, so the facts query is re-keyed to a DISABLED key, and
 * the app-wide keepPreviousData keeps handing back the last key's data.
 */
describe("a re-keyed per-person query never shows the previous person's data", () => {
  it("reproduces the hazard and ownQueryData drops it", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { placeholderData: keepPreviousData, retry: false } } });
    const observer = new QueryObserver<{ who: string }>(client, {
      queryKey: ["leadTimeline", "lead-erika"],
      queryFn: async () => ({ who: "erika" }),
    });
    const unsubscribe = observer.subscribe(() => {});
    await client.fetchQuery({ queryKey: ["leadTimeline", "lead-erika"], queryFn: async () => ({ who: "erika" }) });
    expect(ownQueryData(observer.getCurrentResult())).toEqual({ who: "erika" });

    // patti watson: no lead row, query disabled on a new key.
    observer.setOptions({ queryKey: ["leadTimeline", null], queryFn: async () => ({ who: "nobody" }), enabled: false });
    const patti = observer.getCurrentResult();
    expect(patti.data).toEqual({ who: "erika" }); // the hazard: raw data is the previous person's
    expect(ownQueryData(patti)).toBeUndefined();

    // Back to Erika: her facts again.
    observer.setOptions({ queryKey: ["leadTimeline", "lead-erika"], queryFn: async () => ({ who: "erika" }) });
    expect(ownQueryData(observer.getCurrentResult())).toEqual({ who: "erika" });
    unsubscribe();
  });
});

describe("call sites read per-person data through ownQueryData", () => {
  const read = (f: string) => readFileSync(join(__dirname, "../src/components/v2", f), "utf8");

  it("Unibox Thread: facts only for the current lead row, person only for the current key", () => {
    const src = read("integrations-conversations.tsx");
    const thread = src.slice(src.indexOf("function Thread("), src.indexOf("type ThreadRow"));
    expect(thread).toContain("const data = ownQueryData(q);");
    expect(thread).toContain("const facts = leadRowId ? ownQueryData(factsQ) : undefined;");
    expect(thread).not.toContain("factsQ.data");
    expect(thread).not.toContain("q.data");
  });

  it("person page: lead, timeline and history only for the current lead", () => {
    const src = read("person-page.tsx");
    const page = src.slice(src.indexOf("export function PersonPage("));
    expect(page).toContain("ownQueryData(leadQ)");
    expect(page).toContain("ownQueryData(timelineQ)");
    expect(page).toContain("ownQueryData(historyQ)");
    expect(page).not.toMatch(/(leadQ|timelineQ|historyQ)\.data/);
  });
});
