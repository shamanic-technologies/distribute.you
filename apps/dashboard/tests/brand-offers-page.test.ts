import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("the campaigns table across every offer", () => {
  it("keeps every offer's campaigns spanning the channels it is sold through", () => {
    const rows = read("src/components/campaigns/campaigns-table.tsx");
    expect(rows).toContain('export const ALL_OFFERS = "*";');
    expect(rows).toContain(
      "offerId === ALL_OFFERS ? c.offerId != null : c.offerId === offerId",
    );
  });
});
