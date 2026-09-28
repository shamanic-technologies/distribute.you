"use client";

/**
 * `/get-started`: onboarding v2, signed out, in the dashboard v2 (Keel) language.
 *
 * Explee's order: a website, then real output one step at a time (the company read,
 * its competitors, its segments sized off a free dry-run count), then ONE screen that
 * asks for the account and the card together. Nothing is asked before the output.
 *
 * Every read runs on the ANONYMOUS org (`/api/anon/v1`, a small internal credit, a
 * closed allowlist bound to this session's brand), exactly like `/onboarding`'s
 * signed-out half, so nothing here spends on anybody else. Steps whose backend is
 * not live yet (sample companies, sample people, the written email) say so on the
 * step rather than showing invented rows. Rules live in `lib/v2/get-started.ts`.
 *
 * The current `/onboarding` is untouched; this route is reached by link only.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import posthog from "posthog-js";
import {
  ApiError,
  extractBrandFields,
  getAudiencePreview,
  getPublicCatalogueSignedOut,
  getWorkflowProjectionLadder,
  listBrandOffers,
  previewColdEmail,
  suggestAudiences,
  suggestBrandIcp,
  upsertBrand,
  type AudiencePreview,
  type PreviewEmail,
} from "@/lib/api";
import { startAnonSession } from "@/lib/anon-session-client";
import { refusalExits, type RefusalExits } from "@/lib/claimed-signup";
import { websiteInputProblem } from "@/lib/website-input";
import { channelMinimumCents, channelMinimumsFromWire } from "@/lib/channel-minimums";
import { NEW_ORG_CHANNEL_SLUG, newOrgLeg, recommendedDailyBudgetUsd } from "@/lib/v2/new-org-wizard";
import {
  COMPANY_FIELDS,
  COMPETITOR_FIELDS,
  GET_STARTED_SNAPSHOT_KEY,
  GET_STARTED_STEPS,
  STEPS_NOT_LIVE,
  compactCount,
  hostOf,
  parseCompetitors,
  parseGetStartedSnapshot,
  valueLines,
  valueText,
  websiteUrl,
  type Competitor,
  type GetStartedSegment,
  type GetStartedSnapshot,
  type GetStartedStepKey,
} from "@/lib/v2/get-started";
import { Shimmer } from "@/components/v2/ui";
import { BrandLogo } from "@/components/brand-logo";
import { GET_STARTED_LEG } from "./launch";
import { AccountCardWall } from "./account-card-wall";

type StepState = "waiting" | "running" | "done" | "failed" | "notLive";

const LEG = newOrgLeg(GET_STARTED_LEG);

export function GetStarted() {
  const params = useSearchParams();
  const { isSignedIn } = useAuth();

  const [website, setWebsite] = useState(params.get("url") ?? "");
  const [inputError, setInputError] = useState<string | null>(null);
  const [exits, setExits] = useState<RefusalExits | null>(null);
  const [started, setStarted] = useState(false);

  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [overview, setOverview] = useState("");
  const [facts, setFacts] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [segments, setSegments] = useState<GetStartedSegment[]>([]);
  const [steps, setSteps] = useState<Record<GetStartedStepKey, StepState>>(() => initialSteps());
  const [floorUsd, setFloorUsd] = useState(1);
  const [recommendedUsd, setRecommendedUsd] = useState<number | null>(null);
  const [wallOpen, setWallOpen] = useState(false);
  // Steps 4 to 6 read ONE segment at a time: its free sample, then an email to one of
  // its people. The largest segment is read first; clicking another reads that one.
  const [selectedSeg, setSelectedSeg] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, AudiencePreview>>({});
  const [emails, setEmails] = useState<Record<string, PreviewEmail>>({});
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());
  const [restoredBudget, setRestoredBudget] = useState<number | null>(null);

  const ran = useRef(false);

  // Back from the Google sign-up round trip (or a reload): the preview is restored
  // from this tab's snapshot and the wall opens at the step it was on.
  useEffect(() => {
    const snap = parseGetStartedSnapshot(sessionStorage.getItem(GET_STARTED_SNAPSHOT_KEY));
    if (!snap) return;
    if (params.get("resume") !== "1" && !isSignedIn) return;
    applySnapshot(snap);
    setWallOpen(params.get("resume") === "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The channel's floor, off the public catalogue: no session needed.
  useEffect(() => {
    getPublicCatalogueSignedOut()
      .then((cat) => {
        const cents = channelMinimumCents(channelMinimumsFromWire(cat.channels), NEW_ORG_CHANNEL_SLUG);
        if (cents != null) setFloorUsd(cents / 100);
      })
      .catch((e) => console.error("[get-started] catalogue read failed:", e));
  }, []);

  // A website carried from a link starts the walk at once, like Explee's hero.
  useEffect(() => {
    if (ran.current || started || isSignedIn) return;
    const carried = params.get("url");
    if (carried && !websiteInputProblem(carried) && params.get("resume") !== "1") void start(carried);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applySnapshot(s: GetStartedSnapshot) {
    setWebsite(s.website);
    setBrandId(s.brandId);
    setBrandName(s.brandName);
    setDomain(s.domain);
    setOverview(s.overview);
    setFacts(s.facts);
    setCompetitors(s.competitors);
    setSegments(s.segments);
    setRestoredBudget(s.budgetUsd);
    if (s.segments.length) setSelectedSeg([...s.segments].sort((a, b) => b.count - a.count)[0].audienceId);
    setStarted(true);
    ran.current = true;
    setSteps({
      company: "done",
      competitors: s.competitors.length ? "done" : "failed",
      segments: s.segments.length ? "done" : "failed",
      companies: STEPS_NOT_LIVE.has("companies") ? "notLive" : "failed",
      people: STEPS_NOT_LIVE.has("people") ? "notLive" : "failed",
      email: STEPS_NOT_LIVE.has("email") ? "notLive" : "failed",
    });
  }

  const setStep = (k: GetStartedStepKey, v: StepState) => setSteps((cur) => ({ ...cur, [k]: v }));

  function markSampleSteps(v: StepState) {
    setSteps((cur) => {
      const next = { ...cur };
      for (const k of ["companies", "people", "email"] as const) if (!STEPS_NOT_LIVE.has(k)) next[k] = v;
      return next;
    });
  }

  // Steps 4 and 5: the selected segment's free sample (companies + people, no email).
  // A sample the producer cannot take YET (its filters are still being built) is asked
  // again a few times; an empty one is final.
  useEffect(() => {
    if (!selectedSeg || STEPS_NOT_LIVE.has("companies") || previews[selectedSeg] || inFlight.current.has(`p:${selectedSeg}`)) return;
    const id = selectedSeg;
    inFlight.current.add(`p:${id}`);
    setSteps((cur) => ({ ...cur, companies: "running", people: "running", email: STEPS_NOT_LIVE.has("email") ? cur.email : "running" }));
    void (async () => {
      let got: AudiencePreview | null = null;
      for (let i = 0; i < 12; i++) {
        try {
          got = await getAudiencePreview(id);
        } catch (e) {
          console.error("[get-started] audience preview failed:", e);
          got = null;
          break;
        }
        if (!(got.status === "unavailable" && got.reason === "not_built_yet")) break;
        await new Promise((r) => setTimeout(r, 5000));
      }
      inFlight.current.delete(`p:${id}`);
      if (got) setPreviews((cur) => ({ ...cur, [id]: got! }));
      const ok = got?.status === "ready";
      setSteps((cur) => ({
        ...cur,
        companies: ok && got!.companies.length ? "done" : "failed",
        people: ok && got!.people.length ? "done" : "failed",
        email: ok && got!.people.length ? cur.email : STEPS_NOT_LIVE.has("email") ? cur.email : "failed",
      }));
    })();
  }, [selectedSeg, previews]);

  // Step 6: one email written for one of the sampled people, billed to this
  // session's anonymous org. The same brand + person returns the stored email.
  useEffect(() => {
    if (!selectedSeg || !brandId || STEPS_NOT_LIVE.has("email") || emails[selectedSeg] || inFlight.current.has(`e:${selectedSeg}`)) return;
    const prev = previews[selectedSeg];
    const person = prev?.status === "ready" ? prev.people.find((x) => x.firstName && x.title && x.company) : undefined;
    if (!person) return;
    const id = selectedSeg;
    const seg = segments.find((x) => x.audienceId === id);
    inFlight.current.add(`e:${id}`);
    setEmailNote(null);
    setStep("email", "running");
    void (async () => {
      try {
        const mail = await writeWithRetry(() => previewColdEmail({
          brandId,
          recipient: {
            firstName: person.firstName!,
            lastName: person.lastNameObfuscated || person.firstName!.slice(0, 1),
            title: person.title!,
            companyName: person.company!,
          },
          audience: seg?.name,
          offerId,
        }));
        setEmails((cur) => ({ ...cur, [id]: mail }));
        setStep("email", "done");
      } catch (e) {
        console.error("[get-started] email preview failed:", e);
        setEmailNote(
          e instanceof ApiError && e.status === 402
            ? "Your free preview credit is used up, so we stopped before writing the email. It will be written once your account is set up."
            : "We could not write the email just now.",
        );
        setStep("email", "failed");
      } finally {
        inFlight.current.delete(`e:${id}`);
      }
    })();
  }, [selectedSeg, previews, emails, brandId, offerId, segments]);

  async function start(raw: string) {
    if (ran.current) return;
    const problem = websiteInputProblem(raw);
    if (problem || !raw.trim()) {
      setInputError(problem ?? "Enter your website.");
      return;
    }
    ran.current = true;
    setInputError(null);
    setExits(null);
    setStarted(true);
    setStep("company", "running");
    posthog.capture("get_started_website_submitted");

    const url = websiteUrl(raw);
    const session = await startAnonSession(url);
    if (!session.started) {
      ran.current = false;
      setStarted(false);
      setSteps(initialSteps());
      setInputError(session.message);
      setExits(refusalExits({ reason: session.reason, domain: hostOf(url), brandUrl: url }));
      return;
    }

    let id: string;
    let createdName: string | null = null;
    try {
      const brand = await upsertBrand(url);
      id = brand.brandId;
      setBrandId(id);
      createdName = brand.name;
      setBrandName(brand.name);
      setDomain(brand.domain ?? hostOf(url));
    } catch (e) {
      console.error("[get-started] brand create failed:", e);
      ran.current = false;
      setStarted(false);
      setSteps(initialSteps());
      setInputError("We could not read this website. Check it and try again.");
      return;
    }

    setStep("competitors", "running");
    setStep("segments", "running");
    const host = hostOf(url);

    // ONE read at a time, deliberately. Every metered call first HOLDS its worst case
    // against the anonymous org's small seed, so reads in parallel stack their holds and
    // the third one is refused for credit the first two will never actually spend
    // (measured: ~$1.30 spent, a $2.20 hold refused). The company and its competitors
    // are one extraction for the same reason.
    let read = { ov: "", fs: [] as string[] };
    let list: Competitor[] = [];
    try {
      const r = await extractBrandFields([id], [...COMPANY_FIELDS, ...COMPETITOR_FIELDS], {
        mode: "suggest",
        urlStrategy: "landing",
      });
      read = {
        ov: valueText(r.fields.companyOverview?.value),
        fs: valueLines(r.fields.companyFacts?.value).slice(0, 4),
      };
      list = parseCompetitors(r.fields.competitorsWithDomains?.value, host);
      setOverview(read.ov);
      setFacts(read.fs);
      setCompetitors(list);
      setStep("company", read.ov || read.fs.length ? "done" : "failed");
      setStep("competitors", list.length ? "done" : "failed");
    } catch (e) {
      console.error("[get-started] company read failed:", e);
      setStep("company", "failed");
      setStep("competitors", "failed");
    }

    let found: GetStartedSegment[] = [];
    try {
      const { icp } = await suggestBrandIcp(id);
      const { candidates } = await suggestAudiences(id, icp);
      found = candidates
        .filter((c) => !c.validationError)
        .map((c) => ({ audienceId: c.audienceId, name: c.name, rationale: c.rationale, count: c.count }));
      setSegments(found);
      setStep("segments", found.length ? "done" : "failed");
      if (found.length) setSelectedSeg([...found].sort((a, b) => b.count - a.count)[0].audienceId);
    } catch (e) {
      console.error("[get-started] segment read failed:", e);
      setStep("segments", "failed");
    }

    setSteps((cur) => {
      const next = { ...cur };
      for (const k of STEPS_NOT_LIVE) next[k] = "notLive";
      return next;
    });
    if (found.length === 0) markSampleSteps("failed");
    posthog.capture("get_started_preview_ready", { segments: found.length, competitors: list.length });

    saveSnapshot({
      version: 1,
      website: url,
      brandId: id,
      brandName: createdName,
      domain: host,
      overview: read.ov,
      facts: read.fs,
      competitors: list,
      segments: found,
      budgetUsd: null,
    });

    // What the recommended budget buys, priced on the brand's offer. Best effort: the
    // wall opens with an empty field and the floor stated when no price is held.
    try {
      const { offers } = await listBrandOffers(id);
      const offerId = offers[0]?.offerId;
      if (offerId) setOfferId(offerId);
      if (offerId) {
        const ladder = await getWorkflowProjectionLadder({ featureSlug: NEW_ORG_CHANNEL_SLUG, brandId: id, offerId, leg: GET_STARTED_LEG });
        const rec = ladder.recommendedWorkflowDynastySlug;
        const row = ladder.rows.find((r) => r.audienceId === null && r.workflow.workflowDynastySlug === rec);
        setRecommendedUsd(recommendedDailyBudgetUsd(LEG, row?.resolved.costPerOutcomeUsd ?? null, floorUsd));
      }
    } catch (e) {
      console.error("[get-started] price read failed:", e);
    }
  }

  function saveSnapshot(s: GetStartedSnapshot) {
    try {
      sessionStorage.setItem(GET_STARTED_SNAPSHOT_KEY, JSON.stringify(s));
    } catch (e) {
      console.error("[get-started] snapshot write failed:", e);
    }
  }

  const liveDone = steps.company !== "running" && steps.competitors !== "running" && steps.segments !== "running";
  const canLaunch = started && liveDone && !!brandId && segments.length > 0;
  const current = useMemo(() => GET_STARTED_STEPS.findIndex((s) => steps[s.key] === "running"), [steps]);

  if (!started) {
    return (
      <Hero
        website={website}
        onWebsite={(v) => {
          setWebsite(v);
          setInputError(null);
          setExits(null);
        }}
        onSubmit={() => void start(website)}
        error={inputError}
        exits={exits}
      />
    );
  }

  return (
    <div className="k-canvas min-h-[100dvh]">
      {canLaunch && (
        <div className="sticky top-0 z-20 border-b border-[var(--line-subtle)] bg-[var(--bg-raised)]">
          <div className="mx-auto flex max-w-[1100px] items-center gap-4 px-6 py-3">
            <div className="min-w-0 flex-1">
              <p className="k-fg text-[14px] font-medium">$30 of free credit to start</p>
              <p className="k-fg3 text-[12px]">No charge today. We write and send the emails, you get the replies.</p>
            </div>
            <button type="button" className="k-btn-accent h-8 px-3" onClick={() => setWallOpen(true)}>
              Start outreach
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1100px] px-6 py-8">
        <Stepper steps={steps} current={current} />

        <div className="mt-8 grid gap-4">
          <CompanyCard state={steps.company} name={brandName} domain={domain} website={website} overview={overview} facts={facts} />
          <CompetitorsCard state={steps.competitors} competitors={competitors} />
          <SegmentsCard state={steps.segments} segments={segments} selected={selectedSeg} onSelect={setSelectedSeg} />
          {STEPS_NOT_LIVE.has("companies") ? (
            <NotLiveCard index={4} title="Companies that match" body="Real companies for each segment will be listed here. This step is not live yet." />
          ) : (
            <CompaniesCard state={steps.companies} preview={selectedSeg ? previews[selectedSeg] : undefined} segmentName={segments.find((x) => x.audienceId === selectedSeg)?.name ?? null} />
          )}
          {STEPS_NOT_LIVE.has("people") ? (
            <NotLiveCard index={5} title="Decision makers" body="The people we would write to at those companies, by name and role, will be listed here. This step is not live yet." />
          ) : (
            <PeopleCard state={steps.people} preview={selectedSeg ? previews[selectedSeg] : undefined} />
          )}
          {STEPS_NOT_LIVE.has("email") ? (
            <NotLiveCard index={6} title="Your first email" body="One email written for one of those people will appear here, ready to send. This step is not live yet." />
          ) : (
            <EmailCard state={steps.email} mail={selectedSeg ? emails[selectedSeg] : undefined} note={emailNote} />
          )}
        </div>

        {canLaunch && (
          <div className="mt-6 flex justify-end">
            <button type="button" className="k-btn-accent h-9 px-4" onClick={() => setWallOpen(true)}>
              Start outreach with $30 free
            </button>
          </div>
        )}
      </div>

      {wallOpen && brandId && (
        <AccountCardWall
          brandId={brandId}
          website={websiteUrl(website)}
          brandName={brandName ?? domain ?? website}
          offerSource={overview}
          segments={segments}
          floorUsd={floorUsd}
          recommendedUsd={restoredBudget ?? recommendedUsd}
          onBudget={(usd) => {
            const snap = parseGetStartedSnapshot(sessionStorage.getItem(GET_STARTED_SNAPSHOT_KEY));
            if (snap) saveSnapshot({ ...snap, budgetUsd: usd });
          }}
          onClose={() => setWallOpen(false)}
        />
      )}
    </div>
  );
}

function initialSteps(): Record<GetStartedStepKey, StepState> {
  return { company: "waiting", competitors: "waiting", segments: "waiting", companies: "waiting", people: "waiting", email: "waiting" };
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Hero({
  website,
  onWebsite,
  onSubmit,
  error,
  exits,
}: {
  website: string;
  onWebsite: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
  exits: RefusalExits | null;
}) {
  return (
    <div className="k-canvas flex min-h-[100dvh] items-center justify-center px-6">
      <div className="w-full max-w-[560px]">
        <p className="k-label">distribute.you</p>
        <h1 className="k-fg mt-3 text-[28px] font-medium leading-9 tracking-[-0.01em]">See who we would sell to for you.</h1>
        <p className="k-fg2 mt-2 text-[14px] leading-6">
          Type your website. In about a minute we read your company, find your competitors and size the segments worth writing to. No account needed.
        </p>
        <form
          className="k-card mt-6 flex items-center gap-2 p-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <input
            className="k-input h-9 min-w-0 flex-1 px-3 text-[14px]"
            placeholder="yourcompany.com"
            value={website}
            onChange={(e) => onWebsite(e.target.value)}
            autoFocus
            inputMode="url"
            aria-label="Your website"
          />
          <button type="submit" className="k-btn-accent h-9 px-4">
            Start
          </button>
        </form>
        {error && (
          <p className="mt-3 text-[13px] text-[var(--data-rose)]" role="alert">
            {error}
          </p>
        )}
        {exits && (
          <p className="k-fg2 mt-2 text-[13px]">
            {exits.signIn && (
              <>
                {exits.signIn.lead}{" "}
                <a className="k-accent-text underline" href={exits.signIn.href}>
                  {exits.signIn.label}
                </a>
                .{" "}
              </>
            )}
            <a className="k-accent-text underline" href={exits.signUp.href}>
              {exits.signUp.label}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

function Stepper({ steps, current }: { steps: Record<GetStartedStepKey, StepState>; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Progress">
      {GET_STARTED_STEPS.map((s, i) => {
        const st = steps[s.key];
        const active = i === current;
        return (
          <li key={s.key} className="flex items-center gap-2">
            {i > 0 && <span className="hidden h-px w-3 bg-[var(--line)] sm:block" />}
            <span
              className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] ${
                active ? "k-card k-fg font-medium" : st === "done" ? "k-fg2" : "k-fg3"
              }`}
            >
              <StepMark index={i + 1} state={st} />
              <span className={active ? "" : "hidden md:inline"}>{s.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StepMark({ index, state }: { index: number; state: StepState }) {
  if (state === "running") return <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" aria-label="Running" />;
  if (state === "done")
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-strong)] text-[10px] text-white tabular-nums">{index}</span>
    );
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--line-strong)] text-[10px] tabular-nums">{index}</span>
  );
}

function StepCard({
  index,
  title,
  meta,
  children,
}: {
  index: number;
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="k-card p-4">
      <div className="flex items-center gap-2">
        <span className="k-label">{`Step ${index}`}</span>
        <h2 className="k-fg text-[14px] font-medium">{title}</h2>
        {meta && <span className="ml-auto">{meta}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function StateWord({ state, doneLabel }: { state: StepState; doneLabel?: string }) {
  if (state === "running")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
        <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" />
        Working
      </span>
    );
  if (state === "done") return <span className="k-fg3 text-[12px] tabular-nums">{doneLabel ?? "Done"}</span>;
  if (state === "failed") return <span className="text-[12px] text-[var(--data-amber)]">Nothing found</span>;
  if (state === "notLive") return <span className="k-chip">Not live yet</span>;
  return null;
}

function Rows({ n }: { n: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: n }).map((_, i) => (
        <Shimmer key={i} className="h-5" />
      ))}
    </div>
  );
}

function CompanyCard({
  state,
  name,
  domain,
  website,
  overview,
  facts,
}: {
  state: StepState;
  name: string | null;
  domain: string | null;
  website: string;
  overview: string;
  facts: string[];
}) {
  return (
    <StepCard index={1} title="Your company" meta={<StateWord state={state} />}>
      <div className="flex items-center gap-3">
        <BrandLogo domain={domain} size={28} className="rounded-md" />
        <div className="min-w-0">
          <p className="k-fg truncate text-[14px] font-medium">{name ?? domain ?? website}</p>
          {domain && <p className="k-fg3 k-mono truncate text-[12px]">{domain}</p>}
        </div>
      </div>
      {state === "running" ? (
        <div className="mt-3">
          <Rows n={3} />
        </div>
      ) : state === "failed" ? (
        <p className="k-fg3 mt-3 text-[13px]">We could not read enough from your site to describe it. The rest of the preview still runs.</p>
      ) : (
        <>
          {overview && <p className="k-fg2 mt-3 text-[13px] leading-5">{overview}</p>}
          {facts.length > 0 && (
            <div className="k-inset mt-3 grid gap-1.5 rounded-lg p-3">
              {facts.map((f) => (
                <p key={f} className="k-fg2 text-[12px] leading-5">
                  {f}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </StepCard>
  );
}

function CompetitorsCard({ state, competitors }: { state: StepState; competitors: Competitor[] }) {
  return (
    <StepCard index={2} title="Competitors" meta={<StateWord state={state} doneLabel={`${competitors.length} found`} />}>
      {state === "running" || state === "waiting" ? (
        <Rows n={3} />
      ) : competitors.length === 0 ? (
        <p className="k-fg3 text-[13px]">We found no direct competitor on your site. This does not change what we send.</p>
      ) : (
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {competitors.map((c) => (
            <li key={c.domain ?? c.name} className="k-inset flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5">
              <BrandLogo domain={c.domain} size={16} className="rounded-sm" />
              <span className="k-fg2 truncate text-[13px]">{c.domain ?? c.name}</span>
            </li>
          ))}
        </ul>
      )}
    </StepCard>
  );
}

function SegmentsCard({
  state,
  segments,
  selected,
  onSelect,
}: {
  state: StepState;
  segments: GetStartedSegment[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <StepCard index={3} title="Segments to write to" meta={<StateWord state={state} doneLabel={segments.length === 1 ? "1 segment" : `${segments.length} segments`} />}>
      {state === "running" || state === "waiting" ? (
        <Rows n={4} />
      ) : segments.length === 0 ? (
        <p className="k-fg3 text-[13px]">We could not size a segment for your company. Try again in a moment.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {segments.map((s) => (
            <button
              key={s.audienceId}
              type="button"
              onClick={() => onSelect(s.audienceId)}
              aria-pressed={selected === s.audienceId}
              className={`k-inset rounded-lg p-3 text-left ${selected === s.audienceId ? "k-selected ring-1 ring-[var(--accent)]" : "k-hover"}`}
            >
              <div className="flex items-baseline gap-2">
                <p className="k-fg min-w-0 flex-1 truncate text-[13px] font-medium">{s.name}</p>
                <span className="k-fg tabular-nums text-[13px] font-medium">{compactCount(s.count)}</span>
              </div>
              <p className="k-fg3 text-[11px]">people match</p>
              {s.rationale && <p className="k-fg2 mt-2 text-[12px] leading-5">{s.rationale}</p>}
            </button>
          ))}
        </div>
      )}
    </StepCard>
  );
}

/**
 * The first email for a brand takes ~110 s (brand-service reads the site, then the
 * model writes), and the Cloudflare edge in front of the gateway closes a request at
 * ~100 s while content-generation keeps going and stores the email. A repeat of the
 * same call returns the stored email in milliseconds, so anything that is not an
 * answer from the producer (a timeout, a gateway error) is asked again. A 4xx is an
 * answer and is never retried.
 */
