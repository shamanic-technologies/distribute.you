import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  catalogMeasures,
  firstMeasureListing,
  keyFromUrl,
  measureCatalog,
  measuresOutsideOutcomes,
  outcomeGroups,
  outcomeStudiesOf,
  outcomeUnitOf,
  parseResearchPath,
  researchCatalogHref,
  researchEngineOf,
  researchMeasureEntry,
  researchMeasures,
  researchStudyHref,
  researchTemplateVersionHref,
  sectionStudiesPriceFirst,
  urlKey,
  type ResearchCatalog,
  type ResearchEngineEntry,
  type ResearchFile,
  type ResearchStudy,
} from "../src/lib/research/research";

/**
 * Research by Engine and script (RESEARCH-BY-ENGINE-1113, owner 2026-11-13: no pipe anywhere): every section is an
 * Engine's measure (`<engine>/<startsFrom|start>/<counts>`, served) or an outcome; its pages sit under
 * `/research/engines/<measure>/<kind>`, a served `/` written `~` in the URL; an old link from before the Engines opens the hub.
 */

const REPO = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(REPO, p), "utf8");

// Every measure id features-service served on 2026-11-16 (`/internal/research/engines`), in its order.
const PROD_MEASURES = [
  "email_sent/start/conversation",
  "website_visit/start/website_visit",
  "meeting_booked/conversation/meeting_booked",
  "meeting_booked/form_submitted/meeting_booked",
  "conversation/start/conversation",
  "paid_client/signup/paid_client",
  "paid_client/conversation/paid_client",
  "paid_client/start/paid_client",
  "signup/start/signup",
  "signup/website_visit/signup",
  "client_satisfied/paid_client/client_satisfied",
  "booking_call/conversation/booking_call",
  "booking_call/form_submitted/booking_call",
  "lead_interested/lead_found/conversation",
  "lead_interested/start/conversation",
  "lead_found/start/lead_found",
  "industry_update_video/start/industry_update_video",
  "copilot_message_sent/start/paid_client",
  "whatsapp_message_sent/start/conversation",
  "threads_post_published/start/threads_post_published",
];

// Two Engines as prod serves them: one with one measure, one with two.
const ENGINES: ResearchEngineEntry[] = [
  {
    outcome: "email_sent",
    name: "Email sent",
    measures: [{ id: "email_sent/start/conversation", engine: "email_sent", startsFrom: null, counts: { key: "conversation", name: "Positive reply" }, description: "Positive reply, from nothing" }],
  },
  {
    outcome: "meeting_booked",
    name: "Meeting booked",
    measures: [
      { id: "meeting_booked/conversation/meeting_booked", engine: "meeting_booked", startsFrom: { key: "conversation", name: "Positive reply" }, counts: { key: "meeting_booked", name: "Meeting booked" }, description: "d" },
      { id: "meeting_booked/form_submitted/meeting_booked", engine: "meeting_booked", startsFrom: { key: "form_submitted", name: "Form submitted" }, counts: { key: "meeting_booked", name: "Meeting booked" }, description: "d" },
    ],
  },
];

