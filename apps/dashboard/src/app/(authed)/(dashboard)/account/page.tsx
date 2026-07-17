"use client";

import Image from "next/image";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { PhoneInput, EMPTY_PHONE, type PhoneValue } from "@/components/onboarding/phone-input";

// `@clerk/types` isn't a direct dependency here, so derive the phone resource
// type from the `useUser()` return (element of `user.phoneNumbers`).
type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;
type PhoneNumberResource = ClerkUser["phoneNumbers"][number];
import { MaturityBadge } from "@/components/maturity-badge";
import { useIsBetaUser } from "@/lib/use-beta-user";

/**
 * User-level Profile page (opened from the top-right avatar → "Profile").
 *
 * Shows read-only identity (avatar / name / email) for everyone, plus a
 * BETA-gated phone-number editor with SMS verification. Phone lives behind the
 * beta allowlist because the Clerk instance does not yet have the phone-number
 * factor enabled, so "Send code" would error for customers — the gate keeps the
 * flow staff-only (Kevin) until it's activated on Clerk. Per the dashboard beta
 * rule, the gated surface carries a visible <MaturityBadge>. Name/email stay
 * read-only (Clerk owns email verification; only phone was requested).
 */
export default function AccountPage() {
  const { isLoaded, user } = useUser();

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <div className="h-8 w-40 animate-pulse rounded bg-gray-100" />
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <p className="text-sm text-gray-500">You are not signed in.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
      <p className="mt-1 text-sm text-gray-500">Your account information.</p>

      {/* Account info — read-only */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-4">
          {user.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt={user.firstName || "User"}
              width={56}
              height={56}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100">
              <span className="text-xl font-medium text-brand-600">{user.firstName?.[0] || "U"}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-gray-900">{user.fullName || "—"}</p>
            <p className="truncate text-sm text-gray-500">{user.primaryEmailAddress?.emailAddress}</p>
          </div>
        </div>
      </div>

      <PhoneSection />
    </div>
  );
}

/** Beta-gated Clerk-native phone editor with SMS verification. */
function PhoneSection() {
  const isBeta = useIsBetaUser();
  const { user } = useUser();

  const [mode, setMode] = useState<"idle" | "entering" | "verifying">("idle");
  const [phone, setPhone] = useState<PhoneValue>(EMPTY_PHONE);
  const [pending, setPending] = useState<PhoneNumberResource | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sub-element gate: page stays GA, the phone card is hidden from non-beta.
  if (!isBeta || !user) return null;

  const verifiedPhones = user.phoneNumbers.filter((p) => p.verification?.status === "verified");

  function e164(v: PhoneValue): string {
    const national = v.national.replace(/\D/g, "");
    const dial = v.dialCode.replace(/\D/g, "");
    return `+${dial}${national}`;
  }

  async function sendCode() {
    const national = phone.national.replace(/\D/g, "");
    if (!national) {
      setError("Enter a phone number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await user!.createPhoneNumber({ phoneNumber: e164(phone) });
      await created.prepareVerification();
      setPending(created);
      setCode("");
      setMode("verifying");
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!pending) return;
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter the code we texted you.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await pending.attemptVerification({ code: trimmed });
      await user!.update({ primaryPhoneNumberId: pending.id });
      await user!.reload();
      resetToIdle();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    // Destroy the just-created but unverified number so it doesn't orphan.
    if (pending && pending.verification?.status !== "verified") {
      try {
        await pending.destroy();
      } catch {
        // best-effort cleanup; a failed destroy still leaves the user able to retry
      }
    }
    resetToIdle();
  }

  async function removePhone(p: PhoneNumberResource) {
    setBusy(true);
    setError(null);
    try {
      await p.destroy();
      await user!.reload();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function resetToIdle() {
    setPending(null);
    setPhone(EMPTY_PHONE);
    setCode("");
    setMode("idle");
    setBusy(false);
  }

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-gray-900">Phone number</h2>
        <MaturityBadge level="beta" />
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Add a phone number and confirm it with the code we text you.
      </p>

      {verifiedPhones.length > 0 && (
        <ul className="mt-4 space-y-2">
          {verifiedPhones.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
            >
              <span className="text-sm text-gray-900">
                {p.phoneNumber}
                {p.id === user.primaryPhoneNumberId && (
                  <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
                    Primary
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => removePhone(p)}
                disabled={busy}
                className="text-sm text-red-600 transition hover:text-red-700 disabled:opacity-40"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {mode === "idle" && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setPhone(EMPTY_PHONE);
            setMode("entering");
          }}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          {verifiedPhones.length > 0 ? "Add another number" : "Add phone number"}
        </button>
      )}

      {mode === "entering" && (
        <div className="mt-4 space-y-3">
          <PhoneInput value={phone} onChange={setPhone} autoFocus />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={sendCode}
              disabled={busy}
              className={`rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition ${
                busy ? "cursor-wait" : "hover:bg-brand-700"
              }`}
            >
              {busy ? "Sending…" : "Send code"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="text-sm text-gray-500 transition hover:text-gray-700 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "verifying" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-600">
            We texted a code to <span className="font-medium text-gray-900">{pending?.phoneNumber}</span>.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Verification code"
            autoFocus
            className="w-full max-w-[220px] rounded-xl border border-gray-200 px-4 py-3 text-base tracking-widest text-gray-900 focus:border-brand-400 focus:outline-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={verify}
              disabled={busy}
              className={`rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition ${
                busy ? "cursor-wait" : "hover:bg-brand-700"
              }`}
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="text-sm text-gray-500 transition hover:text-gray-700 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** Prefer Clerk's field-level message; fall back to a generic one. Never swallow. */
function errMessage(err: unknown): string {
  if (err && typeof err === "object" && "errors" in err) {
    const arr = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    const first = arr?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}
