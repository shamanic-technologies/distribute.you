import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildAudienceLLMPrompt,
  buildFunnelStatsLLMPrompt,
  buildServicesLLMPrompt,
  copyStepIntent,
} from "../src/components/onboarding/llm-prompt";

// `llm-prompt.ts` is alias-free on purpose, so these are REAL unit tests rather
// than source-substring guards. Keep it that way: a runtime `@/…` import in that
// module turns every test below into a resolution failure.

const SRC = join(__dirname, "..", "src");
const ONBOARDING = readFileSync(join(SRC, "components/onboarding/onboarding.tsx"), "utf8");
const GLOBALS = readFileSync(join(SRC, "app/globals.css"), "utf8");
const SETTINGS_CARD = readFileSync(
  join(SRC, "components/settings/brand-conversion-tracking-card.tsx"),
  "utf8",
);

describe("services prompt", () => {
  it("carries the business, the question and the list on screen", () => {
    const out = buildServicesLLMPrompt(["SEO audits", "Link building"], "acme.com");
    expect(out).toContain("I run this business: acme.com");
    expect(out).toContain("Question: What services do I want to promote?");
    expect(out).toContain("SEO audits\nLink building");
    expect(out).toContain("Return only the list, one service per line, nothing else.");
  });

  it("says there is no draft rather than handing over a blank", () => {
    // An empty line reads to a model as part of the formatting; the words say the
    // box is empty, which is the fact.
    const out = buildServicesLLMPrompt([], "acme.com");
    expect(out).toContain("My current list: (nothing yet)");
  });
});

describe("audience prompt", () => {
  it("states what the brand sells beside the description it is rewriting", () => {
    const out = buildAudienceLLMPrompt(
      "marketing people",
      ["SEO audits", "Link building"],
      "acme.com",
    );
    expect(out).toContain("What I sell: SEO audits, Link building");
    expect(out).toContain("My current description: marketing people");
    expect(out).toContain("Question: Who do I want to reach?");
  });

  it("refuses to invent an industry and names the four things targeting needs", () => {
    // The description becomes real targeting filters, so a model free-styling an
    // industry produces a list of the wrong people.
    const out = buildAudienceLLMPrompt("", [], "acme.com");
    expect(out).toContain("Do not invent an industry I did not mention.");
    expect(out).toContain("job titles");
    expect(out).toContain("company size");
    expect(out).toContain("What I sell: (not stated yet)");
  });
});

describe("funnel economics prompt", () => {
  const base = {
    funnelTitle: "Sales Meeting from Conversation",
    steps: ["Sales interest", "Meeting booked", "Meeting attended", "Paid client"],
    rates: [
      { label: "Sales interest to meeting booked", value: "40" },
      { label: "Meeting attended to paid client", value: "" },
    ],
    lifetimeRevenue: "2500",
    destinations: [
      { label: "Booking link", value: "https://cal.com/acme", optional: true },
    ],
    services: ["SEO audits"],
    domain: "acme.com",
  };

  it("labels every value the reader has to transcribe back", () => {
    const out = buildFunnelStatsLLMPrompt(base);
    expect(out).toContain("- Sales interest to meeting booked: 40");
    expect(out).toContain("- Meeting attended to paid client: (nothing yet)");
    expect(out).toContain("- Lifetime revenue per paid client (USD): 2500");
    expect(out).toContain("- Booking link (optional): https://cal.com/acme");
  });

  it("states the units, because these values go back into separate boxes", () => {
    const out = buildFunnelStatsLLMPrompt(base);
    expect(out).toContain("Percentages are whole numbers without the percent sign.");
    expect(out).toContain("Return only the same labelled lines with the corrected values, nothing else.");
  });

  it("names the path so the model prices the right one", () => {
    const out = buildFunnelStatsLLMPrompt(base);
    expect(out).toContain(
      "Sales Meeting from Conversation (Sales interest -> Meeting booked -> Meeting attended -> Paid client)",
    );
  });

  it("emits no destination line when there are none", () => {
    // The model step edits the economics alone, so it passes an empty list. A
    // stray empty destination row would read as a field the reader forgot.
    const out = buildFunnelStatsLLMPrompt({ ...base, destinations: [] });
    expect(out).not.toContain("Booking link");
    expect(out).toContain("- Lifetime revenue per paid client (USD): 2500");
  });

  it("falls back to the title when a path states no steps", () => {
    const out = buildFunnelStatsLLMPrompt({ ...base, steps: [] });
    expect(out).toContain("The path: Sales Meeting from Conversation (Sales Meeting from Conversation)");
  });
});

