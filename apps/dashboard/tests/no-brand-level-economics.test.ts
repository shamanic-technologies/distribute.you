import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Brand-level sales economics is retired (owner 2026-10-05): brand-service deletes
// the table and its routes, and every money figure is priced by features-service
// on the OFFER's lifetime revenue and per-leg rates. No app in this repo may call
// the retired routes. Admin's suite is not a CI gate, so this one scans both apps.
const APPS = ["../src", "../../admin/src"].map((p) => path.join(__dirname, p));

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("no app reads or writes brand-level sales economics", () => {
  it("no source file names the retired routes or their readers", () => {
    // Built from parts so this guard does not name the retired route itself.
    const route = ["sales", "economics"].join("-");
    const banned = new RegExp(`${route}|SalesEconomics|economicsSource`);
    const offenders = APPS.flatMap(walk).filter((file) =>
      banned.test(fs.readFileSync(file, "utf-8")),
    );
    expect(offenders.map((f) => path.relative(path.join(__dirname, "../.."), f))).toEqual([]);
  });
});