describe("an Engine page's URL round-trips every served measure and key (RESEARCH-BY-ENGINE-1113)", () => {
  it("every prod measure id, every kind, a script key carrying its Engine (`/`), back to the same page", () => {
    const script = "email_sent/dy_cold_email_signed_client_person";
    for (const m of PROD_MEASURES) {
      for (const kind of ["scripts", "templates", "llms"] as const) {
        const list = researchCatalogHref("/r", m, kind);
        expect(list).not.toContain("%2F");
        expect(parseResearchPath(list.slice(3))).toEqual({ view: "list", measure: m, kind });
        const item = researchCatalogHref("/r", m, kind, script);
        expect(item).toBe(`/r/engines/${m.split("/").join("~")}/${kind}/email_sent~dy_cold_email_signed_client_person`);
        expect(parseResearchPath(item.slice(3))).toEqual({ view: "item", measure: m, kind, key: script });
      }
      expect(parseResearchPath(researchCatalogHref("/r", m, "performance").slice(3))).toEqual({ view: "performance", measure: m });
    }
  });

  it("a template version opens under its dynasty; a study id carrying `/` and `:` is one segment", () => {
    const v = researchTemplateVersionHref("/r", PROD_MEASURES[0], "cold-reply-observation-named", "cold-email-v3");
    expect(parseResearchPath(v.slice(3))).toEqual({ view: "version", measure: PROD_MEASURES[0], kind: "templates", key: "cold-reply-observation-named", version: "cold-email-v3" });
    const study = "email_sent/start/conversation:cost-over-time";
    const href = researchStudyHref("/r", study);
    expect(href.slice(3).split("/")).toHaveLength(1);
    expect(parseResearchPath(href.slice(3))).toEqual({ view: "study", id: study });
    expect(parseResearchPath("meeting-cost")).toEqual({ view: "study", id: "meeting-cost" });
    expect(keyFromUrl(urlKey("a/b/c"))).toBe("a/b/c");
  });

  it("a link from before the Engines (a pipe, a retired section) opens the hub; junk under an Engine is missing", () => {
    expect(parseResearchPath("")).toEqual({ view: "hub" });
    expect(parseResearchPath("cold-email-positive-reply/workflows")).toEqual({ view: "redirect", to: "" });
    expect(parseResearchPath("cold-whatsapp-outreach%7Cstart_to_signup/performance")).toEqual({ view: "redirect", to: "" });
    expect(parseResearchPath("engines/email_sent~start~conversation/workflows").view).toBe("missing");
    expect(parseResearchPath("engines/email_sent~start~conversation/scripts/a/b").view).toBe("missing");
  });

  it("the page replaces an old URL client-side (the hub) and draws nothing meanwhile", () => {
    const page = read("apps/dashboard/src/components/v2/research-page.tsx");
    expect(page).toContain('const redirectTo = view.view === "redirect" ? (view.to ? `${base}/${view.to}` : base) : null;');
    expect(page).toContain("if (redirectTo) router.replace(redirectTo);");
    expect(page).toContain('{view.view === "redirect" ? null : view.view === "hub" ? (');
  });
});

