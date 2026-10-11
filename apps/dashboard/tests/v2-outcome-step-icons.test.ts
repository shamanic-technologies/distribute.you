import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("sidebar Outcomes entries wear their step's catalogue icon (owner 2026-10-11)", () => {
  const shell = read("src/components/v2/v2-shell.tsx");
  const api = read("src/lib/api.ts");

  it("reads the PUBLIC step vocabulary, never the staff-only catalogue", () => {
    expect(api).toContain("apiCall<unknown>(`/public/catalogue/steps`)");
  });

  it("each Outcomes entry renders OutcomeMark with the served icons", () => {
    const at = shell.indexOf("{outcomes.map(");
    const block = shell.slice(at, shell.indexOf("</Group>", at));
    expect(block).toContain("<OutcomeMark outcomeKey={outcome.key}");
    expect(block).toContain("stepIcons={stepIcons}");
    expect(block).not.toContain("ICONS.outcome");
  });

  it("OutcomeMark draws the catalogue icon through CatalogueMark, Posts keeps its glyph", () => {
    const at = shell.indexOf("function OutcomeMark(");
    const body = shell.slice(at, shell.indexOf("\n}\n", at));
    expect(body).toContain("<CatalogueMark icon={icon}");
    expect(body).toContain("POSTS_STEP");
  });
});
