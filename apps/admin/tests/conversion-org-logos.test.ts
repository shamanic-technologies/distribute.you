import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

describe("Conversion table company logos via logo.dev (DIS-246)", () => {
  const table = read("components/revenue/conversions-table.tsx");
  const parse = read("lib/revenue-parse.ts");
  const view = read("lib/revenue-view.ts");

  it("OrgLogo builds a logo.dev URL from the company domain", () => {
    expect(table).toContain("img.logo.dev/");
    expect(table).toContain("function orgLogoSrc(");
    // backend logo wins, then domain → logo.dev, else initial fallback.
    expect(table).toContain("if (logoUrl) return logoUrl;");
  });

  it("both org + lead rows pass orgDomain to OrgLogo", () => {
    expect(table).toContain("domain={o.orgDomain}");
    expect(table).toContain("domain={l.orgDomain}");
  });

  it("parser accepts orgDomain (nullish so it survives until the backend field ships)", () => {
    // Appears on both the org and lead schemas.
    expect(parse.match(/orgDomain: z\.string\(\)\.nullish\(\)/g)?.length).toBe(2);
    expect(view).toContain("orgDomain?: string | null");
  });
});
