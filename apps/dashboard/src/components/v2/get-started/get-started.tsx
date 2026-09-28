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
  checkNextAudienceEmail,
  extractBrandFields,
  getAudienceEmailChecks,
  getAudiencePreview,
  getPublicCatalogueSignedOut,
  getWorkflowProjectionLadder,
  listBrandOffers,
  previewColdEmail,
  suggestAudiences,
  suggestBrandIcp,
  upsertBrand,
  type AudienceEmailChecks,
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
  NEXT_STEPS,
  STEPS_NOT_LIVE,
  emailCheckNote,
  emailPieces,
  highlightKindLabel,
  hostOf,
  parseCompetitors,
  providerLabel,
  shouldCheckNext,
  verdictLabel,
  parseGetStartedSnapshot,
  segmentCriteria,
  settledPhase,
  stageMove,
  valueLines,
  valueText,
  websiteUrl,
  type Competitor,
  type GetStartedEmail,
  type GetStartedSegment,
  type GetStartedSnapshot,
  type GetStartedStepKey,
  type StepPhase,
} from "@/lib/v2/get-started";
import { Initials, Shimmer } from "@/components/v2/ui";
import { CountUp, Typewriter, formatElapsed, stagger, useElapsed } from "./motion";
import { BrandLogo } from "@/components/brand-logo";
import { GET_STARTED_LEG } from "./launch";
import { AccountCardWall } from "./account-card-wall";
import { JournalRail, JournalStrip, type JournalData } from "./journal";
import { SegmentCard } from "./segment-card";
import { stepViewName, withStageTransition } from "./view-transition";

type StepState = StepPhase;

/**
 * How long a finished step stays on the stage before it flies into the rail. The
 * segments are the richest result and the one to pick from, so they hold longer.
 */
