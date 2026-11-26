import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { languageName, readTranslatePref, shownWords, translationPairKey, translationsByKey, writeTranslatePref } from "../src/lib/unibox-translate";

const item = (over: Partial<{ subject: string | null; text: string | null }> = {}) => ({
  at: "2026-11-24T11:09:00Z",
  source: "instantly",
  direction: "outbound",
  from: "kevin.lourd@growthagency.agency",
  subject: "Flohsamenschalen aus St. Gallen",
  text: "Guten Tag Frau Renggli,\n\nIhre Kunden fragen nach Flohsamen.",
  ...over,
});

describe("Unibox Translate to English (UNIBOX-TRANSLATE-1126)", () => {
  it("is on by default and remembers off", () => {
    expect(readTranslatePref(null)).toBe(true);
    expect(readTranslatePref(writeTranslatePref(false))).toBe(false);
    expect(readTranslatePref(writeTranslatePref(true))).toBe(true);
  });

  it("pairs a translated item with the plain one on what it is, and shows the English words", () => {
    const translated = {
      ...item(),
      translation: { status: "translated", sourceLanguage: "de", subject: "Psyllium husks from St. Gallen", text: "Hello Ms Renggli,\n\nYour customers ask for psyllium." },
    };
    const map = translationsByKey([translated]);
    const plain = item();
    const t = map.get(translationPairKey(plain)) ?? null;
    const shown = shownWords(plain, t);
    expect(shown.subject).toBe("Psyllium husks from St. Gallen");
    expect(shown.text).toContain("\n\n");
    // The stored item never changes: toggle off = the original.
    expect(plain.text).toContain("Guten Tag");
  });

  it("keeps the original for an English or failed message", () => {
    const map = translationsByKey([
      { ...item({ text: "Hi" }), translation: { status: "already_english", subject: null, text: "Hi" } },
      { ...item({ text: "Hallo" }), translation: { status: "failed", subject: null, text: null } },
    ]);
    expect(map.size).toBe(0);
    expect(shownWords(item(), null).text).toContain("Guten Tag");
  });

  it("names the language", () => {
    expect(languageName("de")).toBe("German");
    expect(languageName(null)).toBeNull();
  });

  it("asks the translation only for the open thread, never in the preload", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/integrations-conversations.tsx"), "utf8");
    const preload = src.slice(src.indexOf("const preload = (r: UniboxRow)"), src.indexOf("const top = (rows ?? []).slice(0, PRELOAD_TOP)"));
    expect(preload).not.toContain("translatedTimelineQuery");
    expect(src).toContain("enabled: gate && !!brandId && translate");
  });
});
