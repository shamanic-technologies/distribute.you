"use client";

import { useEffect, useState } from "react";
import { validateInvite, requestWaitlistAccess } from "@/lib/invites/api";
import { INVITE_COOKIE_NAME } from "@/lib/invite-cookie";

interface GetStartedFormProps {
  signUpUrl: string;
  initialInvite: string | null;
}

type ValidateState =
  | { kind: "idle" }
  | { kind: "validating" }
  | { kind: "valid"; inviterOrgName?: string }
  | { kind: "invalid"; message: string };

type WaitlistState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "submitted"; position: number }
  | { kind: "error"; message: string };

function readClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const target = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      return decodeURIComponent(trimmed.slice(target.length));
    }
  }
  return null;
}

export function GetStartedForm({ signUpUrl, initialInvite }: GetStartedFormProps) {
  const cookieValue = typeof window !== "undefined" ? readClientCookie(INVITE_COOKIE_NAME) : null;
  const seedInvite = initialInvite || cookieValue || "";

  const [inviteCode, setInviteCode] = useState(seedInvite);
  const [validateState, setValidateState] = useState<ValidateState>({ kind: "idle" });

  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistBrand, setWaitlistBrand] = useState("");
  const [waitlistState, setWaitlistState] = useState<WaitlistState>({ kind: "idle" });

  useEffect(() => {
    const trimmed = inviteCode.trim().toLowerCase();
    if (!trimmed) {
      setValidateState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setValidateState({ kind: "validating" });
    validateInvite(trimmed)
      .then((res) => {
        if (cancelled) return;
        if (res.valid) {
          setValidateState({ kind: "valid", inviterOrgName: res.inviterOrgName });
        } else {
          setValidateState({
            kind: "invalid",
            message:
              "This invite is not active. Either the code is wrong or it has already been used 3 times.",
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("[landing] invite validate failed", err);
        setValidateState({
          kind: "invalid",
          message: "We could not validate this code right now. Try again or request access below.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  function onContinue(e: React.FormEvent) {
    e.preventDefault();
    if (validateState.kind !== "valid") return;
    const params = new URLSearchParams({ invite: inviteCode.trim().toLowerCase() });
    window.location.href = `${signUpUrl}?${params.toString()}`;
  }

  async function onWaitlistSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!waitlistEmail.trim() || !waitlistBrand.trim()) return;
    setWaitlistState({ kind: "submitting" });
    try {
      const res = await requestWaitlistAccess({
        email: waitlistEmail.trim(),
        brandUrl: waitlistBrand.trim(),
      });
      setWaitlistState({ kind: "submitted", position: res.position });
    } catch (err: unknown) {
      console.error("[landing] waitlist request failed", err);
      setWaitlistState({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Door 1 — Invite code */}
      <form
        onSubmit={onContinue}
        className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 flex flex-col"
      >
        <h2 className="font-display text-xl font-semibold text-gray-900 mb-2">
          I have an invite
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          Enter the code your friend gave you, or paste it from a sales call link.
        </p>
        <label htmlFor="invite-code" className="text-xs font-medium text-gray-600 mb-1.5">
          Invite code
        </label>
        <input
          id="invite-code"
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="e.g. stripe-com"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base"
          autoCapitalize="off"
          autoCorrect="off"
        />
        <div className="mt-2 min-h-[1.25rem] text-xs">
          {validateState.kind === "validating" && (
            <span className="text-gray-400">Checking…</span>
          )}
          {validateState.kind === "valid" && (
            <span className="text-emerald-600">
              Valid invite{validateState.inviterOrgName ? ` from ${validateState.inviterOrgName}` : ""}.
            </span>
          )}
          {validateState.kind === "invalid" && (
            <span className="text-red-500">{validateState.message}</span>
          )}
        </div>
        <button
          type="submit"
          disabled={validateState.kind !== "valid"}
          className="mt-5 w-full px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </form>

      {/* Door 2 — Request access */}
      <form
        onSubmit={onWaitlistSubmit}
        className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 flex flex-col"
      >
        {waitlistState.kind === "submitted" ? (
          <div className="flex flex-col items-start gap-4">
            <h2 className="font-display text-xl font-semibold text-gray-900">
              You&apos;re on the waitlist
            </h2>
            <p className="text-3xl font-bold text-gray-900">
              #{waitlistState.position.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">
              We onboard new users 1-on-1 — we&apos;ll email you when your spot opens.
            </p>
            <div className="text-xs text-gray-500 border-t border-gray-100 pt-3 mt-1 w-full">
              <span className="font-medium text-gray-700">Skip the line:</span> ask a
              friend already on distribute to share their invite link. Each invite =
              $25 in credit for both sides.
            </div>
          </div>
        ) : (
          <>
            <h2 className="font-display text-xl font-semibold text-gray-900 mb-2">
              Request access
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              We onboard each new user 1-on-1. Leave us your email — we&apos;ll be in
              touch within 48 hours.
            </p>
            <label htmlFor="waitlist-email" className="text-xs font-medium text-gray-600 mb-1.5">
              Work email
            </label>
            <input
              id="waitlist-email"
              type="email"
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              placeholder="you@yourbrand.com"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base"
            />
            <label
              htmlFor="waitlist-brand"
              className="text-xs font-medium text-gray-600 mb-1.5 mt-4"
            >
              Brand URL
            </label>
            <input
              id="waitlist-brand"
              type="text"
              value={waitlistBrand}
              onChange={(e) => setWaitlistBrand(e.target.value)}
              placeholder="yourbrand.com"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base"
              autoCapitalize="off"
              autoCorrect="off"
            />
            {waitlistState.kind === "error" && (
              <p className="text-xs text-red-500 mt-2">{waitlistState.message}</p>
            )}
            <button
              type="submit"
              disabled={waitlistState.kind === "submitting"}
              className="mt-5 w-full px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition font-medium disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {waitlistState.kind === "submitting" ? "Submitting…" : "Request access"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
