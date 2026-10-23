import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nextUniboxSort, uniboxQuery, uniboxSortArrow } from "../src/lib/unibox-leads";

const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");

// PEOPLE-SORT-BY-COMPANY-1023: Records > People orders on the column headers, by lead-service.
describe("People column sort", () => {
  it("cycles each column through its served orders and back to the default", () => {
    expect(nextUniboxSort("company", null)).toBe("company_asc");
    expect(nextUniboxSort("company", "company_asc")).toBe("company_desc");
    expect(nextUniboxSort("company", "company_desc")).toBe(null);
    expect(nextUniboxSort("stage", "company_asc")).toBe("stage_desc");
    expect(nextUniboxSort("stage", "stage_desc")).toBe("stage_asc");
    expect(nextUniboxSort("lastTouch", null)).toBe("last_touch_asc");
    expect(nextUniboxSort("lastTouch", "last_touch_asc")).toBe(null);
    expect(nextUniboxSort("lastTouch", "company_asc")).toBe("last_touch_asc");
  });

  it("shows the arrow on the column in force only", () => {
    expect(uniboxSortArrow("lastTouch", null)).toBe("desc");
    expect(uniboxSortArrow("company", null)).toBe(null);
    expect(uniboxSortArrow("company", "company_desc")).toBe("desc");
    expect(uniboxSortArrow("lastTouch", "company_asc")).toBe(null);
    expect(uniboxSortArrow("stage", "stage_asc")).toBe("asc");
  });

  it("sends the sort only when one is picked", () => {
    expect(uniboxQuery("b1", {}, { limit: 50 })).not.toContain("sort=");
    expect(uniboxQuery("b1", {}, { limit: 50, sort: "company_asc" })).toContain("sort=company_asc");
  });

  it("the People page asks lead-service for the order and drops the cursor on a sort change", () => {
    const src = read("components/v2/people-lifecycle-page.tsx");
    expect(src).toContain('<SortTh column="company" label="Company"');
    expect(src).toContain("cursor: cursors[page], sort }");
    expect(src).toContain("useEffect(() => setCursors([null]), [tab?.key, search, fKey, sort]);");
  });
});
