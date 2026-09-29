"use client";

/**
 * "New organization" / "Add a brand", dashboard v2. Two steps, owner-decided 2026-09-27:
 * the "New organization" modal only NAMES and creates the org, credits its creation bonus,
 * switches to it and lands on its page, which asks for a first brand. "Add a brand" then
 * opens this same modal from the brand step, over the new org's dashboard: brand, what
 * they sell, who they sell to, the offer's six levers, what they want (website visits or
 * positive replies), the daily budget, then the money. It ends on the new campaign's
 * mission page with the campaign running.
 *
 * Everything that can be prefilled is, and the reads that prefill run in the background
 * from the moment the brand exists, so the person answers one screen while the next is
 * being prepared. Rules the screens decide on live in `lib/v2/new-org-wizard.ts`.
 *
 * The session's active org is never switched with `setActive` before the org is set up:
 * that refreshes the current page under a not-yet-set-up org and the edge gate would send
 * the person to the full-page onboarding. Step one therefore NAVIGATES to the new org's
 * root (the one page the gate lets through, Clerk's URL sync activates the org there).
 * Calls made for an org the session is not on carry it through `setApiActiveOrgOverride`
 * (a token Clerk mints for that org, see lib/api.ts). Only once the org is marked set up
 * does the brand step switch to it and land on the campaign.
 */

import { defaultSalesRepToAccountEmail } from "@/lib/sales-rep-default";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useOrganizationList, useSession, useUser } from "@clerk/nextjs";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import posthog from "posthog-js";
import {
  ApiError,
  USER_PROFILE_FIELDS,
  configureAutoTopup,
  confirmAudienceSegments,
  confirmBrandOffers,
  createBrandWithoutWebsite,
  createCampaignWithoutBrandEnrichment,
  createEmbeddedCardSetup,
  createEmbeddedCheckoutSession,
  extractBrandFields,
  getBillingAccount,
  getPublicCatalogue,
  getWorkflowProjectionLadder,
  listBrandOffers,
  prefillFeatureInputs,
  proposeAudienceSegments,
  proposeBrandOffers,
  saveCampaignBudget,
  saveOfferUserFields,
  setPaymentMode,
  setApiActiveOrgOverride,
  suggestBrandIcp,
  upsertBrand,
  type AudienceSegmentProposal,
  type BillingAccount,
  type OfferProposal,
  type UserFieldKey,
  type UserFieldValue,
} from "@/lib/api";
import { getStripe } from "@/lib/stripe";
import { channelMinimumCents, channelMinimumsFromWire } from "@/lib/channel-minimums";
import { websiteInputProblem } from "@/lib/website-input";
import { v2MissionHref } from "@/lib/v2/routes";
import {
  LEVER_QUESTIONS,
  NEW_ORG_CHANNEL_SLUG,
  NEW_ORG_LEGS,
  PREPAID_PRESETS_CENTS,
  canSkipPayment,
  newOrgLeg,
  nextStep,
  parseCustomAmountCents,
  previousStep,
  recommendedDailyBudgetUsd,
  suggestNoWebsiteBrandName,
  suggestOrgName,
  type LeverKey,
  type PaymentMode,
  type NewOrgLegKey,
  type NewOrgStep,
} from "@/lib/v2/new-org-wizard";
import { OfferIcon } from "@/components/v2/new-org-icons";

type Draft = Record<LeverKey, string>;
const EMPTY_LEVERS: Draft = {
  dreamOutcome: "",
  perceivedLikelihood: "",
  socialProof: "",
  riskReversal: "",
  urgency: "",
  scarcity: "",
};

function asText(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join("\n");
  return typeof v === "string" ? v : "";
}

function fmtUsd(usd: number): string {
  return usd < 10 ? `$${usd.toFixed(2)}` : `$${Math.round(usd).toLocaleString("en-US")}`;
}

const STEP_TITLE: Record<NewOrgStep, string> = {
  org: "Name your organization",
  brand: "Your brand",
  offerText: "What do you sell?",
  offerPick: "Start with one offer",
  audienceText: "Who do you sell to?",
  audiencePick: "Your audiences",
  levers: "Your offer, in six answers",
  leg: "What do you want for this brand?",
  budget: "Daily budget",
  payment: "Fund your campaign",
  launching: "Launching your campaign",
};

