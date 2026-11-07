import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("sidebar Outcomes list every published outcome with a row (SOCIAL-OUTCOMES-1107)", () => {
  const shell = read("src/components/v2/v2-shell.tsx");
  const at = shell.indexOf('<Group title="Outcomes">');
  const group = shell.slice(at, shell.indexOf("</Group>", at));

  it("reads the Overview's own published reads, so the counts agree", () => {
    expect(shell).toContain("const published = usePublishedOutcomes(brandId);");
    expect(read("src/components/v2/outcomes-page.tsx")).toContain("const published = usePublishedOutcomes(brandId);");
  });

  it("one entry per outcome that has a row, its badge the page's How many figure", () => {
    expect(group).toContain("published.withRows.filter(");
    expect(group).toContain("n={data.totals.all.units}");
    expect(group).toContain("href={v2OutcomeHref(orgId, brandId, key)}");
  });

  it("the entry wears its served name and step icon", () => {
    const fn = shell.slice(shell.indexOf("function PublishedOutcomeNavItem("), shell.indexOf("function OutcomeMark("));
    expect(fn).toContain("usePublishedOutcomeLabel(outcomeKey)");
    expect(fn).toContain("<OutcomeMark outcomeKey={outcomeKey}");
    expect(fn).toContain("trailing={<Count n={n} />}");
  });
});
