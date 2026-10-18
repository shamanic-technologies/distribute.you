import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { OUTCOME_PATH, PIPE_KEY, PIPE_ORDER, parseResearchPath } from "../src/lib/research/research";
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

  it("names a section in order from served words, a Shimmer until they answer, never a hardcoded name", () => {
    const bits = read("apps/dashboard/src/components/v2/research-bits.tsx");
    const fn = bits.slice(bits.indexOf("export function SectionName("), bits.indexOf("/** A topic's mark"));
    expect(fn).toContain("legFor(catalogue, k.leg)");
    expect(fn).toContain("{ step: leg.fromLabel }, { channel: def.name, def }, { step: leg.toLabel }");
    expect(fn).toContain("<Shimmer");
    expect(bits).toContain("<ChannelChip name={it.channel} def={it.def} notRun={false} compact />");
    // the meeting outcome reads as its sales path; Jev is no outcome, so it is just named
    expect(OUTCOME_PATH.meeting).toEqual(["lead_found", "conversation", "meeting_booked"]);
    expect(OUTCOME_PATH.judgment).toBeNull();
    expect(fn).toContain("if (!path) return <>Jev</>;");
    const page = read("apps/dashboard/src/components/v2/research-page.tsx");
    expect(page).toContain('{OUTCOME_PATH[outcome] && <span className="k-chip font-normal">Sales path</span>}');
    expect(page).not.toContain("All legs</span>");
    expect(page).toContain("every pipe buys one outcome");
  });
});

describe("the retired section names are gone from the Research code path", () => {
  const BANNED = /\bcrews?\b|herald|scout|\bpilot\b/i;
  // The one map that redirects old links, and the shared mark imports renamed in a later change.
  const ALLOWED = [/^const LEGACY_SECTION: Record<string, ResearchPipe> = \{/, /^import .* from "@\/lib\/v2\/crews";$/, /^import \{ CrewMark \} from "@\/components\/v2\/crew-mark";$/];
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