describe("every Engine and measure is the one the file serves", () => {
  it("reads a measure's Engine, from and counts off the served entry; a measure the file does not list is null", () => {
    const file = { engines: ENGINES };
    expect(researchMeasures(file).map((m) => m.id)).toEqual(["email_sent/start/conversation", "meeting_booked/conversation/meeting_booked", "meeting_booked/form_submitted/meeting_booked"]);
    expect(researchMeasureEntry(file, "meeting_booked/form_submitted/meeting_booked")?.startsFrom?.name).toBe("Form submitted");
    expect(researchEngineOf(file, "meeting_booked/form_submitted/meeting_booked")?.name).toBe("Meeting booked");
    expect(researchMeasureEntry(file, "nobody")).toBeNull();
    expect(researchMeasureEntry(file, null)).toBeNull();
  });

  it("a measure the catalogue has not built reads empty (Learning); the catalogue's own measures are listed in its order", () => {
    const cat: ResearchCatalog = { engines: ENGINES.map((e) => ({ ...e, measures: e.measures.map((m) => ({ ...m, scripts: [], templates: [{ key: `t-${m.id}` } as never], llms: [] })) })) };
    expect(measureCatalog({ engines: [] }, "x")).toEqual({ scripts: [], templates: [], llms: [] });
    expect(catalogMeasures(cat)).toEqual(researchMeasures({ engines: ENGINES }).map((m) => m.id));
    // A chip from outside Research lands on the first measure listing its template.
    expect(firstMeasureListing(cat, (m) => m.templates.some((t) => t.key === "t-meeting_booked/form_submitted/meeting_booked"))).toBe("meeting_booked/form_submitted/meeting_booked");
    expect(firstMeasureListing(cat, () => false)).toBeNull();
  });

  it("homes each measure under the outcome that lists it; the rest group by their Engine, in served order", () => {
    const file = {
      engines: ENGINES,
      outcomes: [{ id: "meeting", outcome: "Meeting booked", step: "meeting_booked", measures: ["meeting_booked/conversation/meeting_booked", "nobody"], description: "", population: "" }],
      studies: [
        { id: "a", measure: "meeting_booked/conversation/meeting_booked", outcome: undefined },
        { id: "b", measure: null, outcome: "meeting" },
        { id: "c", measure: "email_sent/start/conversation" },
      ],
    } as unknown as ResearchFile;
    const homed = outcomeStudiesOf(file.outcomes![0], file);
    expect(homed.measures).toEqual(["meeting_booked/conversation/meeting_booked"]);
    expect(homed.studies.map((st) => st.id)).toEqual(["b", "a"]);
    const out = measuresOutsideOutcomes(file);
    expect(out.map((g) => [g.engine.name, g.measures, g.studies.map((st) => st.id)])).toEqual([
      ["Email sent", ["email_sent/start/conversation"], ["c"]],
      ["Meeting booked", ["meeting_booked/form_submitted/meeting_booked"], []],
    ]);
  });

  it("names a cost per outcome by the served outcome's noun", () => {
    expect(outcomeUnitOf("Positive reply")).toBe("/ reply");
    expect(outcomeUnitOf("Website visit")).toBe("/ visit");
    expect(outcomeUnitOf("Meeting booked")).toBe("/ meeting");
    expect(outcomeUnitOf("Signup")).toBe("/ signup");
    expect(outcomeUnitOf("Paid client")).toBe("/ client");
  });

  it("no measure id, Engine or outcome name is typed in the Research code: everything walks the served file", () => {
    const lib = read("apps/dashboard/src/lib/research/research.ts");
    expect(lib).toContain("export type ResearchMeasure = string;");
    const page = read("apps/dashboard/src/components/v2/research-page.tsx");
    expect(page).toContain("outcomeStudiesOf(meta, RESEARCH)");
    expect(page).toContain("const outside = measuresOutsideOutcomes(RESEARCH);");
    expect(page).toContain("researchMeasureEntry(file, measure) ? <>{children}</> : <V2ResearchStudy base={base} studyId={rest} />");
    expect(read("apps/dashboard/src/components/v2/served-marks.ts")).toContain("for (const p of catalogMeasures(catalog)) {");
    const research = [
      "apps/dashboard/src/components/v2/research-page.tsx",
      "apps/dashboard/src/components/v2/research-catalog.tsx",
      "apps/dashboard/src/components/v2/research-bits.tsx",
      "apps/dashboard/src/components/v2/research-live-scripts.tsx",
      "apps/dashboard/src/components/v2/research-performance.tsx",
    ].map(read);
    for (const src of research) {
      expect(src).not.toMatch(/"email_sent|"website_visit|"meeting_booked|"Email sent"|"Positive reply"/);
      expect(src).not.toMatch(/study\.measure === "/);
    }
  });

  it("writes a section's path in order from served words, never a hardcoded name", () => {
    const bits = read("apps/dashboard/src/components/v2/research-bits.tsx");
    const steps = bits.slice(bits.indexOf("export function MeasureSteps("), bits.indexOf("export function OutcomeMeasures("));
    expect(steps).toContain('return <InOrder items={[m.startsFrom?.name ?? "Start", m.counts.name]} />;');
    const fn = bits.slice(bits.indexOf("export function SectionPath("), bits.indexOf("/** A topic's mark"));
    expect(fn).toContain('if ("outcome" in section) return <OutcomeMeasures outcome={section.outcome} />;');
    expect(fn).toContain("return <MeasureSteps measure={section.measure} />;");
    const measures = bits.slice(bits.indexOf("export function OutcomeMeasures("), bits.indexOf("export function SectionPath("));
    expect(measures).toMatch(/if \(!\w+\.length\) return null;/);
    expect(measures).toContain("<SectionMark section={{ measure: m }} size={12} />");
    expect(measures).toContain("<SectionName section={{ measure: m }} />");
    const page = read("apps/dashboard/src/components/v2/research-page.tsx");
    expect(page).toContain("Every Engine makes one outcome");
  });
});

describe("the retired section names are gone from the Research code path", () => {
  const BANNED = /\bcrews?\b|herald|scout|\bpilot\b/i;
  // Since the Engines (RESEARCH-BY-ENGINE-1113) an old link opens the hub: no map spells a retired name any more.
  const ALLOWED: RegExp[] = [];
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

describe("Research names each section by its served name and mark, one collapsible section each (owner 2026-10-18)", () => {
  const bits = read("apps/dashboard/src/components/v2/research-bits.tsx");
  const page = read("apps/dashboard/src/components/v2/research-page.tsx");

  it("a section's name and mark are served (a measure by its Engine's name and step, an outcome by its public step), never a local look", () => {
    expect(bits).not.toContain("useStaffCatalogueObject");
    // an Engine wears its outcome step, an outcome row its step, as the Outcomes pages do: the public step catalogue
    expect(bits).toContain('const stepId = "measure" in section ? (engine?.outcome ?? null) : outcomeEntry(section.outcome, file)?.step ?? null;');
    expect(bits).toContain('useAuthQuery(["publicCatalogueSteps"], getPublicCatalogueSteps');
    expect(bits).toContain("const name = engine ? engine.name : step?.name ?? null;");
    expect(bits).toContain("<CatalogueMark icon={served.icon} color={served.color}");
    expect(bits).not.toMatch(/OUTCOME_LOOK|pipeLook|SectionLook|PipeMark/);
  });

  it("the hub header is a toggle button: served mark + name, the path under the name, counts, a chevron", () => {
    const hub = page.slice(page.indexOf("function V2ResearchHub("), page.indexOf("function BarsChart("));
    // the row anatomy is the shared hub block (Monitoring wears it too), never a fork
    expect(hub).toContain("<HubSectionBlock");
    expect(hub).toContain("mark={(px) => <SectionMark section={{ outcome: entry.id }} size={px} />}");
    expect(hub).toContain("name={<SectionName section={{ outcome: entry.id }} />}");
    expect(hub).toContain("line={line ?? <SectionPath section={{ outcome: entry.id }} />}");
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
  });

  it("an outcome row (FACTORY-RESEARCH-1102): the step's mark and name, its population, its Engines' pages, then its studies; no pipe heading", () => {
    const hub = page.slice(page.indexOf("function V2ResearchHub("), page.indexOf("function BarsChart("));
    // the group title is the served leadTrackLabel, never a local word
    expect(hub).toContain('<p className="k-label mb-2 px-1">{t.label}</p>');
    expect(hub.indexOf("{entry.population}")).toBeLessThan(hub.indexOf("<OutcomeCatalogue base={base} measures={measures} />"));
    expect(hub.indexOf("<OutcomeCatalogue base={base} measures={measures} />")).toBeLessThan(hub.indexOf("<StudyGrid studies={studies} base={base} />"));
    // Jev, under Other, is named by its description
    expect(hub).toContain("otherRows.map((r) => outcomeBlock(r, r.entry.description))");
    // no pipe anywhere (RESEARCH-BY-ENGINE-1113): the Engines no lead state names are their own group
    expect(hub).not.toMatch(/[Pp]ipe/);
    expect(hub).toContain('<p className="k-label mb-2 px-1">Other Engines</p>');
    // which script each Engine runs lives on Monitoring only (SCRIPT-VALUE-RATING-1113): the hub links there, draws no Engine picks
    expect(hub).not.toContain("<EngineSection />");
    expect(hub).toContain('href="/v2/monitoring/ai/scripts"');
  });
});

describe("Research hub groups the lead-state sections by served lead track (owner 2026-10-25, RESEARCH-LEAD-TRACK-1025)", () => {
  const entry = (id: string, leadTrack?: string, leadTrackLabel?: string) => ({ id, outcome: id, step: leadTrack ? id : null, measures: [], description: "", population: "", ...(leadTrack ? { leadTrack, leadTrackLabel } : {}) });
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
