import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogPipes, outcomeGroups, outcomeUnitOf, parseResearchPath, sectionStudiesPriceFirst, pipeCatalog, researchCatalogHref, researchPipeEntry, researchPipeFor, type ResearchFile, type ResearchPipeEntry, type ResearchStudy } from "../src/lib/research/research";

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

describe("a pipe is one leg x one channel, and every pipe is the one the file serves (WA-PIPE-RESEARCH-1023)", () => {
  // As features-service serves them: the three studied pipes, then every catalogue pipe holding a workflow.
  const PIPES: ResearchPipeEntry[] = [
    { id: "cold-email-positive-reply", channel: "sales-cold-email-outreach", leg: "lead_found_to_conversation", outcome: "Positive reply", description: "d" },
    { id: "cold-email-website-visit", channel: "sales-cold-email-outreach", leg: "lead_found_to_website_visit", outcome: "Website visit", description: "d" },
    { id: "meeting-booking", channel: "ai-meeting-booking", leg: "conversation_to_meeting_booked", outcome: "Meeting booked", description: "d" },
    { id: "cold-whatsapp-outreach|start_to_signup", channel: "cold-whatsapp-outreach", leg: "start_to_signup", outcome: "Signup", description: "d" },
  ];

  it("reads a pipe's channel and leg off the served entry, a pipe the file does not list is null", () => {
    expect(researchPipeEntry({ pipes: PIPES }, "cold-whatsapp-outreach|start_to_signup")?.channel).toBe("cold-whatsapp-outreach");
    expect(researchPipeEntry({ pipes: PIPES }, "meeting-booking")?.leg).toBe("conversation_to_meeting_booked");
    expect(researchPipeEntry({ pipes: PIPES }, "nobody")).toBeNull();
    expect(researchPipeEntry({ pipes: PIPES }, null)).toBeNull();
  });

  it("maps a campaign (channel + leg, either spelling) to the served pipe", () => {
    expect(researchPipeFor(PIPES, "sales-cold-email-outreach", "lead_found_to_conversation")).toBe("cold-email-positive-reply");
    expect(researchPipeFor(PIPES, "sales-cold-email-outreach", "start_to_website_visit")).toBe("cold-email-website-visit");
    expect(researchPipeFor(PIPES, "cold-whatsapp-outreach", "start_to_signup")).toBe("cold-whatsapp-outreach|start_to_signup");
    expect(researchPipeFor(PIPES, "cold-whatsapp-outreach", "signup_to_paid_client")).toBeNull();
    expect(researchPipeFor(null, "sales-cold-email-outreach", "lead_found_to_conversation")).toBeNull();
  });

  it("a served pipe id with a `|` round-trips through its page URL", () => {
    const href = researchCatalogHref("/r", "cold-whatsapp-outreach|start_to_signup", "templates");
    expect(href).toBe("/r/cold-whatsapp-outreach%7Cstart_to_signup/templates");
    expect(parseResearchPath(href.slice(3))).toEqual({ view: "list", pipe: "cold-whatsapp-outreach|start_to_signup", kind: "templates" });
    expect(parseResearchPath("cold-whatsapp-outreach%7Cstart_to_signup/performance")).toEqual({ view: "performance", pipe: "cold-whatsapp-outreach|start_to_signup" });
  });

  it("a pipe the catalogue has not built reads empty (Learning), and the catalogue's own pipes are listed in its order", () => {
    expect(pipeCatalog({}, "cold-whatsapp-outreach|start_to_signup")).toEqual({ workflows: [], templates: [], models: [] });
    expect(catalogPipes({ b: { workflows: [], templates: [], models: [] }, a: { workflows: [], templates: [], models: [] } })).toEqual(["b", "a"]);
  });

  it("names a cost per outcome by the served outcome's noun", () => {
    expect(outcomeUnitOf("Positive reply")).toBe("/ reply");
    expect(outcomeUnitOf("Website visit")).toBe("/ visit");
    expect(outcomeUnitOf("Meeting booked")).toBe("/ meeting");
    expect(outcomeUnitOf("Signup")).toBe("/ signup");
    expect(outcomeUnitOf("Paid client")).toBe("/ client");
  });

  it("no pipe id is typed in the Research code: the hub, the status modal and the marks walk the served pipes", () => {
    const lib = read("apps/dashboard/src/lib/research/research.ts");
    expect(lib).not.toMatch(/PIPE_ORDER|PIPE_KEY|isResearchPipe/);
    expect(lib).toContain("export type ResearchPipe = string;");
    const page = read("apps/dashboard/src/components/v2/research-page.tsx");
    expect(page).toContain("const pipeRows = RESEARCH.pipes.map(({ id: pipe }) => ({ pipe, studies: studiesFor(pipe, RESEARCH) }));");
    expect(page).not.toMatch(/study\.pipe === "/);
    // a pipe's pages render only for a pipe the file serves
    expect(page).toContain("researchPipeEntry(file, pipe) ? <>{children}</> : <V2ResearchStudy base={base} studyId={rest} />");
    expect(read("apps/dashboard/src/components/v2/research-status.tsx")).toContain("useResearch().file.pipes.map((p) => {");
    expect(read("apps/dashboard/src/components/v2/served-marks.ts")).toContain("for (const p of catalogPipes(catalog)) {");
    expect(read("apps/dashboard/src/components/v2/research-catalog.tsx")).not.toContain('pipe === "cold-email');
    expect(read("apps/dashboard/src/app/(authed)/api/research/[basis]/[part]/route.ts")).toContain("catalogPipes(catalog).map((pipe)");
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
    expect(bits).toContain("return featureLegId(entry.channel, entry.leg);");
    expect(bits).toContain("<CatalogueMark icon={served.icon} color={served.color}");
    expect(bits).not.toMatch(/OUTCOME_LOOK|pipeLook|SectionLook|PipeMark/);
  });

  it("the hub header is a toggle button: served mark + name, the path under the name, counts, a chevron", () => {
    const block = page.slice(page.indexOf("function ResearchSectionBlock("), page.indexOf("function V2ResearchHub("));
    // the row anatomy is the shared hub block (Monitoring wears it too), never a fork
    expect(block).toContain("<HubSectionBlock");
    expect(block).toContain("mark={(px) => <SectionMark section={section} size={px} />}");
    expect(block).toContain("<SectionName section={section} />");
    expect(block.indexOf("<SectionPath section={section} />")).toBeGreaterThan(block.indexOf("<SectionName section={section} />"));
    const shared = read("apps/dashboard/src/components/v2/hub-section.tsx");
    const sharedBlock = shared.slice(shared.indexOf("export function HubSectionBlock("), shared.indexOf("function ChipArrow("));
    expect(sharedBlock).toContain('<button type="button" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}');
    expect(sharedBlock).toContain("<SectionChevron open={open} />");
    expect(sharedBlock).toContain("inert={!open}");
    expect(sharedBlock).toContain("motion-reduce:transition-none");
    expect(sharedBlock).not.toContain("transition-all");
    // collapsed by default, the choice remembered for Back
    expect(shared).toContain("useState<ReadonlySet<string>>(() => new Set())");
    expect(shared).toContain("window.localStorage.setItem(storageKey");
    expect(page).toContain("useOpenSections(OPEN_SECTIONS_KEY)");
    const hub = page.slice(page.indexOf("function V2ResearchHub("), page.indexOf("function BarsChart("));
    // one row anatomy for the three groups
    expect(hub.match(/<ResearchSectionBlock/g)?.length).toBe(3);
  });

  it("an outcome row: the step's mark and name, the pipes under it, its population line, then its studies", () => {
    const hub = page.slice(page.indexOf("function V2ResearchHub("), page.indexOf("function BarsChart("));
    const outcomes = hub.slice(hub.indexOf("{leadTrackRows.map((t) => ("), hub.indexOf(">Other</SectionTitle>"));
    // the group title is the served leadTrackLabel, never a local word
    expect(outcomes).toContain("<SectionTitle count={t.rows.length}>{t.label}</SectionTitle>");
    expect(outcomes).toContain("section={{ outcome: meta.id }}");
    // no `line` override: the line under the name is the pipes (SectionPath -> OutcomePipes)
    expect(outcomes).not.toContain("line=");
    expect(outcomes.indexOf("{meta.population}")).toBeLessThan(outcomes.indexOf("<StudyGrid studies={studies} base={base} />"));
    // Jev, under Other, is named by its description
    const other = hub.slice(hub.indexOf(">Other</SectionTitle>"));
    expect(other).toContain("line={meta.description}");
  });
});

describe("Research hub groups the lead-state sections by served lead track (owner 2026-10-25, RESEARCH-LEAD-TRACK-1025)", () => {
  const entry = (id: string, leadTrack?: string, leadTrackLabel?: string) => ({ id, outcome: id, step: leadTrack ? id : null, pipes: [], description: "", population: "", ...(leadTrack ? { leadTrack, leadTrackLabel } : {}) });
  const file = {
    outcomes: [
      entry("positive-reply", "crm_lifecycle", "CRM lifecycle"),
      entry("meeting", "crm_lifecycle", "CRM lifecycle"),
      entry("meeting-attended", "crm_lifecycle", "CRM lifecycle"),
      entry("paid-client", "crm_lifecycle", "CRM lifecycle"),
      entry("lead-visited", "website_visits", "Website visits"),
      entry("judgment"),
    ],
  } as unknown as ResearchFile;

  it("one group per lead track, titled by its label, sections in the file's ladder order; no lead track = Other", () => {
    const g = outcomeGroups(file);
    expect(g.leadTracks.map((t) => [t.label, t.entries.map((e) => e.id)])).toEqual([
      ["CRM lifecycle", ["positive-reply", "meeting", "meeting-attended", "paid-client"]],
      ["Website visits", ["lead-visited"]],
    ]);
    expect(g.other.map((e) => e.id)).toEqual(["judgment"]);
  });

  it("an entry served with no lead track still renders, under Other", () => {
    const old = { outcomes: [entry("positive-reply"), entry("judgment")] } as unknown as ResearchFile;
    expect(outcomeGroups(old)).toEqual({ leadTracks: [], other: old.outcomes });
  });

  it("a section opens on its price over time, the rest in the file's order", () => {
    const st = (id: string) => ({ id }) as ResearchStudy;
    const out = sectionStudiesPriceFirst("meeting", [st("meeting-cost"), st("meeting-cost-every-path"), st("meeting-cost-over-time")]);
    expect(out.map((s) => s.id)).toEqual(["meeting-cost-over-time", "meeting-cost", "meeting-cost-every-path"]);
  });
});