const STAGE_DWELL_MS: Partial<Record<GetStartedStepKey, number>> = { segments: 5000 };
const DEFAULT_DWELL_MS = 1600;

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
  // Step 5, live: each sampled person's email, found and verified one by one.
  const [checks, setChecks] = useState<Record<string, AudienceEmailChecks>>({});
  const [checkingIdx, setCheckingIdx] = useState<Record<string, number | null>>({});
  const [checkNotes, setCheckNotes] = useState<Record<string, string>>({});
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());
  const [restoredBudget, setRestoredBudget] = useState<number | null>(null);
  // The stage shows ONE step: the one the walk is on (`stageIdx`), or one the person
  // opened from the rail or the stepper (`focus`, cleared when the walk moves on).
  const [stageIdx, setStageIdx] = useState(0);
  const [focus, setFocus] = useState<GetStartedStepKey | null>(null);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedSeg;

  // Every signed-out read after the first ones runs through ONE queue: each metered call
  // holds its worst case against the anonymous seed, so two at once can be refused for
  // credit neither will spend. A segment picked while an email is being written waits.
  const readQueue = useRef<Promise<void>>(Promise.resolve());
  const enqueue = (task: () => Promise<void>) => {
    readQueue.current = readQueue.current.then(task).catch((e) => console.error("[get-started] queued read failed:", e));
  };
  // The email written before a Google round trip, so the wall can show it again.
  const [restoredEmail, setRestoredEmail] = useState<GetStartedEmail | null>(null);

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
    setStageIdx(s.segments.length ? 2 : 0);
    if (s.email) setRestoredEmail(s.email);
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
    enqueue(async () => {
      // Picked away while it waited in the queue: read what is picked now instead.
      if (selectedRef.current !== id) {
        inFlight.current.delete(`p:${id}`);
        return;
      }
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
      if (selectedRef.current !== id) return;
      const ok = got?.status === "ready";
      setSteps((cur) => ({
        ...cur,
        companies: ok && got!.companies.length ? "done" : "failed",
        // Stays running while the sampled people's emails are found and verified.
        people: ok && got!.people.length ? "running" : "failed",
        email: ok && got!.people.length ? cur.email : STEPS_NOT_LIVE.has("email") ? cur.email : "failed",
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeg, previews]);

  // Step 5, live: the sampled people's emails, found and verified ONE person per call
  // (a billed reveal on this session's org, ~6s each) until human-service says done.
  // Queued like every other read; a segment picked meanwhile stops the loop, and
  // picking this one again resumes it where the producer left off.
  useEffect(() => {
    if (!selectedSeg) return;
    const prev = previews[selectedSeg];
    if (prev?.status !== "ready" || !prev.people.length) return;
    const known = checks[selectedSeg];
    if ((known && (known.done || known.status !== "ready")) || checkNotes[selectedSeg] || inFlight.current.has(`c:${selectedSeg}`)) return;
    const id = selectedSeg;
    inFlight.current.add(`c:${id}`);
    setStep("people", "running");
    enqueue(async () => {
      try {
        if (selectedRef.current !== id) return;
        let state = await getAudienceEmailChecks(id);
        setChecks((cur) => ({ ...cur, [id]: state }));
        let calls = 0;
        while (shouldCheckNext(state, calls) && selectedRef.current === id) {
          const next = state.people.find((x) => x.status === "pending") ?? null;
          setCheckingIdx((cur) => ({ ...cur, [id]: next?.index ?? null }));
          state = await checkNextAudienceEmail(id);
          calls += 1;
          setChecks((cur) => ({ ...cur, [id]: state }));
        }
        if (selectedRef.current !== id) return;
        if (!state.done && state.status === "ready") {
          console.error("[get-started] email checks did not settle", { audienceId: id, calls, summary: state.summary });
          setCheckNotes((cur) => ({ ...cur, [id]: "Some emails could not be checked." }));
        }
        setStep("people", "done");
      } catch (e) {
        console.error("[get-started] email check failed:", e);
        setCheckNotes((cur) => ({
          ...cur,
          [id]:
            e instanceof ApiError && e.status === 402
              ? "Your free preview credit is used up, so we stopped checking emails."
              : "We could not check the emails just now.",
        }));
        if (selectedRef.current === id) setStep("people", "done");
      } finally {
        setCheckingIdx((cur) => ({ ...cur, [id]: null }));
        inFlight.current.delete(`c:${id}`);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeg, previews, checks, checkNotes]);

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
    enqueue(async () => {
      if (selectedRef.current !== id) {
        inFlight.current.delete(`e:${id}`);
        return;
      }
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
        if (selectedRef.current === id) setStep("email", "done");
        const snap = parseGetStartedSnapshot(sessionStorage.getItem(GET_STARTED_SNAPSHOT_KEY));
        if (snap) saveSnapshot({ ...snap, email: { subject: mail.subject, bodyText: mail.bodyText, recipient: mail.recipient } });
      } catch (e) {
        console.error("[get-started] email preview failed:", e);
        if (selectedRef.current !== id) return;
        setEmailNote(
          e instanceof ApiError && e.status === 402
            ? "Your free preview credit is used up, so we stopped before writing the email. It will be written once your account is set up."
            : "We could not write the email just now.",
        );
        setStep("email", "failed");
      } finally {
        inFlight.current.delete(`e:${id}`);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeg, previews, emails, brandId, offerId, segments]);

  // The stage walks forward on its own: a finished step is held for a moment, then
  // flies into the rail as the next one takes the stage.
  const phases = GET_STARTED_STEPS.map((s) => steps[s.key]);
  const phaseKey = phases.join(",");
  useEffect(() => {
    const mv = stageMove(phases, stageIdx);
    if (!mv) return;
    const t = setTimeout(
      () =>
        withStageTransition(() => {
          setStageIdx(mv.to);
          setFocus(null);
        }),
      mv.dwell ? (STAGE_DWELL_MS[GET_STARTED_STEPS[stageIdx].key] ?? DEFAULT_DWELL_MS) : 0,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey, stageIdx]);

  /** Opens a finished step on the stage; the walk takes over again when it moves on. */
  function openStep(key: GetStartedStepKey) {
    const idx = GET_STARTED_STEPS.findIndex((s) => s.key === key);
    withStageTransition(() => setFocus(idx === stageIdx ? null : key));
  }

  /**
   * Picks a segment: its sample (steps 4 to 6) takes the stage. A segment read before
   * shows what was read; a new one is queued behind whatever read is running.
   */
  function selectSegment(id: string) {
    const prev = previews[id];
    const mail = emails[id];
    const ready = prev?.status === "ready";
    withStageTransition(() => {
      setSelectedSeg(id);
      setFocus(null);
      setStageIdx(3);
      if (prev) {
        setSteps((cur) => ({
          ...cur,
          companies: ready && prev.companies.length ? "done" : "failed",
          people: !ready || !prev.people.length ? "failed" : checksSettled(checks[id]) || checkNotes[id] ? "done" : "running",
          email: mail ? "done" : STEPS_NOT_LIVE.has("email") ? cur.email : ready && prev.people.length ? "running" : "failed",
        }));
      } else {
        markSampleSteps("running");
      }
    });
    posthog.capture("get_started_segment_selected");
  }

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
        .map((c) => ({ audienceId: c.audienceId, name: c.name, rationale: c.rationale, count: c.count, criteria: segmentCriteria(c.filters) }));
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
    // Queued, so the first sample read (picked above) waits behind it.
    enqueue(async () => {
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
    });
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

  const stagedKey: GetStartedStepKey = focus ?? GET_STARTED_STEPS[stageIdx].key;
  const selectedSegment = segments.find((x) => x.audienceId === selectedSeg) ?? null;
  const journal: JournalData = {
    steps,
    staged: stagedKey,
    name: brandName,
    domain,
    overview,
    competitors,
    segments,
    selected: selectedSeg,
    preview: selectedSeg ? previews[selectedSeg] : undefined,
    mail: selectedSeg ? emails[selectedSeg] : undefined,
    onSelect: selectSegment,
    onFocus: openStep,
  };

  function stageFor(key: GetStartedStepKey): React.ReactNode {
    if (key === "company") return <CompanyCard state={steps.company} name={brandName} domain={domain} website={website} overview={overview} facts={facts} />;
    if (key === "competitors") return <CompetitorsCard state={steps.competitors} competitors={competitors} />;
    if (key === "segments") return <SegmentsStage state={steps.segments} segments={segments} selected={selectedSeg} previews={previews} onSelect={selectSegment} />;
    if (key === "companies")
      return STEPS_NOT_LIVE.has("companies") ? (
        <NotLiveCard index={4} title="Companies that match" body="Real companies for each segment will be listed here. This step is not live yet." />
      ) : (
        <CompaniesCard state={steps.companies} preview={selectedSeg ? previews[selectedSeg] : undefined} segmentName={selectedSegment?.name ?? null} />
      );
    if (key === "people")
      return STEPS_NOT_LIVE.has("people") ? (
        <NotLiveCard index={5} title="Decision makers" body="The people we would write to at those companies, by name and role, will be listed here. This step is not live yet." />
      ) : (
        <PeopleCard
          state={steps.people}
          preview={selectedSeg ? previews[selectedSeg] : undefined}
          checks={selectedSeg ? checks[selectedSeg] : undefined}
          checkingIdx={selectedSeg ? checkingIdx[selectedSeg] ?? null : null}
          checkNote={selectedSeg ? checkNotes[selectedSeg] ?? null : null}
        />
      );
    return STEPS_NOT_LIVE.has("email") ? (
      <NotLiveCard index={6} title="Your first email" body="One email written for one of those people will appear here, ready to send. This step is not live yet." />
    ) : (
      <EmailCard state={steps.email} mail={selectedSeg ? emails[selectedSeg] : undefined} note={emailNote} />
    );
  }

  return (
    <div className="k-canvas min-h-[100dvh] lg:flex lg:h-[100dvh] lg:flex-col">
      {canLaunch && (
        <div className="gs-down sticky top-0 z-20 border-b border-[var(--line-subtle)] bg-[var(--bg-raised)] lg:static">
          <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
            <span className="gs-pop hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[16px]" style={{ animationDelay: "200ms" }} aria-hidden="true">
              $
            </span>
            <div className="min-w-0 flex-1">
              <p className="k-fg text-[14px] font-medium">
                <CountUp value={30} format={(n) => `$${Math.round(n)}`} ms={700} /> of free credit to start
              </p>
              <p className="k-fg3 hidden text-[12px] sm:block">No charge today. We write and send the emails, you get the replies.</p>
            </div>
            <button type="button" className="k-btn-accent gs-glow h-8 px-3" onClick={() => setWallOpen(true)}>
              Start outreach
            </button>
          </div>
        </div>
      )}

      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[296px_minmax(0,1fr)]">
        <JournalRail {...journal} />
        <main className="k-scroll lg:min-h-0 lg:overflow-y-auto">
          <div className="mx-auto max-w-[920px] px-4 py-6 sm:px-6 sm:py-8">
            <Stepper steps={steps} staged={stagedKey} onOpen={openStep} nextLit={steps.email === "done"} />
            <LiveStatus current={current} domain={domain} />
            <div className="mt-4">
              <JournalStrip {...journal} />
            </div>

            {focus && (
              <div className="gs-in mt-4 flex items-center gap-2 text-[12px]">
                <span className="k-fg3">You are looking back at a finished step.</span>
                <button type="button" className="k-btn-ghost h-6 px-2" onClick={() => withStageTransition(() => setFocus(null))}>
                  Back to the live step
                </button>
              </div>
            )}

            <div key={stagedKey} className="gs-in mt-4" style={{ viewTransitionName: stepViewName(stagedKey) }}>
              {stageFor(stagedKey)}
            </div>

            {canLaunch && stagedKey === "email" && (
              <div className="gs-in mt-6 flex justify-end" style={{ animationDelay: "200ms" }}>
                <button type="button" className="k-btn-accent h-9 px-4" onClick={() => setWallOpen(true)}>
                  Start outreach with $30 free
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {wallOpen && brandId && (
        <AccountCardWall
          brandId={brandId}
          website={websiteUrl(website)}
          brandName={brandName ?? domain ?? website}
          offerSource={overview}
          segments={segments}
          email={(selectedSeg ? emails[selectedSeg] : undefined) ?? restoredEmail}
          floorUsd={floorUsd}
          recommendedUsd={restoredBudget ?? recommendedUsd}
          budgetChosen={restoredBudget != null}
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
        <p className="k-label gs-in">distribute.you</p>
        <h1 className="gs-in k-fg mt-3 text-[28px] font-medium leading-9 tracking-[-0.01em]" style={{ animationDelay: "60ms" }}>
          See who we would sell to for you.
        </h1>
        <p className="gs-in k-fg2 mt-2 text-[14px] leading-6" style={{ animationDelay: "120ms" }}>
          Type your website. In about a minute we read your company, find your competitors and size the segments worth writing to. No account needed.
        </p>
        <form
          className="gs-in k-card mt-6 flex items-center gap-2 p-2"
          style={{ animationDelay: "180ms" }}
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
        <ol className="gs-in mt-5 grid grid-cols-3 gap-2" style={{ animationDelay: "240ms" }} aria-label="What you will see">
          {["Your company", "Your segments", "Your first email"].map((label, i) => (
            <li key={label} className="k-fg3 flex items-center gap-2 text-[12px]">
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] text-[10px] tabular-nums">{i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        {error && (
          <p className="gs-in mt-3 text-[13px] text-[var(--data-rose)]" role="alert">
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

const settled = settledPhase;

/**
 * Explee's stepper: numbered marks joined by rails that fill as each step lands, the
 * step on the stage named in a raised pill, then "what happens next": the three steps
 * the account turns on, drawn dotted until the preview's email is written, then lit.
 * A finished step's mark opens it on the stage.
 */
function Stepper({
  steps,
  staged,
  onOpen,
  nextLit,
}: {
  steps: Record<GetStartedStepKey, StepState>;
  staged: GetStartedStepKey;
  onOpen: (key: GetStartedStepKey) => void;
  nextLit: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:gap-5">
      <ol className="flex min-w-0 flex-1 items-center" aria-label="Progress">
        {GET_STARTED_STEPS.map((s, i) => {
          const st = steps[s.key];
          const active = s.key === staged;
          const prevSettled = i > 0 && settled(steps[GET_STARTED_STEPS[i - 1].key]);
          const openable = settled(st) && !active;
          const mark = (
            <>
              <StepMark index={i + 1} state={st} />
              {active ? <span key={s.key} className="gs-in whitespace-nowrap">{s.label}</span> : <span className="sr-only">{s.label}</span>}
            </>
          );
          const cls = `inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full text-[12px] ${
            active ? "k-card gs-glow k-fg px-2.5 font-medium" : settled(st) ? "k-fg2" : "k-fg3"
          }`;
          return (
            <li key={s.key} className={`flex items-center ${i > 0 ? "flex-1" : ""}`} aria-current={active ? "step" : undefined}>
              {i > 0 && (
                <span className="relative mx-1.5 h-px min-w-2 flex-1 overflow-hidden bg-[var(--line)] sm:mx-2" aria-hidden="true">
                  <span className="gs-fill absolute inset-y-0 left-0 bg-[var(--bg-strong)]" style={{ width: prevSettled ? "100%" : "0%" }} />
                </span>
              )}
              {openable ? (
                <button type="button" className={`${cls} k-hover`} onClick={() => onOpen(s.key)} title={`Open: ${s.label}`}>
                  {mark}
                </button>
              ) : (
                <span className={cls}>{mark}</span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="shrink-0" aria-label="What happens next">
        <p className="k-label mb-1.5 xl:text-center">What happens next</p>
        <ol className="flex flex-wrap items-start gap-x-4 gap-y-1.5">
          {NEXT_STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-1.5 xl:flex-col xl:gap-1" style={nextLit ? stagger(i, 160) : undefined}>
              <span
                key={nextLit ? "lit" : "ghost"}
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums ${
                  nextLit ? "gs-pop border border-[var(--fg-2)] text-[var(--fg-1)]" : "border border-dashed border-[var(--line-strong)] text-[var(--fg-4)]"
                }`}
                style={nextLit ? stagger(i, 160) : undefined}
              >
                {GET_STARTED_STEPS.length + i + 1}
              </span>
              <span className={`whitespace-nowrap text-[11.5px] ${nextLit ? "k-fg2" : "k-fg4"}`}>{label}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function StepMark({ index, state }: { index: number; state: StepState }) {
  if (state === "running")
    return (
      <span key="running" className="gs-pop relative inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--run)] text-[10px] tabular-nums text-[var(--run)]" aria-label="Running">
        {index}
        <span className="k-dot-pulse absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" aria-hidden="true" />
      </span>
    );
  if (state === "done")
    return (
      <span key="done" className="gs-pop inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-strong)] text-[10px] text-white tabular-nums">
        {index}
      </span>
    );
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--line-strong)] text-[10px] tabular-nums">{index}</span>
  );
}

const STATUS: Record<GetStartedStepKey, (domain: string | null) => string> = {
  company: (d) => `Reading ${d ?? "your site"} and finding your competitors`,
  competitors: () => "Finding your competitors",
  segments: () => "Sizing the segments worth writing to",
  companies: () => "Taking a free sample of real companies in this segment",
  people: () => "Finding the decision makers at those companies",
  email: () => "Writing your first email. This one takes about a minute and a half.",
};

/** What is being worked on right now, and for how long. Every line names a real step. */
function LiveStatus({ current, domain }: { current: number; domain: string | null }) {
  const key = current >= 0 ? GET_STARTED_STEPS[current].key : null;
  const secs = useElapsed(key);
  return (
    <p key={key ?? "ready"} className="gs-in mt-4 flex min-h-5 items-center gap-2 text-[13px]">
      {key ? (
        <span className="k-dot-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--run)] text-[var(--run)]" />
      ) : (
        <span className="gs-pop h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--data-teal)]" />
      )}
      <span className="k-fg2 min-w-0" aria-live="polite">
        {key ? STATUS[key](domain) : "Your preview is ready."}
      </span>
      {key && (
        <span className="k-mono k-fg3 text-[12px] tabular-nums" aria-hidden="true">
          {formatElapsed(secs)}
        </span>
      )}
    </p>
  );
}

function StepCard({
  index,
  title,
  state,
  meta,
  children,
}: {
  index: number;
  title: string;
  state: StepState;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`gs-fade k-card relative overflow-hidden p-4 ${state === "waiting" ? "translate-y-0.5 opacity-50" : "opacity-100"}`}>
      {state === "running" && (
        <span className="absolute inset-x-0 top-0 h-0.5 overflow-hidden" aria-hidden="true">
          <span className="k-indeterminate block h-full w-1/3 rounded-full bg-[var(--accent)]" />
        </span>
      )}
      <div className="flex items-center gap-2">
        <span className="k-label">{`Step ${index}`}</span>
        <h2 className="k-fg min-w-0 truncate text-[14px] font-medium">{title}</h2>
        {meta && <span className="ml-auto shrink-0">{meta}</span>}
      </div>
      {/* Keyed on the state so the content rises in the moment it lands. */}
      <div key={state} className="gs-in mt-3">
        {children}
      </div>
    </section>
  );
}

function StateWord({ state, doneLabel }: { state: StepState; doneLabel?: React.ReactNode }) {
  if (state === "running")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
        <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" />
        Working
      </span>
    );
  if (state === "done")
    return (
      <span key="done" className="gs-pop k-fg3 inline-flex items-center gap-1.5 text-[12px] tabular-nums">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-teal)]" />
        {doneLabel ?? "Done"}
      </span>
    );
  if (state === "failed") return <span className="text-[12px] text-[var(--data-amber)]">Nothing found</span>;
  if (state === "notLive") return <span className="k-chip">Not live yet</span>;
  return <span className="k-fg4 text-[12px]">Waiting</span>;
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
    <StepCard index={1} title="Your company" state={state} meta={<StateWord state={state} />}>
      <div className="flex items-center gap-3">
        <span className="gs-pop inline-flex">
          <BrandLogo domain={domain} size={28} className="rounded-md" />
        </span>
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
              {facts.map((f, i) => (
                <p key={f} className="gs-in k-fg2 flex gap-2 text-[12px] leading-5" style={stagger(i + 1, 90)}>
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
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
    <StepCard
      index={2}
      title="Competitors"
      state={state}
      meta={<StateWord state={state} doneLabel={<><CountUp value={competitors.length} format={(n) => String(Math.round(n))} ms={600} /> found</>} />}
    >
      {state === "running" || state === "waiting" ? (
        <Rows n={3} />
      ) : competitors.length === 0 ? (
        <p className="k-fg3 text-[13px]">We found no direct competitor on your site. This does not change what we send.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-1.5 lg:grid-cols-3">
          {competitors.map((c, i) => (
            <li key={c.domain ?? c.name} className="gs-pop k-inset flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5" style={stagger(i, 60)}>
              <BrandLogo domain={c.domain} size={16} className="rounded-sm" />
              <span className="k-fg2 truncate text-[13px]">{c.domain ?? c.name}</span>
            </li>
          ))}
        </ul>
      )}
    </StepCard>
  );
}

/** Step 3 on the stage: every segment as a card with its size ring; picking one samples it. */
function SegmentsStage({
  state,
  segments,
  selected,
  previews,
  onSelect,
}: {
  state: StepState;
  segments: GetStartedSegment[];
  selected: string | null;
  previews: Record<string, AudiencePreview>;
  onSelect: (id: string) => void;
}) {
  const max = Math.max(1, ...segments.map((s) => s.count));
  const total = segments.reduce((n, s) => n + s.count, 0);
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2">
        <span className="k-label">Step 3</span>
        <h2 className="k-fg min-w-0 truncate text-[14px] font-medium">Segments to write to</h2>
        <span className="ml-auto shrink-0">
          <StateWord state={state} doneLabel={segments.length === 1 ? "1 segment" : `${segments.length} segments`} />
        </span>
      </div>
      {state === "running" || state === "waiting" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="k-card p-4">
              <Rows n={4} />
            </div>
          ))}
        </div>
      ) : segments.length === 0 ? (
        <div className="k-card p-4">
          <p className="k-fg3 text-[13px]">We could not size a segment for your company. Try again in a moment.</p>
        </div>
      ) : (
        <>
          <p className="k-fg2 text-[13px]">
            <CountUp value={total} format={(n) => Math.round(n).toLocaleString("en-US")} ms={1100} /> people across your segments. Pick one to see who is in it.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {segments.map((s, i) => (
              <SegmentCard key={s.audienceId} segment={s} index={i} max={max} selected={selected === s.audienceId} preview={previews[s.audienceId]} onSelect={() => onSelect(s.audienceId)} />
            ))}
          </div>
        </>
      )}
    </section>
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
  const matches = preview?.status === "ready" ? preview.matchCount : null;
  return (
    <StepCard
      index={4}
      title={segmentName ? `Companies in ${segmentName}` : "Companies that match"}
      state={state}
      meta={<StateWord state={state} doneLabel={`${companies.length} shown`} />}
    >
      {state === "running" || state === "waiting" ? (
        <Rows n={4} />
      ) : companies.length === 0 ? (
        <p className="k-fg3 text-[13px]">{sampleNote(preview)}</p>
      ) : (
        <>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {companies.map((c, i) => (
              <li key={c.name} className="gs-in k-inset flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5" style={stagger(i, 45)}>
                <Initials name={c.name} size={20} />
                <span className="k-fg min-w-0 flex-1 truncate text-[13px]">{c.name}</span>
                {c.peopleInSample > 0 && (
                  <span className="k-fg3 shrink-0 text-[11px] tabular-nums">{c.peopleInSample === 1 ? "1 person" : `${c.peopleInSample} people`}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="k-fg3 mt-2 text-[12px]">
            {matches != null && matches > companies.length ? (
              <>
                A first page of real matches, out of <CountUp value={matches} format={(n) => Math.round(n).toLocaleString("en-US")} ms={1100} /> people in this segment.
              </>
            ) : (
              "A first page of real matches, not the whole list."
            )}
          </p>
        </>
      )}
    </StepCard>
  );
}

function checksSettled(c: AudienceEmailChecks | undefined): boolean {
  return !!c && (c.done || c.status !== "ready");
}

export function PeopleCard({
  state,
  preview,
  checks,
  checkingIdx,
  checkNote,
}: {
  state: StepState;
  preview: AudiencePreview | undefined;
  checks: AudienceEmailChecks | undefined;
  checkingIdx: number | null;
  checkNote: string | null;
}) {
  const people = preview?.status === "ready" ? preview.people : [];
  return (
    <StepCard index={5} title="Decision makers" state={state} meta={<StateWord state={state} doneLabel={`${people.length} shown`} />}>
      {people.length > 0 && <EmailChecks checks={checks} checkingIdx={checkingIdx} note={checkNote} running={state === "running"} />}
      {(state === "running" || state === "waiting") && people.length === 0 ? (
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
              {people.map((x, i) => {
                const name = [x.firstName, x.lastNameObfuscated].filter(Boolean).join(" ");
                return (
                  <tr key={`${x.firstName}-${x.company}-${i}`} className="gs-in k-row border-b border-[var(--line-subtle)] last:border-0" style={stagger(i, 50)}>
                    <td className="k-fg px-2 py-2">
                      <span className="flex items-center gap-2">
                        {name ? <Initials name={name} size={20} round /> : null}
                        {name || <span className="k-fg4">{"—"}</span>}
                      </span>
                    </td>
                    <td className="k-fg2 px-2 py-2">{x.title ?? <span className="k-fg4">{"—"}</span>}</td>
                    <td className="k-fg2 px-2 py-2">{x.company ?? <span className="k-fg4">{"—"}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="k-fg3 mt-2 text-[12px]">Last names are masked until your account is set up. We never show an email address here, only its domain.</p>
        </div>
      )}
    </StepCard>
  );
}

/**
 * The sampled people's emails, found and verified live. Every state drawn is one
 * human-service returned (or the one reveal running right now); the address itself
 * never reaches the page, only its masked domain.
 */
function EmailChecks({
  checks,
  checkingIdx,
  note,
  running,
}: {
  checks: AudienceEmailChecks | undefined;
  checkingIdx: number | null;
  note: string | null;
  running: boolean;
}) {
  const list = checks?.status === "ready" ? checks.people : [];
  const sum = checks?.summary;
  return (
    <div className="k-inset mb-3 rounded-lg px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="k-fg text-[13px] font-medium">Emails, found and verified live</p>
        {sum && sum.checked > 0 && (
          <p className="k-fg3 text-[12px] tabular-nums">
            {sum.found} of {sum.checked} found, {sum.deliverable} deliverable
          </p>
        )}
      </div>
      {!checks ? (
        note ? (
          <p className="k-fg3 mt-1.5 text-[12px]">{note}</p>
        ) : (
          <div className="mt-2">
            <Rows n={3} />
          </div>
        )
      ) : checks.status !== "ready" ? (
        <p className="k-fg3 mt-1.5 text-[12px]">{emailCheckNote(checks.reason)}</p>
      ) : (
        <ul className="mt-2 grid gap-1.5">
          {list.map((x) => {
            const name = [x.firstName, x.lastNameObfuscated].filter(Boolean).join(" ") || "\u2014";
            const checking = x.status === "checking" || (running && checkingIdx === x.index && x.status === "pending");
            return (
              <li key={x.index} className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3" data-check-status={checking ? "checking" : x.status}>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Initials name={name} size={20} round />
                  <span className="min-w-0 truncate text-[13px]">
                    <span className="k-fg">{name}</span>
                    {x.company && <span className="k-fg3">, {x.company}</span>}
                  </span>
                </span>
                <EmailCheckCell person={x} checking={checking} />
              </li>
            );
          })}
        </ul>
      )}
      {checks && note && <p className="k-fg3 mt-1.5 text-[12px]">{note}</p>}
    </div>
  );
}

function EmailCheckCell({ person, checking }: { person: AudienceEmailChecks["people"][number]; checking: boolean }) {
  const finder = providerLabel(person.finder);
  const verifier = providerLabel(person.verifier);
  if (checking)
    return (
      <span className="k-fg2 flex shrink-0 items-center gap-1.5 pl-7 text-[12px] sm:pl-0">
        <span aria-hidden className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
        Finding and verifying
      </span>
    );
  if (person.status === "found")
    return (
      <span className="gs-pop flex shrink-0 flex-col pl-7 text-[12px] sm:items-end sm:pl-0">
        <span className="k-fg font-mono">{person.maskedEmail ?? "\u2014"}</span>
        <span className="k-fg3">
          {finder ? `Found via ${finder}` : "Found"}
          {verifier && `, verified by ${verifier}: `}
          {verifier && (
            <span style={{ color: person.deliverable ? "var(--run)" : "var(--data-amber)" }}>{verdictLabel(person.verdict) ?? "no verdict"}</span>
          )}
        </span>
      </span>
    );
  if (person.status === "not_found")
    return <span className="gs-in k-fg3 shrink-0 pl-7 text-[12px] sm:pl-0">{finder ? `Not found via ${finder}` : "Not found"}</span>;
  return <span className="k-fg4 shrink-0 pl-7 text-[12px] sm:pl-0">Waiting</span>;
}

const KIND_COLOR: Record<string, string> = {
  prospect: "var(--data-sky)",
  brand: "var(--accent)",
  audience: "var(--data-violet)",
  instruction: "var(--data-amber)",
};

/**
 * The written email with each explained sentence marked. Hovering (mouse), focusing or
 * tapping a sentence shows why it was written and from what input, in a panel under
 * the body, so it reads the same on a phone as on a desktop. Every reason is the one
 * the writing model reported and content-generation checked.
 */
function ExplainedBody({ mail }: { mail: PreviewEmail }) {
  const pieces = useMemo(() => emailPieces(mail.bodyText, mail.highlights), [mail.bodyText, mail.highlights]);
  const [active, setActive] = useState<number | null>(null);
  const shown = active != null ? pieces[active]?.highlight ?? null : null;
  return (
    <div className="gs-in">
      <p className="k-fg2 whitespace-pre-line px-3 py-3 text-[13px] leading-6">
        {pieces.map((p, i) =>
          p.highlight ? (
            <span
              key={i}
              role="button"
              tabIndex={0}
              aria-pressed={active === i}
              aria-label={`${p.text} Why: ${p.highlight.reason}`}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") setActive(i);
              }}
              onFocus={() => setActive(i)}
              // A tap focuses THEN clicks, so a toggle here would close what focus just
              // opened. Click opens; another sentence replaces it.
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActive((cur) => (cur === i ? null : i));
                }
              }}
              className="cursor-pointer rounded-[3px] outline-none transition-colors"
              style={{
                textDecorationLine: "underline",
                textDecorationStyle: "dotted",
                textDecorationColor: KIND_COLOR[p.highlight.kind] ?? "var(--fg-3)",
                textUnderlineOffset: 3,
                background: active === i ? `color-mix(in oklab, ${KIND_COLOR[p.highlight.kind] ?? "var(--fg-3)"} 16%, transparent)` : undefined,
              }}
            >
              {p.text}
            </span>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </p>
      <div className="border-t border-[var(--line-subtle)] px-3 py-2.5" aria-live="polite">
        {shown ? (
          <div key={active} className="gs-in text-[12px] leading-5">
            <p className="flex flex-wrap items-center gap-x-2">
              <span className="font-medium" style={{ color: KIND_COLOR[shown.kind] ?? "var(--fg-2)" }}>
                {highlightKindLabel(shown.kind)}
              </span>
              <span className="k-fg3">{shown.sourceLabel}</span>
            </p>
            <p className="k-fg mt-0.5">{shown.reason}</p>
            {shown.sourceValue && <p className="k-fg3 mt-0.5 line-clamp-3">Source: {shown.sourceValue}</p>}
          </div>
        ) : (
          <p className="k-fg3 text-[12px]">Hover or tap an underlined sentence to see why it was written, and from what.</p>
        )}
      </div>
    </div>
  );
}

function EmailBody({ mail }: { mail: PreviewEmail }) {
  const explained = (mail.highlights?.length ?? 0) > 0;
  const [typed, setTyped] = useState(false);
  useEffect(() => setTyped(false), [mail.id]);
  if (explained && typed) return <ExplainedBody mail={mail} />;
  return <Typewriter text={mail.bodyText} className="k-fg2 whitespace-pre-line px-3 py-3 text-[13px] leading-6" onDone={explained ? () => setTyped(true) : undefined} />;
}

export function EmailCard({ state, mail, note }: { state: StepState; mail: PreviewEmail | undefined; note: string | null }) {
  return (
    <StepCard index={6} title="Your first email" state={state} meta={<StateWord state={state} />}>
      {state === "running" || state === "waiting" ? (
        <>
          <p className="k-fg3 mb-3 text-[12px]">We read your site the way a campaign does, then write. The first email takes about a minute and a half.</p>
          <Rows n={6} />
        </>
      ) : !mail ? (
        <p className="k-fg3 text-[13px]">{note ?? "We need at least one person in the sample to write to."}</p>
      ) : (
        <div className="k-inset rounded-lg">
          <div className="gs-in flex gap-3 border-b border-[var(--line-subtle)] px-3 py-2 text-[13px]">
            <span className="k-label w-12 shrink-0 pt-0.5">To</span>
            <span className="k-fg2">
              {[mail.recipient.firstName, mail.recipient.lastName].join(" ")}, {mail.recipient.title} at {mail.recipient.companyName}
            </span>
          </div>
          <div className="gs-in flex gap-3 border-b border-[var(--line-subtle)] px-3 py-2 text-[13px]" style={{ animationDelay: "120ms" }}>
            <span className="k-label w-12 shrink-0 pt-0.5">Subject</span>
            <span className="k-fg font-medium">{mail.subject}</span>
          </div>
          <EmailBody mail={mail} />
        </div>
      )}
    </StepCard>
  );
}

function NotLiveCard({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <StepCard index={index} title={title} state="notLive" meta={<StateWord state="notLive" />}>
      <p className="k-fg3 text-[13px] leading-5">{body}</p>
    </StepCard>
  );
}
