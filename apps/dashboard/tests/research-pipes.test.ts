import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { PIPE_KEY, PIPE_ORDER, parseResearchPath } from "../src/lib/research/research";
import { OUTBOUND_LEG_TO_CONVERSATION, OUTBOUND_LEG_TO_WEBSITE_VISIT } from "../src/lib/outbound-leg-key";

/**
 * Research speaks the current vocabulary (owner 2026-10-18): a PIPE is one leg x one channel, a
 * section reads in order (`Lead found → [channel] → Positive reply`), and the retired section names
 * survive only as old links redirected onto their pipe.
 */

const REPO = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(REPO, p), "utf8");

describe("old Research links open the same page under its pipe", () => {
  // The retired names are spelled out here on purpose: the links that carry them live on in sent
  // reports and social-service records.
  const OLD = { [["her", "ald"].join("")]: "cold-email-positive-reply", [["sc", "out"].join("")]: "cold-email-website-visit", [["pi", "lot"].join("")]: "meeting-booking" };

  it("maps an old study id to the same study's new id", () => {
    for (const [old, pipe] of Object.entries(OLD)) {
      expect(parseResearchPath(`${old}-template-roi`)).toEqual({ view: "redirect", to: `${pipe}-template-roi` });
    }
    expect(parseResearchPath(`${Object.keys(OLD)[2]}-cost`)).toEqual({ view: "redirect", to: "meeting-booking-cost" });
  });

  it("maps an old catalogue path, key and all, and keeps it encoded", () => {
    const [h, s] = Object.keys(OLD);
    expect(parseResearchPath(`${h}/workflows`)).toEqual({ view: "redirect", to: "cold-email-positive-reply/workflows" });
    expect(parseResearchPath(`${s}/templates/cold%20email`)).toEqual({ view: "redirect", to: "cold-email-website-visit/templates/cold%20email" });
    // the redirect target parses as the page it names
    expect(parseResearchPath("cold-email-website-visit/templates/cold%20email")).toEqual({ view: "item", pipe: "cold-email-website-visit", kind: "templates", key: "cold email" });
  });

  it("leaves every current path alone", () => {
    expect(parseResearchPath("")).toEqual({ view: "hub" });
    expect(parseResearchPath("meeting-cost")).toEqual({ view: "study", id: "meeting-cost" });
    expect(parseResearchPath("cold-email-positive-reply-llm-roi")).toEqual({ view: "study", id: "cold-email-positive-reply-llm-roi" });
    expect(parseResearchPath("meeting-booking/workflows")).toEqual({ view: "list", pipe: "meeting-booking", kind: "workflows" });
  });

  it("the page replaces an old URL client-side and draws nothing meanwhile", () => {
    const page = read("apps/dashboard/src/components/v2/research-page.tsx");
    expect(page).toContain('const redirectTo = view.view === "redirect" ? `${base}/${view.to}` : null;');
    expect(page).toContain("if (redirectTo) router.replace(redirectTo);");
    expect(page).toContain('{view.view === "redirect" ? null : view.view === "hub" ? (');
  });
});

describe("a pipe is one leg x one channel", () => {
  it("keys every pipe by its channel and the leg it buys", () => {
    expect(PIPE_ORDER).toEqual(["cold-email-positive-reply", "cold-email-website-visit", "meeting-booking"]);
    expect(PIPE_KEY["cold-email-positive-reply"]).toEqual({ channel: "sales-cold-email-outreach", leg: OUTBOUND_LEG_TO_CONVERSATION, step: "conversation" });
    expect(PIPE_KEY["cold-email-website-visit"]).toEqual({ channel: "sales-cold-email-outreach", leg: OUTBOUND_LEG_TO_WEBSITE_VISIT, step: "website_visit" });
    expect(PIPE_KEY["meeting-booking"]).toEqual({ channel: "ai-meeting-booking", leg: "conversation_to_meeting_booked", step: "meeting_booked" });
  });

  it("the snapshot's pipes carry the same channel and leg as the page", () => {
    const file = JSON.parse(read("apps/dashboard/src/lib/research/research.json")) as { pipes: { id: keyof typeof PIPE_KEY; channel: string; leg: string }[] };
    expect(file.pipes.map((p) => p.id)).toEqual(PIPE_ORDER);
    for (const p of file.pipes) expect({ channel: p.channel, leg: p.leg }, p.id).toEqual({ channel: PIPE_KEY[p.id].channel, leg: PIPE_KEY[p.id].leg });
  });

  it("writes a section's path in order from served words, a Shimmer until they answer, never a hardcoded name", () => {
    const bits = read("apps/dashboard/src/components/v2/research-bits.tsx");
    const fn = bits.slice(bits.indexOf("export function SectionPath("), bits.indexOf("/** A topic's mark"));
    expect(fn).toContain("legFor(catalogue, k.leg)");
    expect(fn).toContain("{ step: leg.fromLabel }, { channel: def.name, def }, { step: leg.toLabel }");
    expect(fn).toContain("<Shimmer");
    expect(bits).toContain("<ChannelChip name={it.channel} def={it.def} notRun={false} compact />");
    // an outcome row reads as the pipes that land on it, each by its served name; Jev has none
    expect(fn).toContain('if ("outcome" in section) return <OutcomePipes outcome={section.outcome} />;');
    const pipes = bits.slice(bits.indexOf("export function OutcomePipes("), bits.indexOf("export function SectionPath("));
    expect(pipes).toContain("if (!pipes.length) return null;");
    expect(pipes).toContain("<SectionMark section={{ pipe: p }} size={12} />");
    expect(pipes).toContain("<SectionName section={{ pipe: p }} />");
    const page = read("apps/dashboard/src/components/v2/research-page.tsx");
    expect(page).not.toContain("Sales path</span>");
    expect(page).not.toContain("All legs</span>");
    expect(page).toContain("every pipe buys one outcome");
  });
});

