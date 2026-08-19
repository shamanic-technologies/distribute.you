"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ApiError,
  getBrand,
  getBrandUserFields,
  getCampaign,
  listAudiences,
  updateCampaign,
  type AudienceWire,
  type Campaign,
  type CampaignSettingsPatch,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { SettingsSaveRow } from "@/components/settings/settings-save-row";
import { Skeleton } from "@/components/skeleton";

/**
 * Campaign Settings — the four things campaign-service stores PER CAMPAIGN.
 *
 * THE POINT OF THIS SCREEN, and the thing a future edit must not undo: an empty
 * field and an INHERITED field are not the same statement, and a blank input
 * cannot tell them apart. "This campaign sends people nowhere" and "this campaign
 * uses the brand's destination" are opposite meanings, and the customer reading a
 * blank box has no way to know which one they are looking at.
 *
 * So every inheritable field is TWO controls, never one box: a stated choice
 * ("Inherit" / "Set for this campaign") and then, only under the second, the input.
 * `null` on the wire is exactly the first choice, so the screen and the storage
 * agree by construction. Where the inherited value is cheaply readable it is shown
 * beside the choice, so "inherit" is never a promise the reader has to go and
 * verify — and where it is not readable the card SAYS it is inherited rather than
 * printing a guess.
 *
 * There is no third state. campaign-service refuses an empty audience subset
 * (`minItems: 1`) and an empty destination (`minLength: 1`), so an override that
 * has been emptied is not a way of saying "nothing" — it is an unfinished edit,
 * and the card refuses it with the two real options named.
 *
 * DELIBERATELY NOT ON THIS PAGE (see `CampaignSettingsPatch` in `lib/api.ts` for
 * the same list beside the wire):
 *   - the BUDGET. Money is funded per (sales funnel x acquisition channel) on
 *     Offer Settings; the figure a campaign carries is a mirror of that ceiling,
 *     not an independent knob, and editing the mirror would put a second answer
 *     beside the one billing charges.
 *   - the offer, the funnel, the channel, the feature. Those are what the campaign
 *     IS. Changing one does not configure this campaign, it makes it another one.
 *   - `goal`. Legacy, read-only, nothing writes it; the funnel key is the richer
 *     word and every surface naming what a campaign buys reads that instead.
 */

/** A field is either inherited from the brand, or stated by this campaign. */
type Source = "inherit" | "own";

interface Draft {
  name: string;
  audienceSource: Source;
  audienceIds: string[];
  servicesSource: Source;
  services: string[];
  destinationSource: Source;
  destination: string;
}

/** The draft a stored campaign row reads as. `null` on the wire IS "inherit". */
function draftFromCampaign(c: Campaign): Draft {
  return {
    name: c.name,
    audienceSource: c.audienceIds === null ? "inherit" : "own",
    audienceIds: c.audienceIds ?? [],
    servicesSource: c.servicesOffered === null ? "inherit" : "own",
    services: c.servicesOffered ?? [],
    destinationSource: c.clickDestinationUrl === null ? "inherit" : "own",
    destination: c.clickDestinationUrl ?? "",
  };
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * The PATCH is the DIFF against what is stored, because campaign-service leaves an
 * omitted key untouched and clears an explicit `null`. Two things follow: a field
 * the user never touched is never restated from a stale copy, and a field switched
 * back to "inherit" really does clear rather than silently keeping its old value.
 */
export function buildCampaignPatch(draft: Draft, saved: Draft): CampaignSettingsPatch {
  const patch: CampaignSettingsPatch = {};

  if (draft.name.trim() !== saved.name) patch.name = draft.name.trim();

  const nextAudiences = draft.audienceSource === "own" ? draft.audienceIds : null;
  const savedAudiences = saved.audienceSource === "own" ? saved.audienceIds : null;
  if (nextAudiences === null ? savedAudiences !== null : savedAudiences === null || !sameList(nextAudiences, savedAudiences)) {
    patch.audienceIds = nextAudiences;
  }

  const nextServices = draft.servicesSource === "own" ? draft.services : null;
  const savedServices = saved.servicesSource === "own" ? saved.services : null;
  if (nextServices === null ? savedServices !== null : savedServices === null || !sameList(nextServices, savedServices)) {
    patch.servicesOffered = nextServices;
  }

  const nextDestination = draft.destinationSource === "own" ? draft.destination.trim() : null;
  const savedDestination = saved.destinationSource === "own" ? saved.destination : null;
  if (nextDestination !== savedDestination) patch.clickDestinationUrl = nextDestination;

  return patch;
}

/**
 * What stops a save, in the customer's words. Only the two states the wire allows
 * are offered as the way out — never "leave it empty", which is not a state.
 */
export function campaignSettingsBlocker(draft: Draft): string | null {
  if (draft.name.trim().length === 0) return "Give this campaign a name.";
  if (draft.audienceSource === "own" && draft.audienceIds.length === 0) {
    return "Pick at least one audience for this campaign, or switch it back to inheriting the brand's.";
  }
  if (draft.servicesSource === "own" && draft.services.length === 0) {
    return "Add at least one service for this campaign, or switch it back to inheriting the brand's.";
  }
  if (draft.destinationSource === "own" && draft.destination.trim().length === 0) {
    return "Enter the page this campaign's clicks should land on, or switch it back to inheriting the brand's.";
  }
  return null;
}

/**
 * A refusal is rendered as OUR copy, branched on the status. `apiCall` puts the
 * whole downstream response body verbatim into `ApiError.message`, so printing the
 * message would put a JSON blob in front of a customer.
 */
export function campaignSettingsErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return "These settings were refused. Check the destination URL and the audiences you picked.";
    if (err.status === 403) return "You do not have access to this campaign.";
    if (err.status === 404) return "This campaign no longer exists.";
  }
  return "We could not save these settings. Try again in a moment.";
}

