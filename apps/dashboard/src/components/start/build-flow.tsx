"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StartShell, StartButton } from "./start-shell";
import { upsertBrand, saveBrandFunnelBudget } from "@/lib/api";
import {
  channelsForOutcomes,
  funnelsForChannels,
  type CatalogueChannel,
  type CatalogueFunnelDef,
} from "@/lib/start-catalogue";
import { budgetWrites, totalDailyCents, planIsRunnable } from "@/lib/build-plan";
import { websiteInputProblem } from "@/lib/website-input";
import { readLandingUrlCookie } from "@/lib/landing-url-cookie";
import {
  decodeStartSelection,
  clearStartSelectionCookieAssignment,
  START_SELECTION_COOKIE,
  selectionIsPaid,
  type StartSelection,
} from "@/lib/start-selection-cookie";

/**
 * THE BRAND, BUILT AFTER THE MONEY IS IN.
 *
 * The visitor has paid for one or more revenue funnels; nothing is attached to a
 * brand yet, because there was no brand when they paid. This asks for their
 * website, creates the brand, and writes the daily budget of every funnel they
 * paid for -- one row per channel, which is how billing keys it.
 *
 * WHY THE WEBSITE COMES LAST. It is not an ordering preference: it is what makes
 * the flow sell first and sign up second. Everything before this point is
 * catalogue, price and proof, which is what somebody deciding whether to buy
 * actually wants; the website is what WE need to do the work, so it is asked for
 * once they have decided.
 */

const dollars = (cents: number): string =>
  `$${Math.round(cents / 100).toLocaleString("en-US")}`;

export function BuildFlow() {
  const router = useRouter();
  const [selection, setSelection] = useState<StartSelection | null>(null);
  const [channels, setChannels] = useState<CatalogueChannel[] | null>(null);
  // The producer's own funnel list; the funnel filter reads its entry steps.
  const [wireFunnels, setWireFunnels] = useState<CatalogueFunnelDef[]>([]);
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${START_SELECTION_COOKIE}=`))
      ?.slice(START_SELECTION_COOKIE.length + 1);
    setSelection(decodeStartSelection(raw));

    // The hero on the landing has a website field, and somebody who typed into
    // it has already told us their site -- asking again on the last screen of a
    // flow they have just paid for reads as us not having listened. The value
    // rides the same cookie `?url=` has always used, because a query param does
    // not survive the Clerk redirect. Absent is the ordinary case (most CTAs are
    // a plain link), and then the field simply starts empty.
    const fromLanding = readLandingUrlCookie(document.cookie);
    if (fromLanding) setUrl(fromLanding);
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/api/public/catalogue")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => {
        if (!live) return;
        setChannels(body?.channels?.channels ?? body?.channels ?? []);
        setWireFunnels(body?.channels?.funnels ?? []);
      })
      .catch((err) => console.error("[build] catalogue read failed:", err));
    return () => {
      live = false;
    };
  }, []);

  const writes = useMemo(() => {
    if (!channels || !selection) return [];
    const kept = channelsForOutcomes(channels, selection.outcomes).filter((c) =>
      selection.channels.includes(c.slug),
    );
    const byFunnel = funnelsForChannels(kept, selection.outcomes, wireFunnels).map((f) => ({
      key: f.key,
      channels: f.channelSlugs.map((slug) => {
        const c = kept.find((x) => x.slug === slug);
        return { slug, dailyOperatingCostCents: c?.terms.dailyOperatingCostCents ?? 0 };
      }),
    }));
    return budgetWrites(byFunnel, selection.paid);
  }, [channels, selection, wireFunnels]);

  // Somebody who reached this URL without paying has bought nothing, so there is
  // no brand to build. Send them to the payment step rather than creating a
  // brand with nothing behind it.
  useEffect(() => {
    if (selection && !selectionIsPaid(selection)) router.replace("/onboarding/pay");
  }, [selection, router]);

  const refusal = useCallback(() => websiteInputProblem(url), [url]);

  async function build() {
    const bad = refusal();
    if (bad) {
      setTouched(true);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const { brandId } = await upsertBrand(url.trim());

      // Every write, one per (funnel, channel). A failure here is LOUD: the
      // money is already taken, so a brand whose funnels are unfunded would run
      // nothing while looking complete.
      for (const w of writes) {
        await saveBrandFunnelBudget(brandId, w.funnelKey, w.dailyBudgetCents, w.featureSlug);
      }

      // The picks have done their job. Clearing them stops a later visit to
      // /start resuming a selection that has already been bought.
      document.cookie = clearStartSelectionCookieAssignment();
      router.replace(`/onboarding?brandId=${encodeURIComponent(brandId)}`);
    } catch (err) {
      console.error("[build] brand setup failed:", err);
      setProblem(
        "We could not finish setting up your brand. Your payment went through, so nothing is lost. Try again.",
      );
      setBusy(false);
    }
  }

  if (!selection || !channels) {
    return (
      <StartShell step={1} stepCount={1} title="Setting up" footer={<span />}>
        <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
      </StartShell>
    );
  }

  if (!planIsRunnable(writes) && selection.paid.length > 0) {
    // Paid for funnels whose channels the catalogue no longer sells. Surfaced
    // rather than papered over by creating a brand with nothing behind it.
    return (
      <StartShell
        step={1}
        stepCount={1}
        title="Something changed while you were paying"
        subtitle="What you paid for is no longer something we can run. Nothing is lost. Talk to us and we will sort it out."
        footer={<StartButton onClick={() => router.push("/orgs")}>Go to your dashboard</StartButton>}
      >
        <span />
      </StartShell>
    );
  }

  const bad = touched ? refusal() : null;

  return (
    <StartShell
      step={1}
      stepCount={1}
      title="Where do we send the buyers?"
      subtitle="Your website. We read it to work out what you sell and who to go after, so you type none of it."
      footer={
        <StartButton onClick={build} busy={busy} disabled={url.trim().length === 0}>
          {busy ? "Setting things up..." : "Start running"}
        </StartButton>
      }
    >
      <div className="space-y-4">
        <div>
          <input
            type="url"
            inputMode="url"
            autoFocus
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setTouched(false);
            }}
            onBlur={() => setTouched(true)}
            placeholder="yourcompany.com"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-300"
          />
          {bad && <p className="mt-2 text-sm text-red-600">{bad}</p>}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            You have paid for{" "}
            <span className="font-medium text-gray-900">
              {selection.paid.length === 1 ? "1 funnel" : `${selection.paid.length} funnels`}
            </span>
            . Once this is set up they run from {dollars(totalDailyCents(writes))} per day, charged as
            it is spent, and you can stop any of them whenever you want.
          </p>
        </div>

        {problem && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {problem}
          </p>
        )}
      </div>
    </StartShell>
  );
}
