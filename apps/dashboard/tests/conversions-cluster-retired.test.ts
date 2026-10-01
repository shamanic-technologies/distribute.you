import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const exists = (rel: string) => fs.existsSync(path.join(SRC, rel));

/**
 * The Organizations / Leads conversion tabs never rendered: a whole cluster of
 * tables, a detail panel and a pager sitting behind a prop nobody set.
 */
describe("Conversion tabs cluster — retired", () => {
  it("no longer ships the tabs, the tables, the detail panel or their pager", () => {
    expect(exists("components/revenue/conversions-tabs.tsx")).toBe(false);
    expect(exists("components/revenue/conversions-table.tsx")).toBe(false);
    expect(exists("components/revenue/conversion-detail-panel.tsx")).toBe(false);
    // Its only consumer was the deleted table.
    expect(exists("components/table-pagination.tsx")).toBe(false);
  });
});