async function writeWithRetry<T>(call: () => Promise<T>): Promise<T> {
  let last: unknown = null;
  for (let i = 0; i < 6; i++) {
    try {
      return await call();
    } catch (e) {
      last = e;
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) throw e;
      console.warn(`[get-started] email still being written (attempt ${i + 1}):`, e);
      await new Promise((r) => setTimeout(r, 15000));
    }
  }
  throw last;
}

function sampleNote(preview: AudiencePreview | undefined): string {
  if (!preview) return "We could not take a sample of this segment just now.";
  if (preview.status === "empty") return "The search found nobody in this segment. Pick another one above.";
  if (preview.reason === "not_built_yet") return "This segment is still being prepared. Pick another one above, or come back in a minute.";
  return "This segment cannot be sampled for free. Pick another one above.";
}

function CompaniesCard({ state, preview, segmentName }: { state: StepState; preview: AudiencePreview | undefined; segmentName: string | null }) {
  const companies = preview?.status === "ready" ? preview.companies : [];
  return (
    <StepCard
      index={4}
      title={segmentName ? `Companies in ${segmentName}` : "Companies that match"}
      meta={<StateWord state={state} doneLabel={`${companies.length} shown`} />}
    >
      {state === "running" || state === "waiting" ? (
        <Rows n={4} />
      ) : companies.length === 0 ? (
        <p className="k-fg3 text-[13px]">{sampleNote(preview)}</p>
      ) : (
        <>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {companies.map((c) => (
              <li key={c.name} className="k-inset flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5">
                <span className="k-fg truncate text-[13px]">{c.name}</span>
              </li>
            ))}
          </ul>
          <p className="k-fg3 mt-2 text-[12px]">A first page of real matches, not the whole list.</p>
        </>
      )}
    </StepCard>
  );
}

