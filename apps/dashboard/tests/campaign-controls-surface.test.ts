import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

const trigger = read("components/campaigns/campaign-controls-trigger.tsx");
const toggle = read("lib/use-scope-toggle.ts");
const crew = read("components/v2/crew-page.tsx");
const api = read("lib/api.ts");

/**
 * Is this running — one press, no modal (owner 2026-10-03: "ne doit plus afficher une
 * modale avec des toggles, mais simplement permettre d'activer ou mettre en pause").
 */
describe("Pause / Activate — one press, no modal", () => {
  it("the controls modal is gone, not hidden", () => {
    expect(existsSync(join(SRC, "components/campaigns/campaign-controls-modal.tsx"))).toBe(false);
    expect(trigger).not.toContain("CampaignControlsModal");
    expect(crew).not.toContain("CampaignControlsModal");
  });

  it("the pill and the crew menu press the ONE shared toggle", () => {
    // A second implementation is how a scope comes to be paused two ways.
    expect(trigger).toContain("useScopeToggle(brandId");
    expect(crew).toContain("useScopeToggle(brandId, scope)");
    expect(crew).toContain("void scopeToggle.toggle()");
  });

  it("a crew press is scoped to the crew's own channel and leg, never the bare brand", () => {
    expect(crew).toContain("featureSlug: crew.featureSlug");
    expect(crew).toContain("legKey: crew.legKey");
  });

  it("writes through campaign-service's STATUS, never by zeroing a ceiling", () => {
    expect(toggle).toContain("setCampaignStatus(");
    expect(toggle).toContain("scopeToggleWrites(rows, activate)");
    expect(toggle).not.toContain("saveCampaignBudget");
  });

  it("sends the identity headers campaign-service validates before an activate", () => {
    const fn = api.slice(api.indexOf("export async function setCampaignStatus"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body).toContain('"x-brand-id"');
    expect(body).toContain('"x-feature-slug"');
  });

  it("says that Activate sends right away", () => {
    expect(trigger).toContain("Sending starts right away.");
  });

  it("renders OUR copy branched on the status, never the downstream body", () => {
    expect(toggle).toContain("controlWriteErrorMessage");
    expect(toggle).not.toContain("err.message");
  });

  it("holds the pressed state until campaign-service agrees, and drops it on refusal", () => {
    expect(toggle).toContain('setPressed(failure ? null : { key: scopeKey, rollup: activate ? "active" : "paused" })');
  });
});

describe("the trigger states money it READS", () => {
  it("adds up only the RUNNING campaigns' ceilings, at every grain it sums", () => {
    expect(trigger).toContain("scopeTotalCents(");
    // v2 counts only the crews that spend every day: an event crew's cap is not daily money.
    expect(trigger).toContain("dailyOnly ? rows.filter((r) => isProactiveFrom(legFor(catalogue, r.legKey)?.fromKey)) : rows");
    const lib = read("lib/campaign-controls.ts");
    expect(lib).toContain("r.running && r.savedCents > 0");
  });

  it("counts one ceiling per campaign, because a row is an identity", () => {
    const lib = read("lib/campaign-controls.ts");
    expect(lib).toContain("runningCampaignIds");
    expect(lib).toContain("pickRepresentative");
  });

  it("prints whole dollars through the one shared formatter", () => {
    expect(trigger).toContain("fmtDailyBudgetUsd");
    expect(trigger).not.toContain("toFixed");
  });
});

describe("the affordance survives a touch screen", () => {
  it('is a role="button" span, never a <button>', () => {
    // It renders inside clickable regions, and a nested button is invalid HTML.
    expect(trigger).toContain('role="button"');
    expect(trigger).toContain("onKeyDown");
    expect(trigger).not.toContain("<button");
  });

  it("paints its action word without needing a hover", () => {
    expect(trigger).toContain("{action}");
    expect(trigger).not.toContain("opacity-0 group-hover:opacity-100");
  });
});

describe("the state reads, the pause hides (owner 2026-10-03)", () => {
  it("shows the state as a clickable k-btn with a chevron, never a Pause button beside it", () => {
    expect(trigger).toContain('aria-haspopup="menu"');
    expect(trigger).toContain("k-btn whitespace-nowrap");
    expect(trigger).toContain('d="M2.5 4l2.5 2.5L7.5 4"');
  });

  it("keeps Pause / Activate inside the menu the state opens", () => {
    const menu = trigger.slice(trigger.indexOf('role="menu"'), trigger.indexOf("{error && ("));
    expect(menu).toContain("{action}");
    expect(trigger.indexOf("{action}")).toBeGreaterThan(trigger.indexOf('role="menu"'));
  });

  it("speaks v2 tokens only", () => {
    expect(trigger).not.toMatch(/text-gray-|bg-gray-|text-red-|ring-brand-|rounded-full border px/);
  });
});
