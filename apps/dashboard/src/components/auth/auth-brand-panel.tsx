"use client";

import Image from "next/image";
import Link from "next/link";
import { GiftIcon } from "@heroicons/react/24/outline";

/**
 * The left column of /sign-up and /sign-in.
 *
 * ONE component, mounted by both pages. The two carried byte-identical copies of
 * a dark panel from a retired charter, down to a hardcoded mono face and a beta
 * chip, so they drifted from the landing together and would have drifted from
 * each other next. The retired strings are named in the guard, never here: this
 * file is one of the sources that guard reads.
 *
 * Every string here is the SERVED landing's own, verbatim from
 * `apps/landing/public/landing/index-v2.html`: the headline, the offer pill and
 * the proof line. A visitor reads them on `/`, clicks through, and reads the same
 * sentences on the signup screen rather than a second, older pitch.
 *
 * Colour rides the `brand-*` ramp, never a literal hex or oklch: a customer's
 * dashboard re-declares that ramp at their own hue (`:root[data-brand-tint]`), so
 * an arbitrary-value charter blue would be the one control that never rotates.
 * Every class used here carries an `html.dark` remap in globals.css, checked
 * rather than assumed.
 */
export function AuthBrandPanel() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden border-r border-gray-200 bg-gray-50 p-12 lg:flex lg:w-1/2">
      {/* The landing's hero glow, rebuilt from a remapped ramp step so it tints
          with the brand and survives the dark surface. `opacity-40` is the
          standalone utility, NOT a `/40` colour modifier: a modifier compiles to
          a different class name, which the dark remap cannot reach. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-brand-100 opacity-40 blur-3xl"
      />

      <Link
        href="https://distribute.you"
        className="relative z-10 inline-flex items-center gap-3 self-start"
      >
        <Image
          src="/logo-distribute.svg"
          alt="distribute.you"
          width={32}
          height={32}
        />
        <span className="font-display text-lg font-medium tracking-tight text-gray-900">
          distribute.you
        </span>
      </Link>

      <div className="relative z-10">
        <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm text-gray-900">
          <GiftIcon className="h-4 w-4 shrink-0 text-brand-600" />
          First $30 free, no commitment
        </p>
        <h2 className="mt-6 font-display text-4xl leading-none tracking-[-0.04em] text-gray-900 xl:text-5xl">
          Get <span className="text-brand-600">revenue in 24h</span>
          <br />
          From $1/day
        </h2>
        <p className="mt-5 max-w-md text-lg leading-snug text-gray-500">
          We run multiple acquisition channels for you and you keep the one
          working the best.
        </p>
      </div>

      <p className="relative z-10 max-w-sm text-sm leading-6 text-gray-500">
        We read what you sell, contact your audience, and get booked meetings for
        you.
      </p>
    </div>
  );
}
