import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The signup and sign-in screens are what a visitor reads SECONDS after the
 * landing, so they state the landing's own promise or the product contradicts
 * itself across one click.
 *
 * These guards used to pin the OPPOSITE: a retired charter ("The Stripe of
 * Distribution", "Your distribution, automated.") that the served landing stopped
 * saying two generations ago. A guard that pins stale copy is worse than no guard,
 * because it makes the staleness look deliberate. The banned list below is those
 * exact strings, so they cannot come back.
 *
 * The panel itself is ONE component mounted by both pages. Asserting each page
 * MOUNTS it, rather than asserting the copy inside each page, is the point: two
 * copies of one panel is how the two screens drifted from each other.
 */
describe("Auth pages branding", () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf-8");

  const signInPath = "src/app/(authed)/sign-in/[[...sign-in]]/page.tsx";
  const signUpPath = "src/app/(authed)/sign-up/[[...sign-up]]/page.tsx";
  const panelPath = "src/components/auth/auth-brand-panel.tsx";

  const signInContent = read(signInPath);
  const signUpContent = read(signUpPath);
  const panel = read(panelPath);

  it("names the brand distribute.you, never the bare verb", () => {
    expect(signInContent).toContain("distribute.you");
    expect(signInContent).not.toContain("MCP Factory");
    expect(signInContent).not.toContain("mcpfactory");
  });

  it("names the brand distribute.you on sign-up too", () => {
    expect(signUpContent).toContain("distribute.you");
    expect(signUpContent).not.toContain("MCP Factory");
    expect(signUpContent).not.toContain("mcpfactory");
  });

  it("mounts the ONE shared brand panel on both pages", () => {
    for (const [name, source] of [
      [signInPath, signInContent],
      [signUpPath, signUpContent],
    ] as const) {
      expect(`${name}:${source.includes("<AuthBrandPanel />")}`).toBe(`${name}:true`);
      expect(source).toContain('from "@/components/auth/auth-brand-panel"');
    }
  });

  it("states the served landing's headline, offer and proof line", () => {
    // Verbatim from apps/landing/public/landing/index-v2.html.
    expect(panel).toContain("revenue in 24h");
    expect(panel).toContain("From $1/day");
    expect(panel).toContain("First $30 free, no commitment");
    expect(panel).toContain(
      "We run multiple acquisition channels for you and you keep the one"
    );
    expect(panel).toContain("get booked meetings for");
  });

  it("never states a retired charter", () => {
    const RETIRED = [
      "The Stripe of Distribution",
      "Your distribution,",
      "distribution, automated",
      "Zero config",
      "Transparent variable costs",
      "Data-driven",
      "JetBrains Mono",
    ];
    for (const claim of RETIRED) {
      for (const [name, source] of [
        [signInPath, signInContent],
        [signUpPath, signUpContent],
        [panelPath, panel],
      ] as const) {
        expect(`${name}:${claim}:${source.includes(claim)}`).toBe(
          `${name}:${claim}:false`
        );
      }
    }
  });

  it("carries no beta chip on either screen", () => {
    // The product is GA. A chip saying otherwise on the first screen after the
    // landing reads as a disclaimer the landing never made.
    for (const [name, source] of [
      [signInPath, signInContent],
      [signUpPath, signUpContent],
      [panelPath, panel],
    ] as const) {
      expect(`${name}:${/>\s*beta\s*</.test(source)}`).toBe(`${name}:false`);
    }
  });

  it("colours the panel from the brand ramp, never a literal charter value", () => {
    // :root[data-brand-tint] re-declares the brand-* ramp at the customer's own
    // hue, so an arbitrary hex or oklch is the one control that stays our blue.
    expect(panel).toContain("text-brand-600");
    expect(panel).toContain("bg-brand-50");
    expect(/#[0-9a-fA-F]{6}/.test(panel)).toBe(false);
    expect(panel).not.toContain("oklch(");
  });

  it("reads the landing display face", () => {
    expect(panel).toContain("font-display");
  });

  it("finishes signup with the landing's own CTA word", () => {
    expect(signUpContent).toContain('"Start free"');
  });

  it("sign-in page should link to distribute.you", () => {
    expect(signInContent).toContain("distribute.you");
    expect(panel).toContain("https://distribute.you");
  });

  it("keeps a sign-in door on the sign-up screen at every width", () => {
    // The brand panel is hidden below lg, so the way back into an existing
    // account has to live in the form column, which renders at every width.
    expect(signUpContent).toContain('href="/sign-in"');
  });

  it("uses logo-distribute.svg", () => {
    expect(panel).toContain("logo-distribute.svg");
    expect(signUpContent).toContain("logo-distribute.svg");
    expect(signInContent).toContain("logo-distribute.svg");
  });
});

describe("Onboarding page should not reference mcpfactory", () => {
  const onboardingPath = path.join(
    __dirname,
    "../src/components/onboarding/onboarding.tsx"
  );
  const content = fs.readFileSync(onboardingPath, "utf-8");

  it("should use Clerk SDK for org creation and not reference mcpfactory", () => {
    expect(content).toContain("createOrganization");
    expect(content).toContain("@clerk/nextjs");
    expect(content).not.toContain("mcpfactory");
  });
});

describe("the dashboard wears the landing's charter", () => {
  const globals = fs.readFileSync(
    path.join(__dirname, "../src/app/globals.css"),
    "utf-8"
  );
  const landing = fs.readFileSync(
    path.join(__dirname, "../../landing/public/landing/v2/styles.css"),
    "utf-8"
  );

  it("declares the display face the served landing declares", () => {
    // Read from the landing rather than restated here: the charter is its
    // stylesheet's answer, and a second copy of the name drifts.
    const face = landing.match(/--font-display:\s*"([^"]+)"/)?.[1];
    expect(face).toBe("Fustat");
    expect(globals).toContain(`--font-display: "${face}"`);
  });

  it("actually LOADS that face, rather than silently falling back to Inter", () => {
    // Space Grotesk was named as the display token for months and was loaded by
    // nothing, so every heading rendered Inter while the token claimed otherwise.
    expect(globals).toContain("family=Fustat");
    expect(globals).not.toContain("Space+Grotesk");
    expect(globals).not.toContain("Space Grotesk");
  });

  it("reads the landing's mono", () => {
    const mono = landing.match(/--font-mono:\s*"([^"]+)"/)?.[1];
    expect(mono).toBe("DM Mono");
    expect(globals).toContain(`--font-mono: "${mono}"`);
    expect(globals).toContain("family=DM+Mono");
  });

  it("takes the landing's heading weight as a BASE a utility can still beat", () => {
    // Unlayered, this rule outranks every font-bold utility in the app and
    // flattens all 93 headings. Layered, it is the weight a heading reads when
    // it states none.
    const at = globals.indexOf("@layer base {\n  h1, h2, h3, .font-display {");
    expect(at).toBeGreaterThan(-1);
    expect(globals.slice(at, globals.indexOf("}", globals.indexOf("}", at) + 1))).toContain(
      "font-weight: 400"
    );
  });

  it("remaps the most prominent heading token for the dark surface", () => {
    // text-gray-950 had no rule, so a card heading rendered near-black on dark.
    expect(globals).toContain("html.dark .text-gray-950");
  });
});

