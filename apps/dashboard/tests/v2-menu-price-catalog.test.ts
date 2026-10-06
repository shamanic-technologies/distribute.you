import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Owner 2026-10-06: the account menu links the public price catalog, marked as leaving the app. */
const src = readFileSync(path.join(__dirname, "../src/components/v2/sidebar-menus.tsx"), "utf8");
const menu = src.slice(src.indexOf("export function AccountMenuV2("));

describe("account menu: Price catalog", () => {
  it("sits right after Billing and points at the public page", () => {
    const billing = menu.indexOf('label: "Billing"');
    const catalog = menu.indexOf('label: "Price catalog"');
    expect(billing).toBeGreaterThan(0);
    expect(catalog).toBeGreaterThan(billing);
    expect(catalog).toBeLessThan(menu.indexOf('label: "Refer a friend"'));
    expect(src).toContain('const PRICE_CATALOG_URL = "https://distribute.you/catalog";');
  });

  it("opens in a new tab with the external mark", () => {
    expect(menu).toContain('target="_blank" rel="noopener noreferrer"');
    expect(menu).toContain("d={MENU_ICON.external}");
  });
});