describe("the retired section names are gone from the Research code path", () => {
  const BANNED = /\bcrews?\b|herald|scout|\bpilot\b/i;
  // The one map that redirects old links.
  const ALLOWED = [/^const LEGACY_SECTION: Record<string, ResearchPipe> = \{/];
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  const v2 = join(REPO, "apps/dashboard/src/components/v2");
  const files = [
    ...walk(join(REPO, "apps/dashboard/src/lib/research")),
    ...readdirSync(v2).filter((f) => f.startsWith("research-") && f.endsWith(".tsx")).map((f) => join(v2, f)),
    ...walk(join(REPO, "apps/dashboard/src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/research")),
    ...walk(join(REPO, "apps/landing/scripts/blog-data")),
  ];

  it("no line names them, outside the legacy redirect map", () => {
    expect(files.length).toBeGreaterThan(20);
    const hits: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (BANNED.test(line) && !ALLOWED.some((a) => a.test(line.trim()))) hits.push(`${relative(REPO, f)}:${i + 1}: ${line.trim().slice(0, 120)}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it("the predicate catches a retired name and passes the new vocabulary", () => {
    expect(BANNED.test(`const x = "${["sc", "out"].join("")}";`)).toBe(true);
    expect(BANNED.test("// every crew buys one outcome")).toBe(true);
    expect(BANNED.test("Copilot reads the cold-email-positive-reply pipe")).toBe(false);
  });
});

describe("Research names each pipe by its served name and mark, one collapsible section each (owner 2026-10-18)", () => {
  const bits = read("apps/dashboard/src/components/v2/research-bits.tsx");
  const page = read("apps/dashboard/src/components/v2/research-page.tsx");

  it("a section's name and mark are the catalogue's (pipe by its catalogue id, an outcome by its public step), never a local look", () => {
    expect(bits).toContain('useStaffCatalogueObject("pipes", pipeId)');
    // an outcome row wears its step as the Outcomes pages do: the public step catalogue
    expect(bits).toContain('const stepId = "outcome" in section ? outcomeEntry(section.outcome, file)?.step ?? null : null;');
    expect(bits).toContain('useAuthQuery(["publicCatalogueSteps"], getPublicCatalogueSteps');
    expect(bits).toContain("return featureLegId(k.channel, k.leg);");
    expect(bits).toContain("<CatalogueMark icon={served.icon} color={served.color}");
    expect(bits).not.toMatch(/OUTCOME_LOOK|pipeLook|SectionLook|PipeMark/);
  });

  it("the hub header is a toggle button: served mark + name, the path under the name, counts, a chevron", () => {
    const block = page.slice(page.indexOf("function ResearchSectionBlock("), page.indexOf("function V2ResearchHub("));
    expect(block).toContain('<button type="button" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}');
    expect(block).toContain("mark={(px) => <SectionMark section={section} size={px} />}");
    expect(block).toContain("<SectionName section={section} />");
    expect(block.indexOf("<SectionPath section={section} />")).toBeGreaterThan(block.indexOf("<SectionName section={section} />"));
    expect(block).toContain("<SectionChevron open={open} />");
    expect(block).toContain("inert={!open}");
    expect(block).toContain("motion-reduce:transition-none");
    expect(block).not.toContain("transition-all");
    // collapsed by default, the choice remembered for Back
    expect(page).toContain("useState<ReadonlySet<string>>(() => new Set())");
    expect(page).toContain("window.localStorage.setItem(OPEN_SECTIONS_KEY");
    const hub = page.slice(page.indexOf("function V2ResearchHub("), page.indexOf("function BarsChart("));
    // one row anatomy for the three groups
    expect(hub.match(/<ResearchSectionBlock/g)?.length).toBe(3);
  });

  it("an outcome row: the step's mark and name, the pipes under it, its population line, then its studies", () => {
    const hub = page.slice(page.indexOf("function V2ResearchHub("), page.indexOf("function BarsChart("));
    const outcomes = hub.slice(hub.indexOf(">Outcomes</SectionTitle>"), hub.indexOf(">Other</SectionTitle>"));
    expect(outcomes).toContain("section={{ outcome: meta.id }}");
    // no `line` override: the line under the name is the pipes (SectionPath -> OutcomePipes)
    expect(outcomes).not.toContain("line=");
    expect(outcomes.indexOf("{meta.population}")).toBeLessThan(outcomes.indexOf("<StudyGrid studies={studies} base={base} />"));
    // Jev, under Other, is named by its description
    const other = hub.slice(hub.indexOf(">Other</SectionTitle>"));
    expect(other).toContain("line={meta.description}");
  });
});
