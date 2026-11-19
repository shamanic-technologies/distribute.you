import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DISTRY-PRINCIPAL-1119: Monitoring > Chat > Distry edits Distry's definition (chat-service, versioned)
// and lists every Engine of the live catalogue with the served "callable / why not" verdict.
const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");
const view = read("components/v2/monitoring-distry.tsx");
const page = read("components/v2/monitoring-page.tsx");
const api = read("lib/api.ts");

describe("Monitoring > Distry", () => {
  it("is a Monitoring page rendered by DistryView, with a hub card", () => {
    expect(read("lib/monitoring/monitoring.ts")).toContain('"chat/distry"');
    expect(page).toContain('{view.page === "chat/distry" && <DistryView />}');
    expect(page).toContain('href={href("chat/distry")}');
  });

  it("reads and writes through the staff gateway paths", () => {
    expect(api).toContain("distryConfig: ");
    expect(api).toContain("distryEngines: ");
    for (const fn of ["getStaffDistryConfig", "getStaffDistryVersions", "saveStaffDistryConfig", "restoreStaffDistryVersion", "getStaffDistryEngines"]) {
      expect(view).toContain(fn);
    }
  });

  it("renders the Engines in the served order with the served reason", () => {
    const at = view.indexOf("function EnginesTable(");
    const body = view.slice(at, view.indexOf("function VersionsTable(", at));
    expect(body).not.toContain(".sort(");
    expect(body).not.toContain(".filter(");
    expect(body).toContain("e.reason");
  });

  it("re-reads after a write instead of reloading the page", () => {
    expect(view).toContain('refetchQueries({ queryKey: ["staffDistryVersions"] })');
    expect(view).not.toContain("location.reload");
  });
});
