"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { WELCOME_STEPS } from "@/lib/onboarding-content";
import { welcomeSeenKey } from "@/lib/onboarding-reminders";

/**
 * First-visit welcome flow: a 5-card guided carousel shown once per user.
 * Rebuilt in the landing design system (indigo brand accent, Inter + JetBrains
 * Mono, mono eyebrow pill, gradient headline, soft card depth) so it reads as
 * the same product as distribute.you. Fires on mount when the per-user
 * localStorage flag is absent; on finish or skip it sets the flag and calls
 * `onComplete` so the reminder modals take over. Self-contained, no backend
 * write (the org-level onboardingComplete gate already passed; this is a
 * dashboard reassurance flow, not a routing gate).
 */

// Mono eyebrow label per step (the landing's section-label signature).
const STEP_EYEBROWS = [
  "Welcome",
  "Free credits",
  "How it works",
  "What happens next",
  "Your first move",
];

// Steps that lead with a gradient headline (the landing's hero treatment).
const GRADIENT_TITLE_STEPS = new Set([0, WELCOME_STEPS.length - 1]);

export function WelcomeTour({ onComplete }: { onComplete?: () => void }) {
  const { user, isLoaded } = useUser();
  const completedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [entered, setEntered] = useState(false);

  // Open once per user when the seen-flag is absent.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isLoaded || !user) return;
    if (localStorage.getItem(welcomeSeenKey(user.id))) return;
    setOpen(true);
  }, [isLoaded, user]);

  // Drive the enter transition on the next frame after mount.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (user) localStorage.setItem(welcomeSeenKey(user.id), "1");
    setOpen(false);
    onComplete?.();
  };

  // Escape closes (matches the old allowClose behavior).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" && index < WELCOME_STEPS.length - 1)
        setIndex((i) => i + 1);
      if (e.key === "ArrowLeft" && index > 0) setIndex((i) => i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  if (!open) return null;

  const step = WELCOME_STEPS[index];
  const isLast = index === WELCOME_STEPS.length - 1;
  const isFirst = index === 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to distribute"
    >
      {/* Backdrop — soft brand wash + blur, click to dismiss. */}
      <button
        aria-label="Close"
        onClick={finish}
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className={`relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl transition-all duration-300 ${
          entered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        {/* Soft landing wash behind the header zone. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 gradient-bg opacity-60" />

        {/* Close */}
        <button
          onClick={finish}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="relative p-7 sm:p-8">
          {/* Eyebrow */}
          <span className="dy-eyebrow mb-4">
            <span className="dy-dot" />
            {STEP_EYEBROWS[index] ?? "Getting started"}
          </span>

          {/* Title */}
          <h2
            className={`font-display text-2xl leading-tight tracking-tight text-gray-900 ${
              GRADIENT_TITLE_STEPS.has(index) ? "gradient-text" : ""
            }`}
          >
            {step.title}
          </h2>

          {/* Description (HTML: prose, timeline list, example email). */}
          <div
            className="welcome-step-body mt-3 text-sm leading-6 text-gray-600"
            dangerouslySetInnerHTML={{ __html: step.description }}
          />

          {/* Footer: progress dots + nav */}
          <div className="mt-7 flex items-center justify-between">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {WELCOME_STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? "w-5 bg-brand-600" : "w-1.5 bg-gray-200"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-gray-800"
                >
                  Back
                </button>
              )}
              <button
                onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                {isLast ? "Get started" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