function PeopleCard({ state, preview }: { state: StepState; preview: AudiencePreview | undefined }) {
  const people = preview?.status === "ready" ? preview.people : [];
  return (
    <StepCard index={5} title="Decision makers" meta={<StateWord state={state} doneLabel={`${people.length} shown`} />}>
      {state === "running" || state === "waiting" ? (
        <Rows n={5} />
      ) : people.length === 0 ? (
        <p className="k-fg3 text-[13px]">{sampleNote(preview)}</p>
      ) : (
        <div className="k-scroll overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line-subtle)]">
                <th className="k-label px-2 py-2 text-left font-normal">Name</th>
                <th className="k-label px-2 py-2 text-left font-normal">Title</th>
                <th className="k-label px-2 py-2 text-left font-normal">Company</th>
              </tr>
            </thead>
            <tbody>
              {people.map((x, i) => (
                <tr key={`${x.firstName}-${x.company}-${i}`} className="k-row border-b border-[var(--line-subtle)] last:border-0">
                  <td className="k-fg px-2 py-2">{[x.firstName, x.lastNameObfuscated].filter(Boolean).join(" ") || "—"}</td>
                  <td className="k-fg2 px-2 py-2">{x.title ?? "—"}</td>
                  <td className="k-fg2 px-2 py-2">{x.company ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="k-fg3 mt-2 text-[12px]">Last names are masked until your account is set up. We never show an email here.</p>
        </div>
      )}
    </StepCard>
  );
}

function EmailCard({ state, mail, note }: { state: StepState; mail: PreviewEmail | undefined; note: string | null }) {
  return (
    <StepCard index={6} title="Your first email" meta={<StateWord state={state} />}>
      {state === "running" || state === "waiting" ? (
        <>
          <p className="k-fg3 mb-3 text-[12px]">We read your site the way a campaign does, then write. The first email takes about a minute and a half.</p>
          <Rows n={6} />
        </>
      ) : !mail ? (
        <p className="k-fg3 text-[13px]">{note ?? "We need at least one person in the sample to write to."}</p>
      ) : (
        <div className="k-inset rounded-lg">
          <div className="flex gap-3 border-b border-[var(--line-subtle)] px-3 py-2 text-[13px]">
            <span className="k-label w-12 shrink-0 pt-0.5">To</span>
            <span className="k-fg2">
              {[mail.recipient.firstName, mail.recipient.lastName].join(" ")}, {mail.recipient.title} at {mail.recipient.companyName}
            </span>
          </div>
          <div className="flex gap-3 border-b border-[var(--line-subtle)] px-3 py-2 text-[13px]">
            <span className="k-label w-12 shrink-0 pt-0.5">Subject</span>
            <span className="k-fg font-medium">{mail.subject}</span>
          </div>
          <p className="k-fg2 whitespace-pre-line px-3 py-3 text-[13px] leading-6">{mail.bodyText}</p>
        </div>
      )}
    </StepCard>
  );
}

function NotLiveCard({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <StepCard index={index} title={title} meta={<StateWord state="notLive" />}>
      <p className="k-fg3 text-[13px] leading-5">{body}</p>
    </StepCard>
  );
}

