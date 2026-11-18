"use client";

import { useState } from "react";
import { ApiError, configureAutoTopup, disableAutoTopup, getReloadRules } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { autoTopupSentence, reloadRefusal, reloadToSave, usd } from "@/lib/v2/auto-topup-line";
import { spendConsentLines } from "@/lib/v2/spend-consent";
import { ReloadFields } from "@/components/v2/get-started/prepaid-topup";
import { SettingButton, SettingModal } from "@/components/v2/setting-modal";
import { StateDot } from "@/components/v2/ui";

/**
 * Billing's "Auto top-up" card (owner 2026-11-18, BILLING-AUTOTOPUP-MODAL-1118): one plain
 * sentence, its state in a `SettingButton`, and the change made in a `SettingModal` holding
 * the SAME reload fields as the launch payment modal (`ReloadFields`). Unticked or $0 turns
 * it off (#5995). Minimums and the default amount are billing's reload rules; a refusal is
 * said in the modal. No threshold is sent: billing reloads at $0 for everyone.
 */
export function AutoTopupCard({
  on,
  thresholdCents,
  amountCents,
  onSaved,
}: {
  on: boolean;
  thresholdCents: number | null | undefined;
  amountCents: number | null | undefined;
  /** Re-reads the account once billing answered (the modal closes after it). */
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const sentence = autoTopupSentence(on, thresholdCents, amountCents);
  return (
    <div className="k-card mt-3 flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">Auto top-up</p>
        <p className="k-fg3 mt-0.5 text-[12px] leading-[18px]">{sentence ?? "We could not read your auto top-up right now."}</p>
      </div>
      <SettingButton label="Change auto top-up" onClick={() => setOpen(true)}>
        <StateDot running={on} label={on ? "On" : "Off"} />
      </SettingButton>
      {open && (
        <AutoTopupModal
          on={on}
          amountCents={typeof amountCents === "number" ? amountCents : null}
          onClose={() => setOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function AutoTopupModal({
  on,
  amountCents,
  onClose,
  onSaved,
}: {
  on: boolean;
  amountCents: number | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const rules = useAuthQuery(["reloadRules"], () => getReloadRules());
  // Off: the box opens ticked on billing's default, so one Save turns it on.
  const [reloadOn, setReloadOn] = useState(true);
  const [typed, setTyped] = useState<string | null>(on && amountCents !== null ? String(amountCents / 100) : null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const amount = typed ?? (rules.data ? String(rules.data.default_reload_amount_cents / 100) : "");
  const checked = rules.data ? reloadToSave({ on: reloadOn, amount }, rules.data.reload_amount_minimum_cents) : null;
  const cents = checked && "cents" in checked ? checked.cents : null;
  const changed = cents !== null && (on ? cents !== amountCents : cents !== 0);
  // The owner-approved statement of what the card pays, shown before Save (consent lives here, not on the card).
  const statement =
    cents !== null && cents > 0 ? spendConsentLines({ arm: { kind: "prepaid", topupUsd: cents / 100, reload: { amountUsd: cents / 100 } } })[0].text : null;

  async function save() {
    if (cents === null) return;
    setSaving(true);
    setFailure(null);
    try {
      if (cents === 0) await disableAutoTopup();
      else await configureAutoTopup(cents);
    } catch (err) {
      console.error("[billing v2] auto top-up save failed", { cents, err });
      setFailure(err instanceof ApiError ? reloadRefusal(err.status, err.body) : reloadRefusal(null, null));
      setSaving(false);
      return;
    }
    await onSaved();
    setSaving(false);
    onClose();
  }

  return (
    <SettingModal title="Auto top-up" onClose={onClose} onSave={() => void save()} saving={saving} canSave={changed} failure={failure}>
      {rules.isError ? (
        <p className="text-[13px] text-[var(--data-rose)]">We could not load the reload amounts. Close and try again.</p>
      ) : !rules.data ? (
        <p className="k-fg3 text-[13px]">Loading your reload amounts.</p>
      ) : (
        <div className="grid gap-3">
          <ReloadFields
            on={reloadOn}
            onOn={(next) => {
              setReloadOn(next);
              setFailure(null);
            }}
            amount={amount}
            onAmount={(v) => {
              setTyped(v);
              setFailure(null);
            }}
            problem={checked && "problem" in checked ? checked.problem : null}
            disabled={saving}
          />
          {cents !== null && (
            <p className="k-fg3 text-[12px] leading-[18px]">
              {statement ??
                (on
                  ? "Saving turns auto top-up off. Your campaigns pause when your balance reaches $0."
                  : `Your campaigns pause when your balance reaches $0. Turn it on from ${usd(rules.data.reload_amount_minimum_cents)}.`)}
            </p>
          )}
        </div>
      )}
    </SettingModal>
  );
}
