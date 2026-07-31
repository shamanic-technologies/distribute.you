import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const menu = fs.readFileSync(
  path.join(__dirname, "../src/components/share/share-menu.tsx"),
  "utf-8",
);
const header = fs.readFileSync(
  path.join(__dirname, "../src/components/header.tsx"),
  "utf-8",
);

describe("the Share control replaced the theme toggle", () => {
  it("the header renders the share menu and no theme toggle", () => {
    expect(header).toContain("<ShareMenu />");
    expect(header).not.toContain("ThemeToggle");
  });

  // Light is the only theme now, so nothing may re-apply a stored `dark` class —
  // a user who once toggled dark would otherwise be trapped in it with no
  // control to get out.
  it("no theme provider, and no anti-flash script re-applying a stored theme", () => {
    const layout = fs.readFileSync(
      path.join(__dirname, "../src/app/layout.tsx"),
      "utf-8",
    );
    expect(layout).not.toContain("ThemeProvider");
    expect(layout).not.toContain('localStorage.getItem("theme")');
  });

  it("the toggle and provider files are gone", () => {
    expect(
      fs.existsSync(path.join(__dirname, "../src/components/theme-toggle.tsx")),
    ).toBe(false);
    expect(
      fs.existsSync(path.join(__dirname, "../src/components/theme-provider.tsx")),
    ).toBe(false);
  });
});

describe("the Share control is brand-scoped", () => {
  // The header renders on every page. An unconditional Share button would offer
  // to share billing and API keys, which name no brand at all.
  it("renders nothing off a brand route", () => {
    expect(menu).toContain("brandFromPathname");
    expect(menu).toContain("if (!brand) return null;");
  });
});

describe("opening the menu reads, it does not mint", () => {
  // A brand is not shareable until someone asks. If merely opening the menu
  // minted a credential, the brand would become shareable by accident.
  it("the query on open is the READ", () => {
    // Anchor on the CALL, not the bare symbol: `useAuthQuery` also appears on
    // the import line, and `indexOf` takes the first hit.
    const at = menu.indexOf("useAuthQuery<BrandShareToken>(");
    expect(at).toBeGreaterThan(-1);
    // Measured to the closing `);` of the call (215 chars); a `not.toContain`
    // slice must not run past its block into a neighbour.
    const block = menu.slice(at, at + 215);
    expect(block).toContain("getBrandShareToken");
    expect(block).not.toContain("createBrandShareToken");
  });

  it("minting happens only in the click handler", () => {
    const at = menu.indexOf("async function handleShare()");
    expect(at).toBeGreaterThan(-1);
    expect(menu.slice(at)).toContain("createBrandShareToken");
  });
});

describe("errors", () => {
  // `apiCall` sets the thrown Error's message to the downstream body verbatim,
  // so rendering it puts a JSON blob in front of a customer.
  it("never renders the raw upstream error message", () => {
    expect(menu).not.toContain("err.message");
    expect(menu).not.toContain("error.message");
    expect(menu).toContain("console.error");
  });
});

describe("the menu states what the recipient gets", () => {
  // The person clicking is deciding whether to expose their pipeline, so the
  // item says what is and is not included rather than making them find out.
  it("names the exclusions next to the action", () => {
    expect(menu).toContain("No sign-in");
    expect(menu).toMatch(/spend/i);
  });

  it("uses no em-dash in user-facing copy", () => {
    // Copy lives in JSX text; the guard is the repo-wide no-em-dash rule.
    const jsxText = menu
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
      .join("\n");
    expect(jsxText).not.toContain("—");
  });
});
