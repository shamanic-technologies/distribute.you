/**
 * Unibox "Translate to English" (owner 2026-11-26, UNIBOX-TRANSLATE-1126): every message of
 * an opened thread reads in English, on by default; off shows the original at once.
 * crm-service translates and stores each message once (`?translate=en` on the person
 * timeline), billed to the org whose Unibox it is. This module only pairs a served
 * translation with the message on screen and names the language. Alias-free (unit tested).
 */

/** The browser keeps the reader's choice; absent = on (owner: « Toggle ON by default »). */
export const UNIBOX_TRANSLATE_STORAGE_KEY = "unibox-translate-en";

export function readTranslatePref(stored: string | null): boolean {
  return stored !== "off";
}

export function writeTranslatePref(on: boolean): string {
  return on ? "on" : "off";
}

export type ServedTranslation = {
  status: string;
  sourceLanguage?: string | null;
  subject?: string | null;
  text?: string | null;
};

type Translatable = {
  at: string | null;
  source: string;
  direction: string | null;
  from: string | null;
  subject: string | null;
  text: string | null;
};

/**
 * One message's identity across the plain and the translated read: the two reads page the
 * same thread separately, so items pair on what they ARE (when, where, who, the words),
 * never on their position in a page.
 */
export function translationPairKey(item: Translatable): string {
  return [item.at ?? "", item.source, item.direction ?? "", item.from ?? "", item.subject ?? "", item.text ?? ""].join("\u0001");
}

/** Every translated message of the served pages, by pair key. Only `translated` ones: the rest show the original. */
export function translationsByKey(items: Array<Translatable & { translation?: ServedTranslation | null }>): Map<string, ServedTranslation> {
  const out = new Map<string, ServedTranslation>();
  for (const item of items) {
    if (item.translation?.status === "translated") out.set(translationPairKey(item), item.translation);
  }
  return out;
}

/** The words to show: the English version where one is served, else the original, untouched. */
export function shownWords<T extends Translatable>(item: T, translation: ServedTranslation | null): T {
  if (!translation || translation.status !== "translated") return item;
  return {
    ...item,
    subject: item.subject == null ? null : (translation.subject ?? item.subject),
    text: item.text == null ? null : (translation.text ?? item.text),
  };
}

/** "German" for "de"; the code itself when the browser does not know it; null when unknown. */
export function languageName(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    // An invalid tag (not a BCP 47 code): show it as served.
    return code;
  }
}
