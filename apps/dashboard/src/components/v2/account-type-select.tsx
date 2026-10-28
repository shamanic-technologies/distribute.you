"use client";

import { ACCOUNT_TYPES, type AccountType } from "@/lib/account-types";

/**
 * The one type picker for an account (Threads, WhatsApp, LinkedIn, Telegram): Pro (AI),
 * Pro (human), Personal (human). An account the producer has not typed yet shows
 * "Pick a type" until one is chosen. The caller owns the write.
 */
export function AccountTypeSelect({
  id,
  label,
  value,
  disabled,
  onChange,
  className = "k-input",
}: {
  id: string;
  /** Screen-reader label, e.g. "Account type of @handle". */
  label: string;
  value: AccountType | null;
  disabled?: boolean;
  onChange: (next: AccountType) => void;
  className?: string;
}) {
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value as AccountType);
        }}
        className={className}
      >
        {value === null ? (
          <option value="" disabled>
            Pick a type
          </option>
        ) : null}
        {ACCOUNT_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </>
  );
}
