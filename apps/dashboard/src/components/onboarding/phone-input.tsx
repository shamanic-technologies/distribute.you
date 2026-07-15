"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  codeToFlag,
  searchCountries,
  type PhoneCountry,
} from "./phone-countries";

export type PhoneValue = { countryCode: string; dialCode: string; national: string };

export const EMPTY_PHONE: PhoneValue = {
  countryCode: DEFAULT_COUNTRY.code,
  dialCode: DEFAULT_COUNTRY.dial,
  national: "",
};

/**
 * Dependency-free international phone input: a searchable country dropdown
 * (flag + name + dial code) beside a national-number field. Controlled — the
 * parent owns the { countryCode, dialCode, national } value. Optional by
 * design: an empty national number is valid (the onboarding step skips the
 * write).
 */
export function PhoneInput({
  value,
  onChange,
  autoFocus = false,
}: {
  value: PhoneValue;
  onChange: (v: PhoneValue) => void;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected: PhoneCountry =
    COUNTRIES.find((c) => c.code === value.countryCode) ?? DEFAULT_COUNTRY;
  const results = searchCountries(query);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Focus the search box the moment the dropdown opens ("easy to search").
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  function pick(c: PhoneCountry) {
    onChange({ countryCode: c.code, dialCode: c.dial, national: value.national });
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-900 transition hover:border-gray-300 focus:border-brand-400 focus:outline-none"
        >
          <span className="text-lg leading-none">{codeToFlag(selected.code)}</span>
          <span className="font-medium text-gray-600">+{selected.dial}</span>
          <ChevronDownIcon className="h-4 w-4 text-gray-400" />
        </button>
        <input
          type="tel"
          inputMode="tel"
          autoFocus={autoFocus}
          value={value.national}
          onChange={(e) => onChange({ ...value, national: e.target.value })}
          placeholder="Phone number"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 focus:border-brand-400 focus:outline-none"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="w-full bg-transparent text-sm text-gray-900 focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {results.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-400">No match</div>
            ) : (
              results.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => pick(c)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-gray-50 ${
                    c.code === selected.code ? "bg-brand-50" : ""
                  }`}
                >
                  <span className="text-lg leading-none">{codeToFlag(c.code)}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-900">{c.name}</span>
                  <span className="shrink-0 text-gray-400">+{c.dial}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