/** One "Inherit / Set for this campaign" chooser. */
function SourceChoice({
  name,
  value,
  onChange,
  inheritLabel,
  inheritedValue,
  inheritedPending,
}: {
  name: string;
  value: Source;
  onChange: (next: Source) => void;
  inheritLabel: string;
  /** What inheriting actually resolves to, when it is cheaply readable. */
  inheritedValue?: ReactNode;
  inheritedPending?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="radio"
          name={name}
          checked={value === "inherit"}
          onChange={() => onChange("inherit")}
          className="mt-0.5"
        />
        <span>
          {inheritLabel}
          <span className="mt-0.5 block text-xs text-gray-500">
            {inheritedPending ? (
              <Skeleton className="inline-block h-3 w-40 align-middle" />
            ) : (
              inheritedValue ?? "Whatever the brand states at the time we send."
            )}
          </span>
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="radio"
          name={name}
          checked={value === "own"}
          onChange={() => onChange("own")}
        />
        Set for this campaign
      </label>
    </div>
  );
}

/** A list the user edits as chips — used for services. */
function ChipList({
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  placeholder: string;
}) {
  const [entry, setEntry] = useState("");

  const commit = () => {
    const value = entry.trim();
    if (!value) return;
    onAdd(value);
    setEntry("");
  };

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(item)}
                aria-label={`Remove ${item}`}
                className="text-gray-400 transition hover:text-gray-700"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={entry}
        placeholder={placeholder}
        onChange={(e) => setEntry(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
    </div>
  );
}