describe("brand name", () => {
  // "distribute" is an ordinary English verb, and an unrelated npm package.
  // The PRODUCT is always distribute.you, so the wordmark a visitor reads and
  // the description a crawler indexes both spell it in full.
  const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf-8");

  const WORDMARK_PAGES = [
    "src/app/(authed)/sign-in/[[...sign-in]]/page.tsx",
    "src/app/(authed)/sign-up/[[...sign-up]]/page.tsx",
    "src/components/auth/auth-brand-panel.tsx",
    "src/app/(authed)/forgot-password/[[...rest]]/page.tsx",
    "src/app/(authed)/session-tasks/choose-organization/page.tsx",
    "src/components/onboarding/onboarding-top-chrome.tsx",
  ];

  it("spells the rendered wordmark in full on every page that draws one", () => {
    for (const page of WORDMARK_PAGES) {
      const bare = read(page)
        .split("\n")
        .filter((line) => line.trim() === "distribute");
      expect(`${page}:${bare.length}`).toBe(`${page}:0`);
    }
  });

  const METADATA_PAGES = [
    "src/app/(authed)/sign-in/[[...sign-in]]/layout.tsx",
    "src/app/(authed)/sign-up/[[...sign-up]]/layout.tsx",
    "src/app/(authed)/forgot-password/[[...rest]]/layout.tsx",
  ];

  it("names the product in full in the description a crawler reads", () => {
    for (const page of METADATA_PAGES) {
      const source = read(page);
      expect(`${page}:${/distribute(?!\.you)/.test(source)}`).toBe(`${page}:false`);
    }
  });
});