describe("prompt copy", () => {
  it("ships no em-dash in anything a reader pastes", () => {
    const outputs = [
      buildServicesLLMPrompt(["x"], "acme.com"),
      buildAudienceLLMPrompt("y", ["x"], "acme.com"),
      buildFunnelStatsLLMPrompt({
        funnelTitle: "t",
        steps: ["a"],
        rates: [{ label: "r", value: "1" }],
        lifetimeRevenue: "2",
        destinations: [{ label: "d", value: "u", optional: false }],
        services: ["x"],
        domain: "acme.com",
      }),
    ];
    for (const out of outputs) expect(out).not.toContain("—");
  });
});

describe("the button on every step that asks a human to write something", () => {
  it("reads 'Copy content for LLM' wherever it renders", () => {
    // Renamed from the bare "Copy for LLM": the hypothesis is that people were not
    // sure it copied the QUESTION as well as their draft, so they tried to select
    // both by hand instead. Both surfaces move together or the product calls one
    // control two things.
    expect(ONBOARDING).toContain('"Copy content for LLM"');
    expect(SETTINGS_CARD).toContain('"Copy content for LLM"');
    expect(ONBOARDING).not.toContain('"Copy for LLM"');
    expect(SETTINGS_CARD).not.toContain('"Copy for LLM"');
  });

  it("renders on the five steps that take a written answer", () => {
    // offer (one screen per Hormozi lever) + services + audiences + funnelStats +
    // the model step's "Your numbers" block. A count over the whole file on
    // purpose: a sixth render site is a decision to make deliberately, not a thing
    // to add by accident. Steps with NO written answer (funnel picks, consent,
    // budget, phone, the url step) carry none.
    const renders = ONBOARDING.match(/<CopyForLLMButton/g) ?? [];
    expect(renders.length).toBe(5);
  });

  it("wires each step to its own builder", () => {
    // Pinned as bare call sites rather than as whole argument spans: prettier
    // decides per call whether a multi-argument list collapses onto one line, so a
    // pinned span breaks on a reflow that changed nothing.
    expect(ONBOARDING).toContain("buildServicesLLMPrompt(");
    expect(ONBOARDING).toContain("buildAudienceLLMPrompt(");
    // funnelStats and the model step's economics block are the same fields, so one
    // builder serves both.
    expect((ONBOARDING.match(/buildFunnelStatsLLMPrompt\(/g) ?? []).length).toBe(2);
    expect(ONBOARDING).toContain("buildLeverLLMPrompt(");
  });
});

describe("selection highlight", () => {
  it("states a visible selection on both themes", () => {
    // The browser default is a pale blue that on a white card reads as nothing, so
    // people selecting a question did not believe the selection had taken.
    expect(GLOBALS).toContain("::selection");
    // A pseudo-element is reached by none of the `html.dark` utility remaps, so the
    // dark surface needs its own pair or it paints a light block.
    expect(GLOBALS).toContain(".dark ::selection");
  });

  it("colours it from the brand ramp, never a literal hex", () => {
    // `:root[data-brand-tint]` re-declares the ramp at the brand's hue, so an
    // arbitrary hex would be the one highlight that stays our blue on a tinted
    // dashboard.
    const at = GLOBALS.indexOf("  ::selection {");
    expect(at).toBeGreaterThan(-1);
    const block = GLOBALS.slice(at, GLOBALS.indexOf("}", at));
    expect(block).toContain("var(--color-brand-200)");
    expect(block).not.toMatch(/#[0-9a-fA-F]{6}\s*;[\s\S]*background/);
  });
});

describe("Ctrl+C on a step", () => {
  // Measured in Chromium before this shipped, on a page carrying prose and a real
  // <textarea>: a drag from the question into the field selects the question ONLY,
  // and Ctrl+C copies the question ONLY. Same under a slow drag, a reverse drag,
  // and with a `contenteditable` in place of the textarea. A `user-select: all`
  // wrapper selected nothing at all. The `copy` event is what works: with a handler
  // on the surrounding block the clipboard carried the question AND the field.
  const selectedProse = {
    activeElementIsField: false,
    fieldSelectionIsRange: false,
    selectionText: "Dream outcome",
  };

  it("rewrites when the reader selected prose and pressed Ctrl+C", () => {
    // The whole point: this is the gesture people were making and failing at.
    expect(copyStepIntent(selectedProse)).toBe("rewrite");
  });

  it("rewrites when the selection spans the whole block", () => {
    expect(
      copyStepIntent({ ...selectedProse, selectionText: "Dream outcome\nWhy it matters" }),
    ).toBe("rewrite");
  });

  it("passes through a copy made INSIDE the field", () => {
    // The reader lifting a phrase of their own draft, or a URL out of a destination
    // box, to paste somewhere else. Measured: an unguarded handler hands them the
    // whole prompt instead of the five characters they selected, which is worse than
    // having no handler at all.
    expect(
      copyStepIntent({
        activeElementIsField: true,
        fieldSelectionIsRange: true,
        selectionText: "",
      }),
    ).toBe("passthrough");
  });

  it("passes through when the field merely has focus with no selection", () => {
    // A caret is not a selection, so this is not a copy the reader aimed at their
    // own draft; but there is also nothing selected anywhere, so there is no
    // intention to read either.
    expect(
      copyStepIntent({
        activeElementIsField: true,
        fieldSelectionIsRange: false,
        selectionText: "",
      }),
    ).toBe("passthrough");
  });

  it("passes through an empty selection", () => {
    expect(copyStepIntent({ ...selectedProse, selectionText: "   " })).toBe("passthrough");
  });

  it("still rewrites when a field holds a stale caret but the SELECTION is prose", () => {
    // Clicking into the box, then selecting the question with the mouse: the field
    // keeps focus while the real selection lives in the page. Reading focus alone
    // would wrongly pass this through and reproduce the original bug.
    expect(
      copyStepIntent({
        activeElementIsField: true,
        fieldSelectionIsRange: false,
        selectionText: "Dream outcome",
      }),
    ).toBe("rewrite");
  });
});

describe("the copy handler is wired to the same string as the button", () => {
  it("hands every step ONE prompt const, never a second call", () => {
    // Two spellings of one answer is how the button and Ctrl+C come to disagree, so
    // each step builds its prompt once and both paths read that const.
    for (const name of ["leverPrompt", "servicesPrompt", "audienceLlmPrompt", "funnelPrompt", "economicsPrompt"]) {
      expect(ONBOARDING).toContain(`<CopyForLLMButton text={${name}} />`);
    }
  });

  it("puts the handler on four step shells and on the model step's own card", () => {
    // The model step deliberately does NOT pass copyText: its body also carries the
    // projection numbers, and a reader copying one of those means that number. Its
    // handler is scoped to the "Your numbers" card instead.
    expect((ONBOARDING.match(/copyText=\{/g) ?? []).length).toBe(4);
    expect(ONBOARDING).toContain("onCopy={stepCopyHandler(economicsPrompt)}");
    const model = ONBOARDING.slice(
      ONBOARDING.indexOf('if (step === "model") {'),
      ONBOARDING.indexOf('if (step === "offer") {'),
    );
    expect(model).not.toContain("copyText=");
  });

  it("never speaks for the footer, where the CTA lives", () => {
    // The handler rides the scrolling BODY. On the footer it would answer for a
    // reader copying the button's own label.
    const shell = ONBOARDING.slice(ONBOARDING.indexOf("function StepShell("));
    const body = shell.indexOf('className="min-h-0 flex-1 overflow-y-auto"');
    const foot = shell.indexOf("{footer && <div");
    expect(body).toBeGreaterThan(-1);
    expect(foot).toBeGreaterThan(body);
    expect(shell.slice(body, foot)).toContain("onCopy={copyText ?");
  });
});
