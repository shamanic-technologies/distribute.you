import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");

// COMPANY-PEOPLE-COUNT-1023: a company row says how many people sit behind its best contact.
describe("Companies people count", () => {
  it("parses the served peopleCount on every company row", () => {
    expect(read("lib/revenue-parse.ts")).toContain("peopleCount: z.number().int().optional(),");
    expect(read("lib/revenue-view.ts")).toContain("peopleCount?: number;");
  });

  it("the list and the board print +N beside the best contact, and the column says People", () => {
    const src = read("components/v2/companies-page.tsx");
    expect(src).toContain("<th className={REC_TH}>People</th>");
    expect(src.match(/\+\{formatCount\(o\.peopleCount - 1\)\}/g)?.length).toBe(2);
  });
});
