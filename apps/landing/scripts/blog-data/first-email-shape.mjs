// How the FIRST email of a sequence is laid out and how it opens, read on its own text
// (content-generation's step 1 bodyText). Deterministic, so the Research page's layout and
// opening studies are reproducible by re-running the scripts: no model is asked anything.
//
// The model writing our emails chose both on its own until the templates forced a greeting and
// blank-line paragraphs (2026-09-28), and it split about in half. These rules name what it did.

// Layout: a blank line between two blocks of text is a paragraph break; a single line break is
// not; no break at all is one block.
export const LAYOUT = {
  block: "One block",
  lines: "Single line breaks",
  paragraphs: "Double line breaks",
};
export function layoutOf(body) {
  const text = String(body ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return null;
  if (/\n[ \t]*\n/.test(text)) return LAYOUT.paragraphs;
  if (text.includes("\n")) return LAYOUT.lines;
  return LAYOUT.block;
}

// Opening: a greeting word in any language we write in, whatever follows it; else the lead's
// own first name glued to the first sentence ("Marie, la plupart..."); else nothing.
export const OPENING = {
  greeting: "Greeting + first name",
  name: "First name alone",
  none: "No greeting",
};
const GREETINGS = [
  // English
  "hi", "hello", "hey", "dear", "good morning", "good afternoon", "good evening", "greetings", "howdy",
  // French
  "bonjour", "bonsoir", "salut", "coucou", "cher", "chère", "chere",
  // German
  "hallo", "liebe", "lieber", "sehr geehrte", "sehr geehrter", "guten tag", "guten morgen", "moin", "servus", "grüezi", "gruezi", "grüß gott",
  // Spanish / Portuguese
  "hola", "estimado", "estimada", "buenos días", "buenos dias", "buenas tardes", "buenas", "olá", "ola", "oi", "prezado", "prezada", "bom dia", "boa tarde",
  // Italian
  "ciao", "buongiorno", "buonasera", "gentile", "caro", "cara", "salve",
  // Dutch / Nordic
  "hoi", "beste", "goedemorgen", "goedemiddag", "hej", "hei", "moi", "god morgon",
  // Polish / Turkish / other
  "cześć", "czesc", "dzień dobry", "dzien dobry", "szanowny", "szanowna", "merhaba", "shalom",
];
const GREETING_RE = new RegExp(
  `^(?:${GREETINGS.sort((a, b) => b.length - a.length).map((g) => g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}])`,
  "iu",
);
const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
// A single capitalised word glued to the sentence by a comma, a colon or a dash is a first name,
// whether or not the lead's own first name is on record (lead-service holds none for many of our
// leads, and "Tony, I noticed..." is still the name alone). These are the words that open a cold
// email that way without being a name.
const NOT_A_NAME = new Set([
  "however", "honestly", "quick", "so", "also", "well", "yes", "ok", "okay", "look", "listen", "question",
  "curious", "note", "ps", "fyi", "update", "today", "recently", "firstly", "first", "sorry", "thanks",
  "congrats", "congratulations", "apologies", "cependant", "donc", "bref", "alors", "aber", "kurz",
]);
const GLUED = /^(\p{Lu}[\p{L}'’.-]{0,24})\s*[,:!–—]/u;
const GLUED_ASCII_DASH = /^(\p{Lu}[\p{L}'’.]{0,24})\s+-\s/u;
export function openingOf(body, firstName) {
  const text = String(body ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return null;
  if (GREETING_RE.test(text)) return OPENING.greeting;
  const name = String(firstName ?? "").trim();
  // the lead's own first name, then a comma, a colon, a dash or an exclamation
  if (name && fold(text.slice(0, name.length)) === fold(name) && /^\s*[,:!–—-]/.test(text.slice(name.length, name.length + 3))) {
    return OPENING.name;
  }
  const m = GLUED.exec(text) || GLUED_ASCII_DASH.exec(text);
  if (m && !NOT_A_NAME.has(fold(m[1]))) return OPENING.name;
  return OPENING.none;
}

// Dashes: whether the first email carries an em dash (U+2014) or an en dash (U+2013). A plain
// hyphen is not a dash here. Our templates never banned either until 2026-09-29, and some models
// pepper every email with them while others almost never do. An email carrying both is its own
// class; derive.mjs folds it into the em dash bucket when it is too small to stand alone. Labels
// carry no dash glyph: the Research page bans the em dash in its copy.
export const DASH = {
  em: "Em dash",
  en: "En dash",
  both: "Both dashes",
  none: "No dash",
};
export function dashOf(body) {
  const text = String(body ?? "").trim();
  if (!text) return null;
  const em = text.includes("—");
  const en = text.includes("–");
  if (em && en) return DASH.both;
  if (em) return DASH.em;
  if (en) return DASH.en;
  return DASH.none;
}