export function CampaignSettingsCard({
  brandId,
  offerId,
  campaignId,
}: {
  brandId: string;
  offerId: string;
  campaignId: string;
}) {
  const queryClient = useQueryClient();

  // Same key the campaign Overview and the top-bar campaign name already poll, so
  // all three share one request.
  const { data: campaignData, isPending, isError } = useAuthQuery(
    ["campaign", campaignId],
    () => getCampaign(campaignId),
  );
  const campaign = campaignData?.campaign ?? null;

  // The three INHERITED values, read from where the sending runtime falls back to
  // when the campaign states nothing: campaign-service passes `null` straight
  // through on /start-run and downstream reads the brand's. So this names the
  // brand's answer, not the offer's — an offer-shaped guess here would print a
  // value the send would never use.
  const { data: audiencesData, isPending: audiencesPending } = useAuthQuery(
    ["audiences", brandId, "offer", offerId],
    () => listAudiences(brandId, { offerId }),
  );
  const audiences: AudienceWire[] = audiencesData?.audiences ?? [];
  const activeAudiences = audiences.filter((a) => a.status === "active");

  const { data: brandData, isPending: brandPending } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
  );
  const brandDestination = brandData?.brand?.clickDestinationUrl ?? null;

  const { data: brandFieldsData, isPending: brandFieldsPending } = useAuthQuery(
    ["brandUserFields", brandId],
    () => getBrandUserFields(brandId),
  );
  const brandServicesValue = brandFieldsData?.fields?.services?.value ?? null;
  const brandServices = Array.isArray(brandServicesValue)
    ? brandServicesValue
    : typeof brandServicesValue === "string"
      ? [brandServicesValue]
      : [];

  // The form is SEEDED from the query and RE-SEEDED whenever the payload is a
  // different object than the one it was built from — never a once-per-mount latch,
  // which would pin the form to the on-disk snapshot the local-first cache paints
  // first and ignore the fresher answer that lands a moment later. A field the user
  // has touched outranks the server (`touched`), or the form would rewrite itself
  // mid-edit.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [touched, setTouched] = useState(false);
  const seededFrom = useRef<Campaign | null>(null);

  useEffect(() => {
    if (!campaign || seededFrom.current === campaign) return;
    seededFrom.current = campaign;
    const next = draftFromCampaign(campaign);
    setBaseline(next);
    if (!touched) setDraft(next);
  }, [campaign, touched]);

  const [saved, setSaved] = useState(false);

  const { mutate, isPending: saving, error } = useMutation({
    mutationFn: (patch: CampaignSettingsPatch) => updateCampaign(campaignId, patch),
    onSuccess: (res) => {
      // Write the response into the cache the page reads, THEN invalidate the list
      // the table renders — a bare invalidate would leave a failed refetch showing
      // the pre-save row.
      queryClient.setQueryData(["campaign", campaignId], res);
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      const next = draftFromCampaign(res.campaign);
      seededFrom.current = res.campaign;
      setBaseline(next);
      setDraft(next);
      setTouched(false);
      setSaved(true);
    },
    onError: (err) => {
      // Loud in the console (status + body), our own copy on screen.
      console.error("[dashboard] updateCampaign failed", err);
    },
  });

  const edit = (patch: Partial<Draft>) => {
    setTouched(true);
    setSaved(false);
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  if (isPending && !draft) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-9 w-full max-w-sm" />
      </div>
    );
  }

  if (isError || !draft || !baseline) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        We could not load this campaign&apos;s settings. Try again in a moment.
      </div>
    );
  }

  // LIVE compare against the last-saved values, never a sticky edited flag —
  // typing a value and undoing it has to disarm the button.
  const patch = buildCampaignPatch(draft, baseline);
  const dirty = Object.keys(patch).length > 0;
  const blocker = campaignSettingsBlocker(draft);

  return (
    <div className="space-y-8">
      {/* Name — the one field with no inherit state: campaign-service stores it
          NOT NULL, so there is nothing to fall back to. */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Name</h3>
        <p className="mb-3 text-sm text-gray-500">What this campaign is called wherever it is listed.</p>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => edit({ name: e.target.value })}
          className="w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Audiences</h3>
        <p className="mb-3 text-sm text-gray-500">
          Who this campaign is allowed to contact. Picking a subset restricts it: the campaign never
          contacts an audience outside the ones ticked.
        </p>
        <SourceChoice
          name="campaign-audiences"
          value={draft.audienceSource}
          onChange={(next) => edit({ audienceSource: next })}
          inheritLabel="Contact every audience the brand has running"
          inheritedPending={audiencesPending}
          inheritedValue={
            activeAudiences.length > 0
              ? `Today that is ${activeAudiences.map((a) => a.name).join(", ")}.`
              : "The brand has no audience running right now."
          }
        />
        {draft.audienceSource === "own" && (
          <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
            {audiences.length === 0 ? (
              <p className="text-sm text-gray-500">This offer has no audiences yet.</p>
            ) : (
              audiences.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={draft.audienceIds.includes(a.id)}
                    onChange={(e) =>
                      edit({
                        audienceIds: e.target.checked
                          ? [...draft.audienceIds, a.id]
                          : draft.audienceIds.filter((id) => id !== a.id),
                      })
                    }
                  />
                  <span>
                    {a.name}
                    {a.status !== "active" && (
                      <span className="ml-1.5 text-xs text-gray-400">({a.status})</span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Services offered</h3>
        <p className="mb-3 text-sm text-gray-500">
          What the emails this campaign sends say you do.
        </p>
        <SourceChoice
          name="campaign-services"
          value={draft.servicesSource}
          onChange={(next) => edit({ servicesSource: next })}
          inheritLabel="Use the brand's services"
          inheritedPending={brandFieldsPending}
          inheritedValue={
            brandServices.length > 0
              ? `Today that is ${brandServices.join(", ")}.`
              : "The brand has not stated its services yet."
          }
        />
        {draft.servicesSource === "own" && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <ChipList
              items={draft.services}
              placeholder="Add a service and press Enter"
              onAdd={(value) =>
                edit({
                  services: draft.services.some((s) => s.toLowerCase() === value.toLowerCase())
                    ? draft.services
                    : [...draft.services, value],
                })
              }
              onRemove={(value) => edit({ services: draft.services.filter((s) => s !== value) })}
            />
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Click destination</h3>
        <p className="mb-3 text-sm text-gray-500">
          The page someone lands on when they click a link in this campaign&apos;s emails.
        </p>
        <SourceChoice
          name="campaign-destination"
          value={draft.destinationSource}
          onChange={(next) => edit({ destinationSource: next })}
          inheritLabel="Send clicks to the brand's destination"
          inheritedPending={brandPending}
          inheritedValue={
            brandDestination
              ? `Today that is ${brandDestination}.`
              : "The brand has not set one, so clicks land on its homepage."
          }
        />
        {draft.destinationSource === "own" && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <input
              type="url"
              inputMode="url"
              value={draft.destination}
              placeholder="https://acme.com/pricing"
              onChange={(e) => edit({ destination: e.target.value })}
              className="w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
        )}
      </section>

      {dirty && blocker && <p className="text-sm text-red-600">{blocker}</p>}
      {error && <p className="text-sm text-red-600">{campaignSettingsErrorMessage(error)}</p>}

      <SettingsSaveRow
        dirty={dirty}
        saving={saving}
        saved={saved}
        disabled={blocker !== null}
        onSave={() => {
          if (blocker !== null) return;
          mutate(patch);
        }}
      />
    </div>
  );
}
