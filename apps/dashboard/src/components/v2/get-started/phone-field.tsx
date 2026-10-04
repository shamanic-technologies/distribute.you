"use client";

import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { COUNTRIES, DEFAULT_COUNTRY, codeToFlag, type PhoneCountry } from "@/components/onboarding/phone-countries";
import type { PhoneValue } from "@/components/onboarding/phone-input";

/**
 * The wall's phone field in Keel dress: a native country select (searchable by typing
 * on every platform, the OS picker on a phone) beside the national number. The rule
 * that decides what a valid number is lives in `lib/phone-syntax.ts`; this only
 * renders the sentence it is handed.
 */
export function PhoneField({
  value,
  onChange,
  onBlur,
  problem,
  disabled,
}: {
  value: PhoneValue;
  onChange: (v: PhoneValue) => void;
  onBlur: () => void;
  problem: string | null;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-stretch gap-2">
        <label className="relative shrink-0">
          <span className="sr-only">Country</span>
          {/* Inline padding: keel is unlayered, so a Tailwind `pr-*` on a `k-input` loses. */}
          <span className="k-input k-cta-input pointer-events-none flex items-center gap-1.5 tabular-nums" style={{ paddingRight: 30 }} aria-hidden="true">
            <span className="text-[16px] leading-none">{codeToFlag(value.countryCode)}</span>+{value.dialCode}
          </span>
          <ChevronDownIcon className="k-fg3 pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
          <select
            className="absolute inset-0 cursor-pointer opacity-0"
            value={value.countryCode}
            disabled={disabled}
            onChange={(e) => {
              const c = COUNTRIES.find((x) => x.code === e.target.value) ?? DEFAULT_COUNTRY;
              onChange({ ...value, countryCode: c.code, dialCode: c.dial });
            }}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{`${c.name} (+${c.dial})`}</option>
            ))}
          </select>
        </label>
        <input
          className="k-input k-cta-input min-w-0 flex-1"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="Phone number"
          aria-label="Phone number"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? "get-started-phone-problem" : undefined}
          value={value.national}
          onChange={(e) => onChange({ ...value, national: e.target.value })}
          onBlur={onBlur}
          disabled={disabled}
          autoFocus
        />
      </div>
      {problem && (
        <p id="get-started-phone-problem" role="alert" className="text-[12px] text-[var(--data-rose)]">
          {problem}
        </p>
      )}
    </div>
  );
}

/** The visitor's own country when the browser names one we list, else the default. */
export function browserPhoneCountry(language: string | undefined): PhoneCountry {
  const region = (language ?? "").split(/[-_]/)[1]?.toUpperCase();
  return COUNTRIES.find((c) => c.code === region) ?? DEFAULT_COUNTRY;
}