export function NewOrgModal({
  open,
  onClose,
  existingOrgNames,
  existingOrgId,
  existingBrand,
}: {
  open: boolean;
  onClose: () => void;
  existingOrgNames: readonly string[];
  /**
   * "Add a brand" to an org that already exists: the modal starts at the brand step,
   * on that org, and everything after it is the same.
   */
  existingOrgId?: string | null;
  /**
   * Resume a brand whose setup stopped before the campaign launched (the org is still
   * not set up): the modal opens on the brand step with that brand already there, and
   * Continue reads its site and carries on.
   */
  existingBrand?: { id: string; domain: string | null; name: string | null } | null;
}) {
  const router = useRouter();
  const { user } = useUser();
  const { session } = useSession();
  const { createOrganization, setActive } = useOrganizationList();
  const personName = user?.fullName ?? ([user?.firstName, user?.lastName].filter(Boolean).join(" ") || null);

  const [step, setStep] = useState<NewOrgStep>(existingOrgId ? "brand" : "org");
  const [busy, setBusy] = useState(false);
  const [readingSite, setReadingSite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Org
  const [orgName, setOrgName] = useState("");
  const [orgId, setOrgId] = useState<string | null>(existingOrgId ?? null);
  // Brand
  const [hasWebsite, setHasWebsite] = useState(existingBrand ? Boolean(existingBrand.domain) : true);
  const [website, setWebsite] = useState(existingBrand?.domain ?? "");
  const [brandName, setBrandName] = useState(existingBrand?.name ?? "");
  const [brandId, setBrandId] = useState<string | null>(existingBrand?.id ?? null);
  // Offers
  const [offerText, setOfferText] = useState("");
  const [offerProposals, setOfferProposals] = useState<OfferProposal[]>([]);
  const [pickedOfferIndex, setPickedOfferIndex] = useState(0);
  const [offerId, setOfferId] = useState<string | null>(null);
  // A resumed brand that already holds its offers (its setup stopped after they were
  // confirmed): picked from as they are, never proposed again.
  const [existingOffers, setExistingOffers] = useState<{ offerId: string; name: string }[] | null>(null);
  // The six offer questions, one screen each.
  const [leverIndex, setLeverIndex] = useState(0);
  // Audiences
  const [audienceText, setAudienceText] = useState("");
  const [segments, setSegments] = useState<AudienceSegmentProposal[]>([]);
  const [pickedSegments, setPickedSegments] = useState<Set<number>>(new Set());
  // Levers
  const [levers, setLevers] = useState<Draft>(EMPTY_LEVERS);
  // Leg + budget
  const [legKey, setLegKey] = useState<NewOrgLegKey>("start_to_website_visit");
  const [legPrices, setLegPrices] = useState<Partial<Record<NewOrgLegKey, { usd: number | null; workflow: string | null }>>>({});
  const [floorUsd, setFloorUsd] = useState(1);
  const [budget, setBudget] = useState("");
  // Payment
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [payMode, setPayMode] = useState<PaymentMode>("prepaid");
  const [cardSecret, setCardSecret] = useState<string | null>(null);
  const [presetCents, setPresetCents] = useState<number | null>(PREPAID_PRESETS_CENTS[0]);
  const [customAmount, setCustomAmount] = useState("");
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);

  // Background prefills, keyed on the brand they were read for.
  const prefillRef = useRef<Promise<void> | null>(null);
  const prefilledFor = useRef<string | null>(null);
  const prefillFields = useRef<Promise<void> | null>(null);
  const editedRef = useRef<{ offer: boolean; audience: boolean; levers: boolean }>({ offer: false, audience: false, levers: false });

  // Seed the org name once, from the person's own name.
  useEffect(() => {
    if (!open) return;
    setOrgName((cur) => cur || suggestOrgName(personName, existingOrgNames));
    setBrandName((cur) => cur || suggestNoWebsiteBrandName(personName));
  }, [open, personName, existingOrgNames]);

  // The override lives exactly as long as the modal is acting on the new org.
  useEffect(() => {
    setApiActiveOrgOverride(open && orgId ? orgId : null);
    return () => setApiActiveOrgOverride(null);
  }, [open, orgId]);

  // Esc closes, like every v2 dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "launching") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    if (step === "launching" && busy) return;
    setApiActiveOrgOverride(null);
    onClose();
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      console.error("[new-org] step failed:", e);
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const go = (s: NewOrgStep) => setStep(s);
  const forward = () => go(nextStep(step, { offerCount: offerProposals.length }));
  const back = () => {
    // The six levers walk back one question at a time before leaving the step.
    if (step === "levers" && leverIndex > 0) return setLeverIndex((i) => i - 1);
    // A resumed brand's existing offers: no "What you sell" screen to go back to.
    if (existingOffers && step === "offerPick") return go("brand");
    if (existingOffers && step === "audienceText") return go(existingOffers.length > 1 ? "offerPick" : "brand");
    go(previousStep(step, { offerCount: offerProposals.length }));
  };

  // ── Prefill: everything readable off the brand, started the moment it exists ──
  /** The ICP draft alone (a resumed brand whose offers already exist skips the site read). */
  function startIcpPrefill(id: string): Promise<void> {
    return suggestBrandIcp(id)
      .catch((e) => {
        console.error("[new-org] ICP prefill failed:", e);
        return null;
      })
      .then((icp) => {
        const icpText = icp?.icp ?? "";
        if (icpText && !editedRef.current.audience) setAudienceText((cur) => cur || icpText);
      });
  }

  /** The six levers, read for ONE offer (a several-offer brand has no brand-level answer). */
  function prefillLeversForOffer(id: string, chosenOfferId: string): Promise<void> {
    const leverFields = USER_PROFILE_FIELDS.filter((f) => LEVER_QUESTIONS.some((q) => q.key === f.key));
    return extractBrandFields([id], leverFields, { mode: "suggest", urlStrategy: "landing", offerId: chosenOfferId })
      .then((fields) => {
        const f = fields?.fields ?? {};
        if (editedRef.current.levers) return;
        setLevers((cur) => {
          const next = { ...cur };
          for (const q of LEVER_QUESTIONS) if (!next[q.key]) next[q.key] = asText(f[q.key]?.value);
          return next;
        });
      })
      .catch((e) => console.error("[new-org] offer lever prefill failed:", e));
  }

  /**
   * Starts every prefill read for the brand and returns the one the NEXT screen needs
   * (what they sell, read off the site), so the brand step can wait on it behind a
   * loader and land on a filled field. The ICP read keeps running in the background;
   * its screen is two steps away.
   */
  function startPrefill(id: string): Promise<void> {
    // Once per brand: going Back and Continue again must not pay for the same reads twice.
    if (prefilledFor.current === id && prefillFields.current) return prefillFields.current;
    prefilledFor.current = id;
    const fieldsRead = extractBrandFields([id], USER_PROFILE_FIELDS, { mode: "suggest", urlStrategy: "landing" }).catch((e) => {
      console.error("[new-org] field prefill failed:", e);
      return null;
    });
    const icpRead = suggestBrandIcp(id).catch((e) => {
      console.error("[new-org] ICP prefill failed:", e);
      return null;
    });
    const fieldsApplied = fieldsRead.then((fields) => {
      const f = fields?.fields ?? {};
      const services = asText(f.services?.value);
      if (services && !editedRef.current.offer) setOfferText((cur) => cur || services);
      if (!editedRef.current.levers) {
        setLevers((cur) => {
          const next = { ...cur };
          for (const q of LEVER_QUESTIONS) if (!next[q.key]) next[q.key] = asText(f[q.key]?.value);
          return next;
        });
      }
    });
    const icpApplied = icpRead.then((icp) => {
      const icpText = icp?.icp ?? "";
      if (icpText && !editedRef.current.audience) setAudienceText((cur) => cur || icpText);
    });
    prefillRef.current = Promise.all([fieldsApplied, icpApplied]).then(() => undefined);
    prefillFields.current = fieldsApplied;
    return fieldsApplied;
  }

  // Leg prices and the channel floor, read once the OFFER is chosen: features-service
  // prices a leg on an offer, and a brand being set up has neither an offer before the
  // pick (502 "states no offer") nor a campaign after it (409 "several offers").
  useEffect(() => {
    if (!brandId || !orgId || !offerId) return;
    let alive = true;
    void (async () => {
      const cat = await getPublicCatalogue().catch((e) => {
        console.error("[new-org] catalogue read failed:", e);
        return null;
      });
      if (cat && alive) {
        const cents = channelMinimumCents(channelMinimumsFromWire(cat.channels), NEW_ORG_CHANNEL_SLUG);
        if (cents != null) setFloorUsd(cents / 100);
      }
      for (const leg of NEW_ORG_LEGS) {
        const ladder = await getWorkflowProjectionLadder({ featureSlug: NEW_ORG_CHANNEL_SLUG, brandId, offerId, leg: leg.key }).catch((e) => {
          console.error(`[new-org] price read failed for ${leg.key}:`, e);
          return null;
        });
        const rec = ladder?.recommendedWorkflowDynastySlug ?? null;
        const row = ladder?.rows.find((r) => r.audienceId === null && r.workflow.workflowDynastySlug === rec);
        if (alive) setLegPrices((p) => ({ ...p, [leg.key]: { usd: row?.resolved.costPerOutcomeUsd ?? null, workflow: rec } }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [brandId, orgId, offerId]);

  // ── Steps ──
  function submitOrg() {
    const name = orgName.trim();
    if (!name) return setError("Give your organization a name.");
    void run(async () => {
      let id = orgId;
      if (!id) {
        if (!createOrganization) throw new Error("Your session is still loading. Try again in a moment.");
        const org = await createOrganization({ name });
        id = org.id;
        setOrgId(id);
        posthog.capture("new_org_modal_org_created", { org_id: id });
      }
      // The org's creation bonus pays for the reads that draft its first brand. Asked
      // with a token minted for the NEW org (the session is still on the previous one);
      // billing grants it once per org, so a retry after a failure is safe.
      const orgToken = await session?.getToken({ organizationId: id, skipCache: true });
      if (!orgToken) throw new Error("Your session expired. Sign in again to finish.");
      const bonus = await fetch("/api/orgs/creation-bonus", { method: "POST", headers: { Authorization: `Bearer ${orgToken}` } });
      if (!bonus.ok) throw new Error("We could not credit the new organization. Try again.");
      // Step one ends here: the person lands on the new org, which asks for its first
      // brand, and that brand is set up in this same modal over the dashboard. A full
      // navigation, NOT setActive: setActive refreshes the CURRENT page under the new,
      // not-yet-set-up org, and the edge gate would bounce that page to the old
      // onboarding. The org root is the one page the gate lets through for it, and
      // Clerk's URL sync makes it the active org on that request.
      setApiActiveOrgOverride(null);
      window.location.assign(`/v2/orgs/${id}`);
    });
  }

  function submitBrand() {
    if (hasWebsite) {
      const problem = websiteInputProblem(website);
      if (problem) return setError(problem);
      if (!website.trim()) return setError("Enter your website, or choose that you have none.");
    } else if (!brandName.trim()) {
      return setError("Give your brand a name.");
    }
    void run(async () => {
      // A brand with no website is created on the next screen, from what it sells: that
      // text is the only thing its fields can be read from.
      if (hasWebsite) {
        let id = brandId;
        if (!id) {
          const url = /^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`;
          ({ brandId: id } = await upsertBrand(url));
          setBrandId(id);
        }
        // A brand that already holds its offers is not asked what it sells again: a
        // brand-scoped site read is refused for it (one answer per offer), and its offers
        // are already named. It picks one of them; the levers are read for that offer.
        const { offers } = await listBrandOffers(id);
        if (offers.length > 0) {
          setExistingOffers(offers.map((o) => ({ offerId: o.offerId, name: o.name })));
          void startIcpPrefill(id);
          if (offers.length === 1) {
            setOfferId(offers[0].offerId);
            void prefillLeversForOffer(id, offers[0].offerId);
            go("audienceText");
          } else {
            setPickedOfferIndex(0);
            go("offerPick");
          }
          return;
        }
        // Wait for the site read so "What you sell" opens already drafted (owner-asked:
        // a loader here beats a field that fills in under the person's eyes).
        setReadingSite(true);
        try {
          await startPrefill(id);
        } finally {
          setReadingSite(false);
        }
      }
      forward();
    });
  }

  function submitOfferText() {
    const text = offerText.trim();
    if (!text) return setError("Tell us what you sell.");
    void run(async () => {
      let id = brandId;
      if (!id) {
        ({ brandId: id } = await createBrandWithoutWebsite(brandName.trim(), text));
        setBrandId(id);
        void startPrefill(id);
      } else {
        // A resumed brand with no website: its reads never ran in this modal.
        void startPrefill(id);
      }
      const { offers, mainOfferIndex } = await proposeBrandOffers(id, text);
      if (offers.length === 0) throw new Error("We could not read an offer in this text. Add a sentence about what a customer buys.");
      setOfferProposals(offers);
      const main = mainOfferIndex >= 0 && mainOfferIndex < offers.length ? mainOfferIndex : 0;
      setPickedOfferIndex(main);
      if (offers.length === 1) {
        const { chosenOfferId: chosen } = await confirmBrandOffers(id, offers, 0);
        setOfferId(chosen);
        go("audienceText");
      } else {
        go("offerPick");
      }
    });
  }

  function submitOfferPick() {
    if (existingOffers) {
      const chosen = existingOffers[pickedOfferIndex]?.offerId;
      if (!chosen) return setError("Pick an offer.");
      setOfferId(chosen);
      void prefillLeversForOffer(brandId!, chosen);
      return go("audienceText");
    }
    void run(async () => {
      const { chosenOfferId: chosen } = await confirmBrandOffers(brandId!, offerProposals, pickedOfferIndex);
      setOfferId(chosen);
      forward();
    });
  }

  function submitAudienceText() {
    const text = audienceText.trim();
    if (!text) return setError("Tell us who you sell to.");
    void run(async () => {
      const { segments: proposed } = await proposeAudienceSegments(brandId!, text);
      if (proposed.length === 0) throw new Error("We could not read an audience in this text. Add who buys, where, and what size of company.");
      setSegments(proposed);
      setPickedSegments(new Set(proposed.map((_, i) => i)));
      forward();
    });
  }

  function submitAudiencePick() {
    if (pickedSegments.size === 0) return setError("Keep at least one audience.");
    void run(async () => {
      await prefillRef.current;
      forward();
    });
  }

  function submitLevers() {
    void run(async () => {
      const fields: Partial<Record<UserFieldKey, UserFieldValue>> = {};
      const services = offerProposals[pickedOfferIndex]?.name;
      if (services) fields.services = [services];
      for (const q of LEVER_QUESTIONS) {
        const v = levers[q.key].trim();
        fields[q.key] = q.list ? v.split("\n").map((s) => s.trim()).filter(Boolean) : v;
      }
      await saveOfferUserFields(brandId!, offerId!, fields);
      forward();
    });
  }

  const leg = newOrgLeg(legKey);
  const legPrice = legPrices[legKey]?.usd ?? null;
  const recommended = recommendedDailyBudgetUsd(leg, legPrice, floorUsd);

  function submitLeg() {
    setBudget((cur) => (cur ? cur : recommended != null ? String(recommended) : ""));
    forward();
    void getBillingAccount()
      .then(setAccount)
      .catch((e) => console.error("[new-org] billing account read failed:", e));
  }

  const budgetUsd = Number(budget);
  function submitBudget() {
    if (!budget.trim() || !Number.isInteger(budgetUsd) || budgetUsd < 1) return setError("Enter a whole number of dollars a day.");
    if (budgetUsd < floorUsd) return setError(`This channel runs from ${fmtUsd(floorUsd)} a day.`);
    forward();
  }

  const freeCreditRaw = account?.free_credit_spendable_cents;
  const freeCreditCents = freeCreditRaw != null && freeCreditRaw.trim() !== "" ? Number(freeCreditRaw) : null;
  const skipAllowed = canSkipPayment(freeCreditCents);
  const custom = parseCustomAmountCents(customAmount);
  const prepaidCents = custom && "cents" in custom ? custom.cents : presetCents;

  // Orgs set up here pay through Revolut (owner-decided 2026-09-27). Declared once, right
  // before the first card or top-up call, for a new org and a resumed one alike; an org
  // already holding a card elsewhere keeps paying there.
  const revolutDeclared = useRef<string | null>(null);
  async function declareRevolut() {
    if (!orgId || revolutDeclared.current === orgId) return;
    const orgToken = await session?.getToken({ organizationId: orgId, skipCache: true });
    if (!orgToken) throw new Error("Your session expired. Sign in again to finish.");
    const res = await fetch("/api/orgs/revolut", { method: "POST", headers: { Authorization: `Bearer ${orgToken}` } });
    if (!res.ok) throw new Error("We could not prepare the payment. Try again.");
    revolutDeclared.current = orgId;
  }

  function startCheckout() {
    if (custom && "problem" in custom) return setError(custom.problem);
    if (!prepaidCents) return setError("Choose an amount.");
    void run(async () => {
      await declareRevolut();
      const checkout = await createEmbeddedCheckoutSession(prepaidCents);
      if (checkout.mode === "embedded_widget") {
        const { openCardWidget } = await import("@/lib/card-setup-widget");
        await openCardWidget({
          token: checkout.token,
          environment: checkout.environment,
          savePaymentMethodFor: checkout.save_payment_method_for,
          name: personName ?? undefined,
          email: user?.primaryEmailAddress?.emailAddress ?? undefined,
          onSuccess: () => void launch(),
          onCancel: () => {},
          onError: (message) => setError(message),
        });
        return;
      }
      setCheckoutSecret(checkout.client_secret);
    });
  }

  // POSTPAID: save a card in the page, charging nothing, then arm auto top-up. The
  // credit line itself is billing's (it grows with what the org has paid), so the
  // amounts sent here only switch it on.
  function startCardCapture() {
    void run(async () => {
      await declareRevolut();
      const setup = await createEmbeddedCardSetup();
      if (setup.mode === "embedded_checkout") {
        setCardSecret(setup.client_secret);
        return;
      }
      if (setup.mode === "embedded_widget") {
        const { openCardWidget } = await import("@/lib/card-setup-widget");
        await openCardWidget({
          token: setup.token,
          environment: setup.environment,
          savePaymentMethodFor: setup.save_payment_method_for,
          name: setup.customer_name ?? undefined,
          email: setup.customer_email ?? undefined,
          onSuccess: () => void afterCardSaved(),
          onCancel: () => {},
          onError: (message) => setError(message),
        });
        return;
      }
      console.error("[new-org] card setup answered a hosted page to an in-page request", setup);
      throw new Error("We could not open the card form here. Choose prepaid, or add a card from Billing later.");
    });
  }

  async function afterCardSaved() {
    setCardSecret(null);
    setBusy(true);
    setError(null);
    try {
      // The saved card reaches billing through the provider's webhook a moment later.
      let acct: BillingAccount | null = null;
      for (let i = 0; i < 10; i++) {
        acct = await getBillingAccount().catch((e) => {
          console.error("[new-org] billing read after card save failed:", e);
          return null;
        });
        if (acct?.has_payment_method) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!acct?.has_payment_method) throw new Error("Your card is still being confirmed. Wait a few seconds and press Add a card again.");
      if (acct.auto_reload_supported === false) {
        setPayMode("prepaid");
        throw new Error("This card cannot be charged automatically (some countries require each charge to be approved). Choose prepaid instead.");
      }
      await configureAutoTopup(5000, 1000);
    } catch (e) {
      console.error("[new-org] postpaid setup failed:", e);
      setError(e instanceof Error ? e.message : "We could not set up postpaid. Try again.");
      setBusy(false);
      return;
    }
    setBusy(false);
    launch();
  }

  // Starting on free credit is PREPAID by definition: the org spends what it holds.
  const startOnFreeCredit = useRef(false);
  // "Try again" replays the launch, so every write it makes is done ONCE: what already
  // landed on an earlier attempt is skipped, never re-sent (a re-sent audience set is
  // refused as a duplicate and the retry could never get past it).
  const launched = useRef<{ audiences: boolean; budget: boolean; campaignId: string | null }>({ audiences: false, budget: false, campaignId: null });

  function launch() {
    go("launching");
    void run(async () => {
      const id = brandId!;
      const chosenOffer = offerId!;
      // Record the payment mode FIRST: a new org is postpaid by default, and a postpaid
      // org with no card is stopped at once (no_chargeable_card), which is what made a
      // free-credit start stop immediately. Prepaid runs without a card.
      await setPaymentMode(startOnFreeCredit.current ? "prepaid" : payMode);
      if (!launched.current.audiences) {
        try {
          await confirmAudienceSegments(id, chosenOffer, audienceText.trim(), segments.filter((_, i) => pickedSegments.has(i)));
        } catch (e) {
          // 409: this offer already holds these audiences, created by an earlier attempt
          // (names are unique per brand and offer). They are what we meant to create.
          if (!(e instanceof ApiError && e.status === 409)) throw e;
          console.warn("[new-org] audiences already exist for this offer, reusing them:", e.message);
        }
        launched.current.audiences = true;
      }
      if (!launched.current.budget) {
        await saveCampaignBudget(id, { offerId: chosenOffer, legKey, featureSlug: NEW_ORG_CHANNEL_SLUG }, budgetUsd * 100);
        launched.current.budget = true;
      }
      const workflowSlug = legPrices[legKey]?.workflow;
      if (!workflowSlug) throw new Error(`Nothing is ready to run for ${leg.unitPlural} yet, so the campaign cannot start.`);
      const prefill = await prefillFeatureInputs(NEW_ORG_CHANNEL_SLUG, [id], chosenOffer);
      const featureInputs: Record<string, string> = {};
      for (const [k, v] of Object.entries(prefill.prefilled)) if (typeof v === "string" && v.trim()) featureInputs[k] = v;
      const url = hasWebsite ? (/^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`) : null;
      const offerName = offerProposals[pickedOfferIndex]?.name ?? "Offer";
      const campaignId =
        launched.current.campaignId ??
        (
          await createCampaignWithoutBrandEnrichment({
            name: `${offerName} (${leg.label}, Cold email)`,
            workflowSlug,
            ...(url ? { brandUrls: [url] } : { brandIds: [id] }),
            offerId: chosenOffer,
            legKey,
            featureSlug: NEW_ORG_CHANNEL_SLUG,
            featureInputs,
          })
        ).campaign.id;
      launched.current.campaignId = campaignId;
      // Still acting on the new org through the override: the rep write lands there.
      await defaultSalesRepToAccountEmail(id, user?.primaryEmailAddress?.emailAddress);
      // The edge gate reads this claim: the org is set up only now, with a campaign running.
      // Mark the NEW org set up, with a token minted for it (the session is still on the
      // previous org), BEFORE switching to it: the edge gate then lets it through.
      const orgToken = await session?.getToken({ organizationId: orgId!, skipCache: true });
      if (!orgToken) throw new Error("Your session expired. Sign in again to finish.");
      const res = await fetch("/api/onboarding/complete", { method: "POST", headers: { Authorization: `Bearer ${orgToken}` } });
      if (!res.ok) throw new Error("We could not finish setting up the organization. Try again.");
      if (!setActive) throw new Error("Your session is still loading. Try again in a moment.");
      await setActive({ organization: orgId! });
      await session?.getToken({ skipCache: true });
      posthog.capture("new_org_modal_launched", { org_id: orgId, brand_id: id, leg: legKey, budget_usd: budgetUsd, pay_mode: payMode });
      setApiActiveOrgOverride(null);
      onClose();
      router.push(v2MissionHref(orgId!, id, campaignId));
    });
  }

  if (!open) return null;
  const host = document.getElementById("v2-portal") ?? document.body;
  const stepIndex = ["org", "brand", "offerText", "audienceText", "levers", "leg", "budget", "payment"].indexOf(
    step === "offerPick" ? "offerText" : step === "audiencePick" ? "audienceText" : step,
  );

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[8vh]">
      <div role="dialog" aria-modal="true" aria-label={existingOrgId ? "Add a brand" : "New organization"} className="k-popover flex max-h-[84vh] w-full max-w-[560px] flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <span className="k-label">{existingOrgId ? "Add a brand" : "New organization"}</span>
          {existingOrgId && stepIndex >= 1 && (
            <span className="k-fg3 k-mono text-[12px] tabular-nums">{`${stepIndex} / 7`}</span>
          )}
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={() => close()} disabled={step === "launching"}>
            ×
          </button>
        </div>

        <div className="k-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <h2 className="k-fg text-[17px] font-medium leading-6">{STEP_TITLE[step]}</h2>

          {step === "org" && (
            <Field label="Organization name">
              <input className="k-input w-full px-2.5" value={orgName} onChange={(e) => setOrgName(e.target.value)} autoFocus disabled={!!orgId} />
              {orgId && <p className="k-fg3 mt-1.5 text-[12px]">Created. You can rename it later in its settings.</p>}
            </Field>
          )}

          {step === "brand" && (
            <div className="mt-4 space-y-3">
              {hasWebsite ? (
                <Field label="Website">
                  <input className="k-input w-full px-2.5" placeholder="acme.com" value={website} onChange={(e) => setWebsite(e.target.value)} autoFocus disabled={!!brandId} />
                </Field>
              ) : (
                <Field label="Brand name">
                  <input className="k-input w-full px-2.5" value={brandName} onChange={(e) => setBrandName(e.target.value)} autoFocus />
                </Field>
              )}
              {readingSite && (
                <p className="k-fg2 flex items-center gap-2 text-[13px]" role="status" aria-live="polite">
                  <span aria-hidden className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Reading your website to draft what you sell…
                </p>
              )}
              {!brandId && !readingSite && (
                <button type="button" className="k-btn-ghost -ml-2 h-7 text-[12px]" onClick={() => setHasWebsite((v) => !v)}>
                  {hasWebsite ? "This brand has no website" : "This brand has a website"}
                </button>
              )}
            </div>
          )}

          {step === "offerText" && (
            <Field label="What you sell" hint="We drafted this from your website when we could. Edit it freely.">
              <textarea
                className="k-input min-h-[140px] w-full resize-y px-2.5 py-2 leading-5"
                value={offerText}
                onChange={(e) => {
                  editedRef.current.offer = true;
                  setOfferText(e.target.value);
                }}
                placeholder="What a customer buys from you, in a few sentences."
                autoFocus
              />
            </Field>
          )}

          {step === "offerPick" && (
            <div className="mt-4 space-y-1.5">
              {existingOffers ? (
                <>
                  <p className="k-fg2 text-[13px]">This brand already has {existingOffers.length} offers. Pick one to start with.</p>
                  {existingOffers.map((o, i) => (
                    <PickRow key={o.offerId} title={o.name} sub="" checked={i === pickedOfferIndex} kind="radio" onClick={() => setPickedOfferIndex(i)} />
                  ))}
                </>
              ) : (
                <>
                  <p className="k-fg2 text-[13px]">We found {offerProposals.length} offers. Pick one to start with; the others stay on your brand for later.</p>
                  {offerProposals.map((o, i) => (
                    <PickRow key={i} icon={<OfferIcon token={o.icon} />} title={o.name} sub={o.description} checked={i === pickedOfferIndex} kind="radio" onClick={() => setPickedOfferIndex(i)} />
                  ))}
                </>
              )}
            </div>
          )}

          {step === "audienceText" && (
            <Field label="Who you sell to" hint="Drafted from your brand. Edit it freely.">
              <textarea
                className="k-input min-h-[120px] w-full resize-y px-2.5 py-2 leading-5"
                value={audienceText}
                onChange={(e) => {
                  editedRef.current.audience = true;
                  setAudienceText(e.target.value);
                }}
                placeholder="The people and companies who buy from you."
                autoFocus
              />
            </Field>
          )}

          {step === "audiencePick" && (
            <div className="mt-4 space-y-1.5">
              <p className="k-fg2 text-[13px]">We split your target so the campaign can test which audience answers best. Keep at least one.</p>
              {segments.map((s, i) => (
                <PickRow
                  key={i}
                  icon={<OfferIcon token={s.icon} />}
                  title={s.name}
                  sub={s.description}
                  checked={pickedSegments.has(i)}
                  kind="checkbox"
                  onClick={() =>
                    setPickedSegments((cur) => {
                      const next = new Set(cur);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                  }
                />
              ))}
            </div>
          )}

          {step === "levers" && (
            <div className="mt-4 space-y-4">
              {(() => {
                // One question per screen (owner-asked); Continue walks the six.
                const q = LEVER_QUESTIONS[leverIndex];
                return (
                  <Field key={q.key} label={`${q.label} (${leverIndex + 1} of ${LEVER_QUESTIONS.length})`} hint={q.hint}>
                    <textarea
                      className="k-input min-h-[140px] w-full resize-y px-2.5 py-2 leading-5"
                      value={levers[q.key]}
                      onChange={(e) => {
                        editedRef.current.levers = true;
                        setLevers((cur) => ({ ...cur, [q.key]: e.target.value }));
                      }}
                      autoFocus
                    />
                  </Field>
                );
              })()}
            </div>
          )}

          {step === "leg" && (
            <div className="mt-4 space-y-1.5">
              {NEW_ORG_LEGS.map((l) => {
                const price = legPrices[l.key];
                const sub = price === undefined ? "Reading the current price…" : price.usd != null ? `About ${fmtUsd(price.usd)} per ${l.unit} right now.` : "No price measured yet.";
                return <PickRow key={l.key} title={l.label} sub={sub} checked={legKey === l.key} kind="radio" onClick={() => setLegKey(l.key)} />;
              })}
            </div>
          )}

          {step === "budget" && (
            <div className="mt-4 space-y-2">
              <Field label="Dollars a day">
                <div className="flex items-center gap-2">
                  <span className="k-fg3">$</span>
                  <input className="k-input w-28 px-2.5 text-right tabular-nums" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))} autoFocus />
                  <span className="k-fg3 text-[13px]">/ day</span>
                </div>
              </Field>
              {recommended != null && (
                <p className="k-fg2 text-[13px]">
                  {`Recommended: ${fmtUsd(recommended)} a day, about ${leg.recommendedPerDay} ${leg.recommendedPerDay === 1 ? leg.unit : leg.unitPlural} a day at today's price.`}
                </p>
              )}
            </div>
          )}

          {step === "payment" && !checkoutSecret && (
            <div className="mt-4 space-y-4">
              <div className="k-inset inline-flex rounded-[8px] p-0.5" role="tablist" aria-label="Payment">
                {(["prepaid", "postpaid"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={payMode === m}
                    onClick={() => setPayMode(m)}
                    className={`h-7 rounded-[6px] px-3 text-[13px] ${payMode === m ? "k-raised k-fg shadow-[var(--elev-control)]" : "k-fg2"}`}
                  >
                    {m === "prepaid" ? "Prepaid" : "Postpaid"}
                  </button>
                ))}
              </div>
              {payMode === "postpaid" ? (
                <p className="k-fg2 text-[13px]">
                  Add a card, nothing is charged now. We charge it on the 1st of each month, or sooner each time your spend reaches your credit line: $50 to start, then $200 and $500 as you pay.
                </p>
              ) : (
              <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {PREPAID_PRESETS_CENTS.map((c) => (
                      <button key={c} type="button" onClick={() => { setPresetCents(c); setCustomAmount(""); }} className={`${presetCents === c && !customAmount ? "k-btn-strong" : "k-btn"} tabular-nums`}>
                        ${c / 100}
                      </button>
                    ))}
                    <input className="k-input w-28 px-2.5 tabular-nums" placeholder="Custom" inputMode="decimal" value={customAmount} onChange={(e) => { setCustomAmount(e.target.value); setPresetCents(null); }} />
                  </div>
                  <p className="k-fg3 text-[12px]">Credits are spent as the campaign runs, within the daily budget you set.</p>
                </div>
              )}
              {skipAllowed && freeCreditCents != null && (
                <p className="k-fg2 text-[13px]">You have {fmtUsd(freeCreditCents / 100)} of free credit, so you can also start now and pay later.</p>
              )}
            </div>
          )}

          {step === "payment" && cardSecret && (
            <div className="mt-4">
              <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret: cardSecret, onComplete: () => void afterCardSaved() }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}

          {step === "payment" && checkoutSecret && (
            <div className="mt-4">
              <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret: checkoutSecret, onComplete: launch }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}

          {step === "launching" && (
            <p className="k-fg2 mt-3 text-[13px]">{error ? "The launch stopped." : "Creating your audiences, funding the campaign and starting it."}</p>
          )}

          {error && <p className="mt-3 text-[13px] text-[var(--data-rose)]" role="alert">{error}</p>}
        </div>

        {step !== "launching" && !checkoutSecret && !cardSecret && (
          <div className="flex h-14 shrink-0 items-center gap-2 border-t border-[var(--line-subtle)] px-4">
            {step !== "org" && !(existingOrgId && step === "brand") && (
              <button type="button" className="k-btn-ghost" onClick={back} disabled={busy}>
                Back
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              {step === "payment" && skipAllowed && (
                <button
                  type="button"
                  className="k-btn"
                  onClick={() => {
                    startOnFreeCredit.current = true;
                    launch();
                  }}
                  disabled={busy}
                >
                  Start with free credit
                </button>
              )}
              <button type="button" className="k-btn-strong" disabled={busy} onClick={() => primary()}>
                {readingSite ? "Reading your site…" : busy ? "Working…" : primaryLabel()}
              </button>
            </div>
          </div>
        )}
        {step === "launching" && error && (
          <div className="flex h-14 shrink-0 items-center justify-end gap-2 border-t border-[var(--line-subtle)] px-4">
            <button type="button" className="k-btn-strong" onClick={launch} disabled={busy}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>,
    host,
  );

  function primaryLabel(): string {
    if (step === "payment") return payMode === "postpaid" ? "Add a card" : `Pay ${prepaidCents ? fmtUsd(prepaidCents / 100) : ""}`.trim();
    if (step === "org") return "Create organization";
    return "Continue";
  }

  function primary() {
    switch (step) {
      case "org": return submitOrg();
      case "brand": return submitBrand();
      case "offerText": return submitOfferText();
      case "offerPick": return submitOfferPick();
      case "audienceText": return submitAudienceText();
      case "audiencePick": return submitAudiencePick();
      case "levers": return leverIndex < LEVER_QUESTIONS.length - 1 ? setLeverIndex((i) => i + 1) : submitLevers();
      case "leg": return submitLeg();
      case "budget": return submitBudget();
      case "payment": return payMode === "postpaid" ? startCardCapture() : startCheckout();
      default: return;
    }
  }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="mt-4 block">
      <span className="k-label">{label}</span>
      {hint && <span className="k-fg3 ml-2 text-[12px]">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function PickRow({
  icon,
  title,
  sub,
  checked,
  kind,
  onClick,
}: {
  icon?: React.ReactNode;
  title: string;
  sub: string;
  checked: boolean;
  kind: "radio" | "checkbox";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={kind}
      aria-checked={checked}
      onClick={onClick}
      className={`${checked ? "k-card-accent" : "k-card"} flex w-full items-center gap-3 px-3 py-2.5 text-left`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="k-fg block truncate text-[13px] font-medium">{title}</span>
        <span className="k-fg2 block text-[12px] leading-[18px]">{sub}</span>
      </span>
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 shrink-0 items-center justify-center ${kind === "radio" ? "rounded-full" : "rounded-[4px]"} ${checked ? "bg-[var(--accent)]" : "shadow-[inset_0_0_0_1px_var(--line-strong)]"}`}
      >
        {checked && <span className={`${kind === "radio" ? "h-1.5 w-1.5 rounded-full" : "h-1.5 w-2 rounded-[1px]"} bg-white`} />}
      </span>
    </button>
  );
}
