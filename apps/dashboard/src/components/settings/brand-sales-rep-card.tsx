"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  clearBrandSalesRep,
  getBrandSalesRep,
  setBrandSalesRep,
  NO_SALES_REP,
  type SalesRep,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { SettingsSaveRow } from "@/components/settings/settings-save-row";

// The one person to reach when a prospect says they are interested, and the two
// facts about them.
//
// The EMAIL is what the rest of the fleet uses: the moment a positive reply
// lands, the whole thread is forwarded to it, and every automatic answer we send
// back into that prospect's thread carries it in visible copy. The PHONE is the
// escalation on top — within the minute, it rings.
//
// ⚠️ A PHONE REQUIRES AN EMAIL, and that rule is brand-service's, not this
// card's. A rep with an email and no phone is legitimate and useful (copied on
// everything, never rung) — the AI meeting-booking channel wants exactly that.
// The reverse is refused, because a number that rings with nowhere to send the
// conversation is half a rep. The field below is marked required and Save is
// held while a phone has no email BESIDE it, but the producer's 400 is what
// decides: this is a courtesy so the customer is not refused after the fact,
// never a second copy of the rule.
//
// One rep per BRAND, and that grain is the whole design. A campaign is
// (offer x funnel x channel), so a number stored per campaign is the same fact
// retyped once per channel selling one offer — four rows on the brand this was
// built for, drifting from the first edit — and a brand with no campaign yet
// could declare nothing at all. The rep answers for the brand.
//
// NOT SET is a first-class state, not an empty form. Most brands will never
// state a rep, and that reads as "nobody to reach" rather than as something
// unfinished — so the card says so in words instead of leaving two blank boxes
// to interpret.
//
// ⚠️ THE WRITE REPLACES THE WHOLE REP. Omitting the phone CLEARS a number that
// was there. So both fields always travel together, and Save sends what is on
// screen rather than a diff — brand-service's own semantic, not worked around.

/** brand-service writes the sentence; `err.message` is the whole downstream body verbatim. */
function saveErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: number }).status;
    const body = (err as { body?: { error?: string } }).body;
    if (status === 400 && body?.error) return body.error;
    if (status === 403) return "You do not have access to this brand.";
    if (status === 404) return "This brand no longer exists.";
  }
  return "Could not save the rep. Try again in a moment.";
}

/** True once there is a rep at all — either fact stated is a rep. */
function hasRep(rep: SalesRep): boolean {
  return Boolean(rep.salesRepEmail || rep.salesRepPhone);
}

export function BrandSalesRepCard({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();

  const { data, isPending, isError } = useAuthQuery(["brandSalesRep", brandId], () =>
    getBrandSalesRep(brandId),
  );

  // The last SAVED rep, and the live fields. `dirty` is a live compare against
  // that baseline, never a sticky edited latch — typing a change and undoing it
  // has to disarm Save again.
  const saved = data ?? NO_SALES_REP;
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  // Re-seed when the payload is a DIFFERENT object than the one the fields were
  // built from. The first payload to settle is the on-disk one, so a once-per-mount
  // latch would seed from the previous visit and ignore the fresher server answer.
  // Identity, not deep equality: React Query returns the same reference when
  // nothing changed, so an unchanged refetch costs nothing and cannot loop.
  const seededFrom = useRef<object | null>(null);
  const touched = useRef(false);
  useEffect(() => {
    if (data === undefined) return;
    const token = { data };
    if (seededFrom.current !== null && touched.current) return;
    seededFrom.current = token;
    setEmail(data.salesRepEmail ?? "");
    setPhone(data.salesRepPhone ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: (next: { email: string; phone: string }) => {
      const salesRepEmail = next.email.trim() || null;
      const salesRepPhone = next.phone.trim() || null;
      // Both blank is not an empty write, it is a REMOVAL — and DELETE is the
      // idempotent way to say so.
      if (!salesRepEmail && !salesRepPhone) return clearBrandSalesRep(brandId);
      return setBrandSalesRep(brandId, { salesRepEmail, salesRepPhone });
    },
    onSuccess: (next) => {
      // The response IS what this query reads, so write it rather than invalidating:
      // a re-read is a second round trip to learn what we were just told.
      queryClient.setQueryData(["brandSalesRep", brandId], next);
      touched.current = false;
      setEmail(next.salesRepEmail ?? "");
      setPhone(next.salesRepPhone ?? "");
      setJustSaved(true);
    },
    onError: (err) => {
      console.error("[dashboard] setBrandSalesRep failed", err);
    },
  });

  const dirty =
    email.trim() !== (saved.salesRepEmail ?? "") ||
    phone.trim() !== (saved.salesRepPhone ?? "");

  // The one thing held locally, and only to spare the customer a refusal after
  // the fact. brand-service decides; this just does not send what it will reject.
  const phoneWithoutEmail = phone.trim().length > 0 && email.trim().length === 0;

  const touch = () => {
    touched.current = true;
    setJustSaved(false);
  };

  if (isPending) {
    return (
      <div className="p-5">
        <div className="h-4 w-64 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-10 w-full max-w-sm animate-pulse rounded-lg bg-gray-100" />
        <div className="mt-4 h-10 w-full max-w-sm animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="p-5">
      <p className="mb-4 text-sm text-gray-600">
        When someone replies to one of this brand&apos;s campaigns saying they are interested, we
        send the whole conversation to this person straight away, and copy them on the replies we
        send back on your behalf. Give us a number as well and we ring them too, within the minute.
      </p>

      <label htmlFor="sales-rep-email" className="mb-1.5 block text-sm font-medium text-gray-800">
        Email to copy
      </label>
      <input
        id="sales-rep-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => {
          touch();
          setEmail(e.target.value);
        }}
        placeholder="dev@yourcompany.com"
        className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
      <p className="mt-1.5 text-xs text-gray-500">
        One address. Leave it empty and nobody is copied or rung.
      </p>

      <label
        htmlFor="sales-rep-phone"
        className="mb-1.5 mt-5 block text-sm font-medium text-gray-800"
      >
        Number to ring <span className="font-normal text-gray-500">(optional)</span>
      </label>
      <input
        id="sales-rep-phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={phone}
        onChange={(e) => {
          touch();
          setPhone(e.target.value);
        }}
        placeholder="+33 7 70 65 75 85"
        className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
      <p className="mt-1.5 text-xs text-gray-500">
        Include the country code. Leave it empty and this person is copied but never rung.
      </p>

      {phoneWithoutEmail && (
        <p className="mt-3 text-sm text-gray-600">
          Add the email as well. We ring the number to say a buyer is interested, so we need
          somewhere to send the conversation itself.
        </p>
      )}

      {isError && (
        <p className="mt-3 text-sm text-gray-600">
          We could not read the current rep. Nothing was changed.
        </p>
      )}

      {save.isError && <p className="mt-3 text-sm text-red-600">{saveErrorMessage(save.error)}</p>}

      {!dirty && !hasRep(saved) && !justSaved && (
        <p className="mt-3 text-sm text-gray-500">
          No rep set, so nobody is copied or rung when a reply lands.
        </p>
      )}

      <SettingsSaveRow
        dirty={dirty}
        saving={save.isPending}
        saved={justSaved && !dirty}
        disabled={phoneWithoutEmail}
        onSave={() => save.mutate({ email, phone })}
      />
    </div>
  );
}
