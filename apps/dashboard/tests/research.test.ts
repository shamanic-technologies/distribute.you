import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PIPE_ORDER,
  OUTCOME_ORDER,
  parseResearchPath,
  pointHref,
  researchCatalogHref,
  researchPipeFor,
  researchModel,
  researchTemplate,
  researchWorkflow,
  studyById,
  studiesFor,
  studiesForOutcome,
  studyOutcomeText,
  type ResearchCatalog,
  type ResearchFile,
} from "../src/lib/research/research";
import researchJson from "../src/lib/research/research.json";
import catalogJson from "../src/lib/research/research-catalog.json";
import textsJson from "../src/lib/research/research-templates.json";

const ROOT = join(__dirname, "..", "src");
const RESEARCH = researchJson as unknown as ResearchFile;
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("research.json is coherent", () => {
  it("is fleet-wide and carries a window and a volume", () => {
    expect(RESEARCH.allOrgs).toBe(true);
    expect(RESEARCH.window.from <= RESEARCH.window.to).toBe(true);
    expect(RESEARCH.volume.emails).toBeGreaterThan(0);
  });

  it("draws no month after the cutoff's month, and that month as in progress", () => {
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const legs = (RESEARCH as unknown as { maturation: { legs: Record<string, { cutoff: string }> } }).maturation.legs;
    let partials = 0;
    for (const s of RESEARCH.studies) {
      // an outcome study (meetings) waits no days under its leg's rule: its months run to the read
      const cutoff = s.pipe === null ? RESEARCH.maturation.windowEnd : legs[s.pipe === "cold-email-website-visit" ? "visit" : "reply"].cutoff;
      const last = MONTHS[Number(cutoff.slice(5, 7)) - 1];
      for (const c of s.charts.filter((x) => x.kind === "months")) {
        for (const pts of [c.points, c.cumulative?.points ?? []]) {
          for (const p of pts) {
            expect(MONTHS.indexOf(p.label), `${s.id} ${p.label}`).toBeLessThanOrEqual(MONTHS.indexOf(last));
            expect(Boolean(p.partial), `${s.id} ${p.label}`).toBe(p.label === last && cutoff.slice(8, 10) !== "01");
            if (p.partial) partials++;
          }
        }
      }
    }
    expect(partials).toBeGreaterThan(0);
    // and the page draws it dotted, bar and line alike
    const bits = read("components/v2/research-bits.tsx");
    expect(bits).toContain('strokeDasharray={p.partial ? "3 3" : undefined}');
    expect(bits).toContain('dataKey="pending" stroke={color} strokeWidth={1.5} strokeDasharray="3 3"');
  });

  it("gives every study a unique id and exactly one section: a known pipe, or a known outcome", () => {
    const ids = RESEARCH.studies.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of RESEARCH.studies) {
      if (s.pipe === null) expect(OUTCOME_ORDER, s.id).toContain(s.outcome);
      else {
        expect(PIPE_ORDER, s.id).toContain(s.pipe);
        expect(s.outcome, s.id).toBeUndefined();
      }
      expect(studyOutcomeText(s, RESEARCH), s.id).toBeTruthy();
    }
    for (const s of RESEARCH.studies) expect(studyById(s.id, RESEARCH)).toBe(s);
  });

  it("prices a booked meeting on the positive reply to meeting leg, and across every leg as the Meeting booked outcome", () => {
    const leg = studyById("meeting-booking-cost", RESEARCH);
    expect(leg?.pipe).toBe("meeting-booking");
    expect(leg?.topic).toBe("cost");
    const meeting = RESEARCH.outcomes?.find((o) => o.id === "meeting");
    expect(meeting?.outcome).toBe("Meeting booked");
    // the population is stated: only brands that report their meetings count (owner pick A, 2026-10-03)
    expect(meeting?.population).toMatch(/report(s)? (its|their) booked meetings/);
    const all = studiesForOutcome("meeting", RESEARCH);
    expect(all.map((s) => s.id)).toEqual(["meeting-cost", "meeting-ai-before-after"]);
    for (const s of [leg!, ...all]) {
      expect(s.verdict, s.id).toBeTruthy();
      // a meeting figure under features-service's count reads Learning, so never a conclusion yet
      for (const c of s.charts) for (const p of [...c.points, ...(c.cumulative?.points ?? [])]) if (p.thin) expect(s.verdict?.kind, s.id).not.toBe("conclusion");
      const text = [s.question, s.headline, ...s.conclusion].join(" ");
      expect(text, s.id).not.toMatch(/herald|scout|pilot/i);
    }
  });

  it("draws the outcome sections on the hub after the pipes, with their population line", () => {
    const page = read("components/v2/research-page.tsx");
    const hub = page.slice(page.indexOf("function V2ResearchHub("), page.indexOf("function BarsChart("));
    expect(hub.indexOf("PIPE_ORDER.map(")).toBeGreaterThan(0);
    expect(hub.indexOf("OUTCOME_ORDER.map(")).toBeGreaterThan(hub.indexOf("PIPE_ORDER.map("));
    expect(hub).toContain("studiesForOutcome(outcome, RESEARCH)");
    expect(hub).toContain("{meta.population}");
    // a question page names its section whatever it is
    expect(page).toContain("const section = sectionOf(study);");
    // the email legs' clients, emails and run-start wait are never printed beside a meeting figure
    expect(page).toContain('const emailLeg = study.pipe === "cold-email-positive-reply" || study.pipe === "cold-email-website-visit";');
    expect(page).toContain("{emailLeg && <Row k=\"Emails\"");
    expect(page).toContain("{emailLeg && (");
  });

  it("covers the nine questions on both cold email pipes, plus the meeting booking pipe", () => {
    for (const pipe of ["cold-email-positive-reply", "cold-email-website-visit"] as const) {
      const topics = studiesFor(pipe, RESEARCH).map((s) => `${s.topic}-${s.goal}`);
      for (const t of ["llm-roi", "llm-rate", "cost-roi", "followups-roi", "followups-rate", "opens-roi", "opens-rate", "template-roi", "template-rate"]) {
        expect(topics).toContain(t);
      }
    }
    expect(studiesFor("meeting-booking", RESEARCH).length).toBeGreaterThan(0);
  });

  it("asks whether the first email's layout and opening change the cost, per leg, all tiers then per tier", () => {
    for (const pipe of ["cold-email-positive-reply", "cold-email-website-visit"] as const) {
      for (const dim of ["layout", "opening"] as const) {
        const s = studiesFor(pipe, RESEARCH).find((st) => st.id === `${pipe}-${dim}-roi`);
        expect(s, `${pipe}-${dim}`).toBeTruthy();
        if (!s) continue;
        expect(s.topic).toBe(dim);
        expect(s.charts[0].title.startsWith("All tiers:")).toBe(true);
        expect(s.charts.slice(1).every((c) => /^(Flash|Pro) tier:/.test(c.title))).toBe(true);
        // every bar states its outcome count and email count beside it
        for (const c of s.charts) for (const p of c.points) expect(p.note, s.id).toMatch(/·/);
        const labels = dim === "layout"
          ? ["One block", "Single line breaks", "Double line breaks"]
          : ["Greeting + first name", "First name alone", "No greeting"];
        for (const p of s.charts[0].points) expect(labels, s.id).toContain(p.label);
        // every layout that sent anything is drawn, one with no outcome yet included
        if (dim === "layout") expect(s.charts[0].points.map((p) => p.label).sort(), s.id).toEqual([...labels].sort());
        if (s.winner) expect(s.winner).toBe(s.charts[0].points[0].label);
        expect(s.conclusion.join(" ")).toContain("Sep 28, 2026");
      }
    }
  });

  it("asks whether dashes in the first email change the cost and the rate, per leg, all tiers then per tier, with the models behind them", () => {
    for (const pipe of ["cold-email-positive-reply", "cold-email-website-visit"] as const) {
      const s = studiesFor(pipe, RESEARCH).find((st) => st.id === `${pipe}-dash-roi`);
      expect(s, pipe).toBeTruthy();
      if (!s) continue;
      expect(s.topic).toBe("dash");
      const titles = s.charts.map((c) => c.title);
      expect(titles[0].startsWith("All tiers: cost per")).toBe(true);
      expect(titles[1].startsWith("All tiers:") && titles[1].includes("rate")).toBe(true);
      expect(titles.some((t) => /^(Flash|Pro) tier: cost per/.test(t))).toBe(true);
      expect(titles.some((t) => /^(Flash|Pro) tier: .*rate/.test(t))).toBe(true);
      expect(titles[titles.length - 1]).toContain("by model");
      // every bar states its counts beside it
      for (const c of s.charts) for (const p of c.points) expect(p.note, s.id).toMatch(/·/);
      for (const c of s.charts.slice(0, -1)) for (const p of c.points) expect(["Em dash", "En dash", "Both dashes", "No dash"], s.id).toContain(p.label);
      if (s.winner) expect(s.winner).toBe(s.charts[0].points[0].label);
      expect(s.conclusion.join(" ")).toContain("Sep 29, 2026");
      expect(s.conclusion.join(" ")).toMatch(/Flash tier: .* come from|Pro tier: .* come from/);
    }
  });

  it("asks which day of the week a cold email should go out on, in the prospect's timezone, and says what it cannot answer", () => {
    // Owner 2026-10-03 (copying a Sunday-to-Friday schedule?): one leg, positive replies, judged by
    // verdict.mjs like every other cut. The days are drawn Monday to Sunday, never ranked.
    const s = studyById("cold-email-positive-reply-weekday-rate", RESEARCH);
    expect(s).toBeTruthy();
    if (!s) return;
    expect(s.topic).toBe("weekday");
    expect(s.question).toBe("Which day of the week should a cold email go out on?");
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const labels = s.charts[0].points.map((p) => p.label);
    expect(labels).toEqual(days.filter((d) => labels.includes(d)));
    expect(s.charts[0].title).toContain("prospect's timezone");
    for (const c of s.charts) for (const p of c.points) expect(p.note, s.id).toMatch(/·/);
    const text = s.conclusion.join(" ");
    expect(text).toMatch(/Sunday against Monday to Friday: .*(Conclusion|Signal|Noise): /);
    expect(text).toContain("What this cannot answer");
    expect(text).toContain("The schedule moved over the window");
    // the hour study rides the same rules, drawn 00:00 to 23:00
    const h = studyById("cold-email-positive-reply-hour-rate", RESEARCH);
    expect(h?.topic).toBe("hour");
    const hours = h!.charts[0].points.map((p) => p.label);
    expect(hours).toEqual([...hours].sort());
    // a leg whose every day is still Learning gets no weekday study (one leg x one channel per figure)
    const visit = studyById("cold-email-website-visit-weekday-rate", RESEARCH);
    if (visit) expect(visit.charts[0].points.some((p) => !p.thin)).toBe(true);
  });

  it("draws something for every measured study, and nothing is invented for one that is not", () => {
    for (const s of RESEARCH.studies) {
      if (s.status === "measured") {
        expect(s.charts.length).toBeGreaterThan(0);
        expect(s.charts.some((c) => c.points.length > 0)).toBe(true);
      } else {
        expect(s.crowned).toBe(false);
      }
    }
  });

  it("ranks thin bars by their value and keeps the first bar as the leader, thin or not", () => {
    // Owner rule 2026-09-27: never sink a thin bar below the others. Since 2026-10-02 the first
    // bar only WINS when its verdict is a conclusion; otherwise it leads.
    for (const s of RESEARCH.studies.filter((st) => ["llm", "template", "workflow"].includes(st.topic) && st.status === "measured")) {
      const pts = s.charts[0].points;
      expect(s.winner, s.id).toBe(pts[0].label);
      for (let i = 1; i < pts.length; i++) {
        if (s.charts[0].lowerIsBetter) expect(pts[i].value, s.id).toBeGreaterThanOrEqual(pts[i - 1].value);
        else expect(pts[i].value, s.id).toBeLessThanOrEqual(pts[i - 1].value);
      }
      expect(s.crowned, s.id).toBe(s.verdict?.kind === "conclusion");
      expect(s.headline, s.id).not.toMatch(/thin/i);
    }
  });

  it("states a verdict on every measured study, and only a conclusion's headline says it wins", () => {
    // Owner 2026-10-02: every study says whether it holds a conclusion, a signal or noise. The
    // first bar stays the leader whatever the word; the p-value is shown beside it.
    // (a study that cannot be measured, the website-visit opens study since 2026-10-03, draws no bar)
    for (const s of RESEARCH.studies.filter((st) => ["naming", "opens"].includes(st.topic) && st.status === "measured")) {
      expect(s.winner, s.id).toBe(s.charts[0].points[0].label);
      expect(s.headline, s.id).toMatch(/\(p [<\d]/);
    }
    for (const s of RESEARCH.studies.filter((st) => st.status === "measured")) {
      expect(["conclusion", "signal", "noise"], s.id).toContain(s.verdict?.kind);
      expect(s.verdict?.reason.length, s.id).toBeGreaterThan(10);
      if (s.verdict?.kind !== "conclusion") expect(s.headline, s.id).not.toMatch(/ wins /);
      if (s.verdict?.kind === "signal") expect(s.headline, s.id).toMatch(/A signal to confirm/);
      if (s.verdict?.kind === "noise") expect(s.headline, s.id).toMatch(/Noise so far/);
      expect(s.headline, s.id).not.toMatch(/no clear winner|not significant/i);
    }
  });

  it("names a winner that is a bar of the study's first chart", () => {
    for (const s of RESEARCH.studies) {
      if (!s.winner || s.topic === "cost") continue;
      const labels = s.charts[0].points.map((p) => p.label);
      expect(labels, s.id).toContain(s.winner);
    }
  });

  it("pairs every monthly chart with its average since inception, ending on the winner's own result", () => {
    for (const s of RESEARCH.studies) {
      for (const c of s.charts.filter((ch) => ch.kind === "months")) {
        expect(c.cumulative, s.id).toBeDefined();
        expect(c.cumulative!.points.length, s.id).toBeGreaterThan(0);
      }
      // the cheapest LLM's average since inception IS the price its card states
      if (s.topic === "llm" && s.goal === "roi" && s.result) {
        const months = s.charts.find((c) => c.kind === "months");
        expect(months?.cumulative?.points.at(-1)?.display, s.id).toBe(s.result.display);
      }
    }
  });

  it("asks the best-workflow questions (ROI and rate) on both cold email pipes, and the meeting booking pipe says it cannot yet", () => {
    for (const pipe of ["cold-email-positive-reply", "cold-email-website-visit"] as const) {
      const wf = studiesFor(pipe, RESEARCH).filter((s) => s.topic === "workflow");
      expect(wf.map((s) => s.goal).sort()).toEqual(["rate", "roi"]);
      for (const s of wf) expect(s.status, s.id).toBe("measured");
    }
    const booking = studiesFor("meeting-booking", RESEARCH).filter((s) => s.topic === "workflow");
    expect(booking.map((s) => s.goal).sort()).toEqual(["rate", "roi"]);
    for (const s of booking) {
      expect(s.status).toBe("not_enough_data");
      expect(s.headline).toBe("Not enough data yet.");
    }
  });

  it("names a workflow by what it runs, never by its codename", () => {
    // every workflow codename in the fleet is a lowercase word joined to its version (`lithium-v6`)
    for (const s of RESEARCH.studies.filter((st) => st.topic === "workflow")) {
      for (const c of s.charts.filter((ch) => ch.kind === "bars")) {
        for (const p of c.points) {
          expect(p.label, s.id).toMatch(/ · /);
          expect(p.label, s.id).not.toMatch(/\b[a-z]+-v\d+\b/);
        }
      }
    }
    // two workflows that run the same model and template still read as two
    const labels = RESEARCH.studies.find((s) => s.id === "cold-email-positive-reply-workflow-rate")!.charts[0].points.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("asks whether naming the client wins positive replies, on the positive-reply leg only, in plain words", () => {
    const naming = RESEARCH.studies.filter((s) => s.topic === "naming");
    expect(naming.map((s) => `${s.pipe}-${s.goal}`).sort()).toEqual(["cold-email-positive-reply-rate", "cold-email-positive-reply-roi"]);
    for (const s of naming) {
      expect(s.status, s.id).toBe("measured");
      expect(s.charts[0].points.map((p) => p.label).sort(), s.id).toEqual(["Client named", "Client not named"]);
      expect(s.headline, s.id).toMatch(/\(p [<\d]/);
      // the better side is the first bar; it wins only when the verdict is a conclusion
      expect(s.winner, s.id).toBe(s.charts[0].points[0].label);
      expect(s.headline, s.id).toMatch(new RegExp(`^${s.winner} ${s.verdict?.kind === "conclusion" ? "wins" : "leads"}`));
      expect(s.conclusion.join(" "), s.id).toContain("not a split test");
      expect(s.charts[0].note, s.id).toBe(RESEARCH.maturation.note);
      // section ids stay internal: the study joins its section by its pipe field alone
      const text = [s.question, s.headline, s.result?.unit ?? "", s.result?.sample ?? "", ...s.conclusion, ...s.charts.flatMap((c) => [c.title, c.note ?? "", ...c.points.flatMap((p) => [p.label, p.note])])].join(" ");
      expect(text, s.id).not.toMatch(/herald|scout|pilot|blind|discovery|cold email/i);
    }
  });

  it("writes no em-dash anywhere a reader sees", () => {
    expect(JSON.stringify(RESEARCH)).not.toContain("—");
  });
});

describe("Research is GA", () => {
  it("draws the menu entry for every reader, above Refer a friend, with no tag", () => {
    const src = read("components/v2/sidebar-menus.tsx");
    expect(src).toContain('{ href: `${base}/research`, label: "Research"');
    expect(src.indexOf('label: "Research"')).toBeLessThan(src.indexOf('label: "Refer a friend", icon'));
    expect(src).not.toContain("isAdminEmail");
    expect(src).not.toContain("MaturityBadge");
  });

  it("both routes render the page for every reader, with no staff check", () => {
    for (const route of ["research/page.tsx", "research/[...path]/page.tsx"]) {
      const page = read(`app/(authed)/v2/orgs/[orgId]/brands/[brandId]/${route}`);
      expect(page).not.toContain("isAdminEmail");
      expect(page).toContain("<V2Research />");
    }
    expect(read("components/v2/research-page.tsx")).not.toContain("NotAvailable");
  });

  it("paints at once: no wait on Clerk, questions switch without a server round-trip, the menu entry is prefetched", () => {
    const src = read("components/v2/research-page.tsx");
    expect(src).not.toContain("useUser");
    expect(src).not.toContain("<Loading");
    expect(src).toContain("window.history.pushState(null, \"\", href)");
    expect(src).toContain("onClickCapture={onClickCapture}");
    expect(read("components/v2/sidebar-menus.tsx")).toContain("prefetch={l.prefetch ? true : undefined}");
  });

  it("computes nothing: no division, no sort in the page", () => {
    const src = read("components/v2/research-page.tsx");
    expect(src).not.toMatch(/\.sort\(/);
  });

  it("speaks v2's language: Keel primitives, none of the v1 or no-go classes", () => {
    const src = read("components/v2/research-page.tsx");
    expect(src).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|InfoTooltip|shadow-2xl|max-w-\[1400px\]|max-w-none/);
    for (const primitive of ["<TopBar", "<StatTile", "<SectionTitle", "k-inset", "k-label", "max-w-[1280px]"]) expect(src).toContain(primitive);
    // the staff mark rides the nav entry, never the h1
    expect(src).not.toContain("MaturityBadge");
  });

  it("gives every measured study the figure its card leads with", () => {
    for (const s of RESEARCH.studies) {
      if (s.status === "measured") expect(s.result, s.id).not.toBeNull();
      else expect(s.result).toBeNull();
    }
  });

  it("is a known v2 section", () => {
    expect(read("lib/v2/routes.ts")).toContain('"research"');
  });
});

describe("the maturity rule is features-service's, read per leg and applied everywhere", () => {
  // features-service#1196: the Research page applies the rule every price in the dashboard is
  // on, read off the channel catalogue (extract.sh -> maturity.json), never measured here.
  const m = RESEARCH.maturation;
  const dayMs = 86_400_000;

  it("is the served rule: a run-start clock, a duration and an outcome count per leg", () => {
    expect(m.rule).toBe("run_start");
    for (const l of [m.legs.reply, m.legs.visit]) {
      expect(Number.isInteger(l.durationDays)).toBe(true);
      expect(Number.isInteger(l.outcomesRequired)).toBe(true);
      expect(l.outcomesRequired).toBeGreaterThan(0);
    }
    expect(m.days).toBe(Math.max(m.legs.reply.durationDays, m.legs.visit.durationDays));
  });

  it("measures nothing itself: no latency sample, no percentile of its own", () => {
    expect(m).not.toHaveProperty("percentile");
    expect(m).not.toHaveProperty("reply");
    expect(m).not.toHaveProperty("click");
  });

  it("cuts each leg at its own duration before the read, and states the earliest cut", () => {
    for (const l of [m.legs.reply, m.legs.visit]) {
      expect(Date.parse(`${m.windowEnd}T00:00:00Z`) - Date.parse(`${l.cutoff}T00:00:00Z`)).toBe(l.durationDays * dayMs);
    }
    expect(m.cutoff).toBe([m.legs.reply.cutoff, m.legs.visit.cutoff].sort()[0]);
    expect(m.excludedEmails).toBeGreaterThan(0);
  });

  it("marks Learning exactly where a bar rests on fewer outcomes than its leg requires", () => {
    const counted = (note: string) => Number((note.match(/^([\d,]+) /)?.[1] ?? "").replace(/,/g, ""));
    for (const s of RESEARCH.studies.filter((st) => ["llm", "template", "workflow"].includes(st.topic) && st.status === "measured")) {
      const required = s.pipe === "cold-email-positive-reply" ? m.legs.reply.outcomesRequired : m.legs.visit.outcomesRequired;
      for (const p of s.charts[0].points) {
        const got = counted(p.note);
        if (Number.isFinite(got) && /(positive repl|website visit)/.test(p.note)) expect(p.thin, `${s.id}: ${p.label}`).toBe(got < required);
      }
    }
  });

  it("puts the rule under every chart, in the reader's words", () => {
    expect(m.note).toContain(`${m.legs.reply.durationDays} days`);
    expect(m.note).toContain("Learning");
    for (const s of RESEARCH.studies) {
      for (const c of s.charts) {
        expect(c.note, `${s.id}: ${c.title}`).toBeTruthy();
        // the meeting studies sit on the meeting legs' own rule (outcomesRequired meetings), stated in their note
        if (s.pipe === "meeting-booking" || s.outcome === "meeting") expect(c.note, s.id).toMatch(/needs \d+ meetings? behind it/);
        // a typed-judgment study is a count, so no maturity rule applies: its note says so
        else if (s.outcome === "judgment") expect(c.note, s.id).toMatch(/\S/);
        else if (s.topic !== "opens") expect(c.note, s.id).toBe(m.note);
      }
    }
  });

  it("draws the line under every chart and states it on the page", () => {
    const src = read("components/v2/research-page.tsx");
    expect(read("components/v2/research-bits.tsx")).toContain("<ChartNote note={chart.note} />");
    expect(src).toContain("<ChartNote note={c.note} />");
    expect(src).toContain("{RESEARCH.maturation.note}");
    // the page reads the rule's own figures, never a measured latency
    expect(src).toContain("RESEARCH.maturation.legs.reply.durationDays");
    expect(src).not.toMatch(/maturation\.(reply|click)\.pAt/);
  });
});

describe("workflow and template pages (the research catalogue)", () => {
  const catalog = catalogJson as unknown as ResearchCatalog;
  const texts = textsJson as Record<string, string>;
  const base = "/v2/orgs/o/brands/b/research";

  it("reads every path under /research, and never mistakes a study for a pipe page", () => {
    expect(parseResearchPath("")).toEqual({ view: "hub" });
    expect(parseResearchPath("cold-email-positive-reply-template-roi")).toEqual({ view: "study", id: "cold-email-positive-reply-template-roi" });
    expect(parseResearchPath("cold-email-positive-reply/workflows")).toEqual({ view: "list", pipe: "cold-email-positive-reply", kind: "workflows" });
    expect(parseResearchPath("cold-email-website-visit/templates/cold-email-v19")).toEqual({ view: "item", pipe: "cold-email-website-visit", kind: "templates", key: "cold-email-v19" });
    expect(parseResearchPath("cold-email-positive-reply/models/gemini-3.1-pro")).toEqual({ view: "item", pipe: "cold-email-positive-reply", kind: "models", key: "gemini-3.1-pro" });
    expect(parseResearchPath("nobody/workflows").view).toBe("missing");
    expect(parseResearchPath("cold-email-positive-reply/audiences").view).toBe("missing");
    expect(researchCatalogHref(base, "cold-email-positive-reply", "workflows", "a b")).toBe(`${base}/cold-email-positive-reply/workflows/a%20b`);
  });

  it("lists, for each pipe, what the hub counts", () => {
    for (const pipe of PIPE_ORDER) {
      expect(catalog[pipe].workflows.length).toBe(RESEARCH.catalogCounts[pipe].workflows);
      expect(catalog[pipe].templates.length).toBe(RESEARCH.catalogCounts[pipe].templates);
      expect(catalog[pipe].models.length).toBe(RESEARCH.catalogCounts[pipe].models);
    }
    expect(catalog["cold-email-positive-reply"].workflows.length).toBeGreaterThan(0);
    expect(catalog["cold-email-website-visit"].templates.length).toBeGreaterThan(0);
  });

  it("gives every bar of a workflow or template study a page, and no other study a link", () => {
    for (const s of RESEARCH.studies) {
      for (const c of s.charts.filter((ch) => ch.kind === "bars")) {
        for (const p of c.points) {
          const href = pointHref(base, s, p);
          // an outcome study spans every leg: no catalogue page to open
          if (s.pipe === null) {
            expect(href, s.id).toBeNull();
            continue;
          }
          if (s.topic === "workflow") {
            expect(researchWorkflow(catalog, s.pipe, p.key!), `${s.id} ${p.label}`).not.toBeNull();
            expect(href).toBe(`${base}/${s.pipe}/workflows/${encodeURIComponent(p.key!)}`);
          } else if (s.topic === "template") {
            expect(researchTemplate(catalog, s.pipe, p.key!), `${s.id} ${p.label}`).not.toBeNull();
            expect(href).toBe(`${base}/${s.pipe}/templates/${encodeURIComponent(p.key!)}`);
          } else if (s.topic === "llm") {
            expect(researchModel(catalog, s.pipe, p.key!), `${s.id} ${p.label}`).not.toBeNull();
            expect(researchModel(catalog, s.pipe, p.key!)!.label).toBe(p.label);
            expect(href).toBe(`${base}/${s.pipe}/models/${encodeURIComponent(p.key!)}`);
          } else {
            expect(href).toBeNull();
          }
        }
      }
    }
  });

  it("states the same figure on a workflow page as on the study's bar", () => {
    const study = RESEARCH.studies.find((s) => s.id === "cold-email-positive-reply-workflow-roi")!;
    for (const p of study.charts[0].points) {
      const w = researchWorkflow(catalog, "cold-email-positive-reply", p.key!)!;
      expect(w.label).toBe(p.label);
      expect(w.cost).toBe(p.display);
    }
    const tStudy = RESEARCH.studies.find((s) => s.id === "cold-email-website-visit-template-roi")!;
    for (const p of tStudy.charts[0].points) expect(researchTemplate(catalog, "cold-email-website-visit", p.key!)!.cost).toBe(p.display);
    const mStudy = RESEARCH.studies.find((s) => s.id === "cold-email-positive-reply-llm-roi")!;
    for (const p of mStudy.charts[0].points) expect(researchModel(catalog, "cold-email-positive-reply", p.key!)!.cost).toBe(p.display);
  });

  it("links a workflow to its template's page only when that page exists, and every template carries its text", () => {
    for (const pipe of PIPE_ORDER) {
      for (const w of catalog[pipe].workflows) {
        if (w.template?.linked) expect(researchTemplate(catalog, pipe, w.template.key)).not.toBeNull();
        if (w.model?.linked) expect(researchModel(catalog, pipe, w.model.key)).not.toBeNull();
        expect(w.label).not.toMatch(/\b[a-z]+-v\d+\b/);
        for (const r of w.runs) expect(r.cost === null || r.cost.startsWith("$")).toBe(true);
      }
      for (const t of catalog[pipe].templates) {
        if (t.hasText) expect(texts[t.key]?.length, t.key).toBeGreaterThan(0);
        for (const wf of t.workflows) expect(researchWorkflow(catalog, pipe, wf.key)).not.toBeNull();
      }
      for (const m of catalog[pipe].models) {
        for (const wf of m.workflows) expect(researchWorkflow(catalog, pipe, wf.key)!.model?.key).toBe(m.key);
        for (const r of m.runs) if (r.template?.linked) expect(researchTemplate(catalog, pipe, r.template.key)).not.toBeNull();
      }
    }
  });

  it("maps a campaign's channel and landing step to its research pipe", () => {
    expect(researchPipeFor("sales-cold-email-outreach", "conversation")).toBe("cold-email-positive-reply");
    expect(researchPipeFor("sales-cold-email-outreach", "website_visit")).toBe("cold-email-website-visit");
    expect(researchPipeFor("sales-cold-email-outreach", null)).toBeNull();
  });

  it("writes no em-dash and names no client in the catalogue", () => {
    expect(JSON.stringify(catalog)).not.toContain("\u2014");
    expect(JSON.stringify(catalog)).not.toMatch(/org_|@/);
  });

  it("wires the links: hub chips, clickable study bars, template chips, and the template link on the brand workflow page", () => {
    const page = read("components/v2/research-page.tsx");
    expect(page).toContain("<PipeCatalogLinks base={base} pipe={pipe} />");
    expect(page).toContain("hrefFor={(p) => pointHref(base, study, p)}");
    const cat = read("components/v2/research-catalog.tsx");
    expect(cat).toContain('researchCatalogHref(base, pipe, "templates", w.template.key)');
    expect(cat).not.toMatch(/\.sort\(|text-gray-|InfoTooltip/);
    const wf = read("components/v2/workflow-page.tsx");
    expect(wf).toContain("<ResearchTemplateChip");
    expect(read("components/v2/research-template-link.tsx")).not.toContain("useIsAdminUser");
    expect(wf).toContain("<ResearchModelChip");
    // a workflow's alias is never mapped to a model: the chip follows the model Research measured
    expect(read("components/v2/research-template-link.tsx")).toContain("researchWorkflow(catalog, pipe, dynasty)?.model");
    // the chips read the catalogue from the staff-only route (research.ts carries no data any more)
    expect(read("components/v2/research-template-link.tsx")).toContain('useResearchCatalog("user")');
  });
});

describe("the workflows catalogue names each workflow and gives its LLM and template their own columns", () => {
  const catalog = catalogJson as unknown as Record<string, { workflows: { key: string; name: string | null }[] }>;
  it("every workflow carries the name workflow-service states for it", () => {
    for (const pipe of Object.values(catalog)) for (const w of pipe.workflows) expect(w.name, w.key).toBeTruthy();
  });
  it("the list renders LLM and Template columns whose cells link to the model and template pages", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/research-catalog.tsx"), "utf8");
    expect(src).toContain("<th className={`${TH} w-40`}>LLM</th>");
    expect(src).toContain("<th className={`${TH} w-40`}>Template</th>");
    expect(src).toContain('kind="models" r={(r as ResearchWorkflow).model}');
    expect(src).toContain('kind="templates" r={(r as ResearchWorkflow).template}');
    expect(src).toContain("onClick={(e) => e.stopPropagation()}");
  });
});
