"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  archiveOfferQualificationCriterion,
  isInsufficientCredit,
  listOfferQualificationCriteria,
  suggestOfferQualificationCriteria,
  updateOfferQualificationCriterion,
  type QualificationCriterion,
  type QualificationMode,
} from "@/lib/api";
import {
  FILTER_SCOPE_LINE,
  ROLE_HINT,
  ROLE_LABEL,
  criterionStatusWord,
  formatCostPerLead,
  formatPassRate,
  sortCriteria,
} from "@/lib/v2/qualification";
import { EmptyNote, SectionTitle, Shimmer, StateDot } from "@/components/v2/ui";

const criteriaKey = (brandId: string, offerId: string) => ["offerQualificationCriteria", brandId, offerId] as const;

/**
 * Targeting > Qualification (owner 2026-10-07): the checks this OFFER runs on the companies of
 * its prospects, for every audience of it. Per check: the question, its role (Filter skips a
 * company that fails it, Mention in email hands the proof to the writer), on/off, the served
 * cost per lead and the served pass rate. AI suggestions arrive as checks turned off.
 */
export function OfferQualification({ brandId, offerId }: { brandId: string; offerId: string }) {
  const qc = useQueryClient();
  const q = useAuthQuery(criteriaKey(brandId, offerId), () => listOfferQualificationCriteria(brandId, offerId));
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const suggest = useMutation({
    mutationFn: () => suggestOfferQualificationCriteria(brandId, offerId),
    onMutate: () => setSuggestError(null),
    onSuccess: () => qc.refetchQueries({ queryKey: criteriaKey(brandId, offerId) }),
    onError: (err) => {
      console.error("[offer-qualification] suggestions failed", { brandId, offerId, err });
      // A 402 opens the billing guard (apiCall); anything else is ours to say.
      if (!isInsufficientCredit(err)) setSuggestError("We could not suggest checks right now. Try again.");
    },
  });

  const rows = q.data ? sortCriteria(q.data) : null;
  const suggestButton = (
    <button type="button" className="k-btn" disabled={suggest.isPending} onClick={() => suggest.mutate()}>
      {suggest.isPending ? "Suggesting…" : "Suggest checks"}
    </button>
  );

  return (
    <section>
      <SectionTitle count={rows ? rows.length : null} right={rows && rows.length > 0 ? suggestButton : undefined}>
        Checks
      </SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">We check each company before we write to it, on every audience of this offer.</p>
      {suggestError && <p className="mb-3 text-[12px] text-[var(--data-rose)]">{suggestError}</p>}
      {!rows ? (
        q.isError && q.isFetchedAfterMount ? (
          <div className="k-card">
            <EmptyNote>We could not read the checks right now.</EmptyNote>
          </div>
        ) : (
          <div className="space-y-2">
            <Shimmer className="h-12 rounded-[10px]" />
            <Shimmer className="h-12 rounded-[10px]" />
            <Shimmer className="h-12 rounded-[10px]" />
          </div>
        )
      ) : rows.length === 0 ? (
        <div className="k-card flex flex-col items-center gap-3 px-4 py-8">
          <p className="k-fg3 text-center text-[13px]">No checks yet. We can suggest some from your offer.</p>
          {suggestButton}
        </div>
      ) : (
        <div className="k-card overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Check</th>
                  <th className="k-label w-[190px] px-3 py-2.5 text-left font-normal">Role</th>
                  <th className="k-label w-[120px] whitespace-nowrap px-3 py-2.5 text-right font-normal">Cost per lead</th>
                  <th className="k-label w-[110px] px-3 py-2.5 text-right font-normal">Pass rate</th>
                  <th className="k-label w-[140px] px-3 py-2.5 text-right font-normal">Status</th>
                  <th className="w-[44px] px-3 py-2.5 pr-4" aria-label="More" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <CriterionRow key={c.id} brandId={brandId} offerId={offerId} criterion={c} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

type Pressed = { enabled?: boolean; mode?: QualificationMode };

function CriterionRow({ brandId, offerId, criterion: c }: { brandId: string; offerId: string; criterion: QualificationCriterion }) {
  const qc = useQueryClient();
  // The statement just made, shown over the served value until lead-service answers.
  const [pressed, setPressed] = useState<Pressed | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setPressed(null), [c.enabled, c.mode]);

  const replaceRow = (next: QualificationCriterion | null) =>
    qc.setQueryData<QualificationCriterion[]>(criteriaKey(brandId, offerId), (old) =>
      old ? (next ? old.map((r) => (r.id === next.id ? next : r)) : old.filter((r) => r.id !== c.id)) : old,
    );

  const update = useMutation({
    mutationFn: (patch: Pressed) => updateOfferQualificationCriterion(brandId, offerId, c.id, patch),
    onMutate: (patch) => {
      setError(null);
      setPressed(patch);
    },
    onSuccess: (next) => {
      replaceRow(next);
      return qc.invalidateQueries({ queryKey: criteriaKey(brandId, offerId) });
    },
    onError: (err) => {
      console.error("[offer-qualification] update failed", { criterion: c.id, err });
      setPressed(null);
      setError("We could not save this. Try again.");
    },
  });
  const archive = useMutation({
    mutationFn: () => archiveOfferQualificationCriterion(brandId, offerId, c.id),
    onMutate: () => setError(null),
    onSuccess: () => {
      replaceRow(null);
      return qc.invalidateQueries({ queryKey: criteriaKey(brandId, offerId) });
    },
    onError: (err) => {
      console.error("[offer-qualification] archive failed", { criterion: c.id, err });
      setError("We could not archive this. Try again.");
    },
  });

  const enabled = pressed?.enabled ?? c.enabled;
  const mode = pressed?.mode ?? c.mode;
  const status = criterionStatusWord({ enabled, origin: c.origin });
  const rate = formatPassRate(c.passRate.passRate);
  const busy = update.isPending || archive.isPending;

  return (
    <tr className={`k-row k-line-subtle border-b last:border-b-0 ${archive.isPending ? "opacity-50" : ""}`}>
      <td className="px-3 py-2.5 pl-4 align-top">
        <p className={enabled ? "font-medium" : "k-fg2"}>{c.question}</p>
        {c.why && <p className="k-fg3 mt-0.5 text-[12px]">{c.why}</p>}
        {error && <p className="mt-1 text-[12px] text-[var(--data-rose)]">{error}</p>}
      </td>
      <td className="px-3 py-2.5 align-top">
        <RowMenu
          label={ROLE_LABEL[mode]}
          disabled={busy}
          align="left"
          items={(["must_pass", "mention"] as const).map((m) => ({
            key: m,
            label: ROLE_LABEL[m],
            hint: m === "must_pass" && enabled ? FILTER_SCOPE_LINE : ROLE_HINT[m],
            checked: m === mode,
            onSelect: () => m !== mode && update.mutate({ mode: m }),
          }))}
        />
      </td>
      <td className="px-3 py-2.5 text-right align-top tabular-nums">{formatCostPerLead(c.estimate.perRowUsd)}</td>
      <td className="px-3 py-2.5 text-right align-top tabular-nums">
        {rate ? (
          <>
            <span className="block">{rate}</span>
            <span className="k-fg3 block text-[12px]">of {c.passRate.checked.toLocaleString("en-US")}</span>
          </>
        ) : (
          <span className="k-fg4">{"—"}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right align-top">
        <RowMenu
          label={<StateDot running={enabled} label={status} />}
          disabled={busy}
          intro={!enabled && mode === "must_pass" ? FILTER_SCOPE_LINE : undefined}
          items={[
            {
              key: "toggle",
              label: enabled ? "Turn off" : "Turn on",
              onSelect: () => update.mutate({ enabled: !enabled }),
            },
          ]}
        />
      </td>
      <td className="px-3 py-2.5 pr-4 text-right align-top">
        <RowMenu
          label={<span aria-label="More">⋯</span>}
          ghost
          disabled={busy}
          items={[{ key: "archive", label: "Archive", onSelect: () => archive.mutate() }]}
        />
      </td>
    </tr>
  );
}

interface MenuItem {
  key: string;
  label: string;
  hint?: string;
  checked?: boolean;
  onSelect: () => void;
}

/**
 * A row control opening a small menu. The table card clips (overflow-hidden), so the menu is
 * portalled to #v2-portal and placed `fixed` against its button, above it near the bottom edge.
 */
function RowMenu({
  label,
  items,
  intro,
  disabled,
  ghost = false,
  align = "right",
}: {
  label: React.ReactNode;
  items: MenuItem[];
  intro?: string;
  disabled?: boolean;
  ghost?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<React.CSSProperties | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const dismiss = () => setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    document.addEventListener("scroll", dismiss, { capture: true, passive: true });
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
      document.removeEventListener("scroll", dismiss, { capture: true });
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);
  const toggle = () => {
    if (open || !ref.current) return setOpen(false);
    const r = ref.current.getBoundingClientRect();
    const x = align === "left" ? { left: r.left } : { right: window.innerWidth - r.right };
    setAt(window.innerHeight - r.bottom < 180 ? { ...x, bottom: window.innerHeight - r.top + 4 } : { ...x, top: r.bottom + 4 });
    setOpen(true);
  };
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
        className={ghost ? "k-btn-ghost h-7 w-7 justify-center" : "k-btn gap-1.5"}
      >
        {label}
        {!ghost && (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="k-fg3">
            <path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {open &&
        at &&
        createPortal(
          <div ref={menuRef} role="menu" style={at} className="k-popover fixed z-50 w-[260px] p-1 text-left">
            {intro && <p className="k-fg2 px-2 pb-1 pt-1.5 text-[12px]">{intro}</p>}
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                className="k-row flex w-full items-start gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px]"
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
              >
                {it.checked !== undefined && (
                  <span className={`mt-0.5 w-3 shrink-0 text-[12px] ${it.checked ? "text-[var(--accent)]" : ""}`} aria-hidden>
                    {it.checked ? "✓" : ""}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block">{it.label}</span>
                  {it.hint && <span className="k-fg3 block text-[12px]">{it.hint}</span>}
                </span>
              </button>
            ))}
          </div>,
          document.getElementById("v2-portal") ?? document.body,
        )}
    </>
  );
}
