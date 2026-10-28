/**
 * The type a brand picks for each of its accounts (owner 2026-10-28: « la possibilité
 * de créer des comptes pro (human), des comptes perso (human), ou des comptes pro (AI) »).
 * One vocabulary across every account kind: Threads (meta-service) and the linked
 * messaging accounts, WhatsApp, LinkedIn, Telegram (crm-service ACCOUNT-TYPES-1028).
 * Any number of accounts per type: no cap. Order = the picker's, Pro (AI) first.
 *
 * Alias-free on purpose, so this carries REAL unit tests.
 */
export const ACCOUNT_TYPES = [
  { value: "pro_ai", label: "Pro (AI)" },
  { value: "pro_human", label: "Pro (human)" },
  { value: "personal_human", label: "Personal (human)" },
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];

export const ACCOUNT_TYPE_VALUES = ["pro_ai", "pro_human", "personal_human"] as const;
