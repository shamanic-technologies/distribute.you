/**
 * Turn one of the hand-authored landing HTML documents into readable markdown.
 *
 * The pages carry inline styles, inline scripts, decorative inline SVG, a nav
 * placeholder and a footer placeholder, so a whole-document conversion produces
 * noise rather than content. Everything that is not prose is dropped before any
 * conversion runs.
 *
 * Deliberately dependency-free: adding a converter package would touch the root
 * lockfile, which is shared with every other app in the monorepo. Pure and
 * alias-free so it carries real unit tests.
 */

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);
const RIGHT_ARROW = String.fromCharCode(0x2192);
const ELLIPSIS = String.fromCharCode(0x2026);
const NB_SPACE = String.fromCharCode(0x00a0);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: EM_DASH,
  ndash: EN_DASH,
  rarr: RIGHT_ARROW,
  hellip: ELLIPSIS,
  copy: "©",
  reg: "®",
  trade: "™",
  times: "×",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  eacute: "\u00e9",
  Eacute: "\u00c9",
  egrave: "\u00e8",
  Egrave: "\u00c8",
  ecirc: "\u00ea",
  agrave: "\u00e0",
  Agrave: "\u00c0",
  acirc: "\u00e2",
  ccedil: "\u00e7",
  Ccedil: "\u00c7",
  ocirc: "\u00f4",
  ucirc: "\u00fb",
  ugrave: "\u00f9",
  iuml: "\u00ef",
  euro: "\u20ac",
  middot: "\u00b7",
  bull: "\u2022",
  deg: "\u00b0",
  larr: "\u2190",
  dArr: "\u21d3",
  minus: "\u2212",
  frac12: "\u00bd",
  sup2: "\u00b2",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => NAMED_ENTITIES[name] ?? match)
    .replaceAll(NB_SPACE, " ");
}

/** Elements whose entire subtree is noise for a reader without a browser. */
const DROPPED_ELEMENTS = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "iframe",
  "canvas",
  "form",
  "nav",
  "header",
  "footer",
  "select",
];

function dropNonContentElements(html: string): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const tag of DROPPED_ELEMENTS) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi"), "");
    // A self-closing or unterminated instance would otherwise leave its opening
    // tag behind for the generic tag strip, which is harmless but noisy.
    out = out.replace(new RegExp(`<${tag}\\b[^>]*/?>`, "gi"), "");
  }
  // The nav and footer are injected client-side into these two placeholders, so
  // in the raw document they are empty divs carrying no content at all.
  out = out.replace(/<div\s+id="site-(nav|footer)"[^>]*>\s*<\/div>/gi, "");
  return out;
}

/** Collapse a fragment to a single line of plain text (used inside cells). */
function inlineText(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteHref(href: string, baseUrl: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  // A same-page anchor names a section of a document the reader already has.
  if (trimmed.startsWith("#")) return null;
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `${baseUrl}${trimmed}`;
  return null;
}

function convertTables(html: string, baseUrl: string): string {
  return html.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_match, body: string) => {
    const rows: string[][] = [];
    let headerSeen = false;
    let headerIndex = -1;
    const rowMatches = body.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
    for (const row of rowMatches) {
      const cells = row.match(/<t[hd]\b[^>]*>[\s\S]*?<\/t[hd]>/gi) ?? [];
      if (cells.length === 0) continue;
      if (!headerSeen && /<th\b/i.test(row)) {
        headerSeen = true;
        headerIndex = rows.length;
      }
      rows.push(
        cells.map((cell) =>
          inlineText(convertLinks(cell, baseUrl)).replaceAll("|", "\\|"),
        ),
      );
    }
    if (rows.length === 0) return "\n\n";
    const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const lines = rows.map((row) => {
      const padded = [...row];
      while (padded.length < width) padded.push("");
      return `| ${padded.join(" | ")} |`;
    });
    if (headerIndex >= 0) {
      const separator = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;
      lines.splice(headerIndex + 1, 0, separator);
    }
    return `\n\n${lines.join("\n")}\n\n`;
  });
}

function convertLinks(html: string, baseUrl: string): string {
  return html.replace(
    /<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_match, href: string, inner: string) => {
      const text = inlineText(inner);
      if (!text) return "";
      const url = absoluteHref(href, baseUrl);
      return url ? `[${text}](${url})` : text;
    },
  );
}

function convertBlocks(html: string): string {
  let out = html;

  out = out.replace(/<br\s*\/?>/gi, "\n");
  out = out.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

  out = out.replace(
    /<pre\b[^>]*>\s*(?:<code\b[^>]*>)?([\s\S]*?)(?:<\/code>)?\s*<\/pre>/gi,
    (_match, inner: string) =>
      `\n\n\`\`\`\n${decodeEntities(inner.replace(/<[^>]+>/g, "")).trim()}\n\`\`\`\n\n`,
  );

  out = out.replace(
    /<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_match, inner: string) => `\n\n> ${inlineText(inner)}\n\n`,
  );

  for (let level = 1; level <= 6; level += 1) {
    out = out.replace(
      new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)</h${level}>`, "gi"),
      (_match, inner: string) => {
        const text = inlineText(inner);
        return text ? `\n\n${"#".repeat(level)} ${text}\n\n` : "\n\n";
      },
    );
  }

  out = out.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_match, inner: string) => {
    const text = inlineText(inner);
    return text ? `\n- ${text}` : "";
  });

  // Inline emphasis survives the generic strip below, so it is converted first.
  out = out.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag, inner: string) => {
    const text = inlineText(inner);
    return text ? `**${text}**` : "";
  });
  out = out.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag, inner: string) => {
    const text = inlineText(inner);
    return text ? `*${text}*` : "";
  });
  out = out.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_m, inner: string) => {
    const text = inlineText(inner);
    return text ? `\`${text}\`` : "";
  });

  // Every remaining block boundary becomes a paragraph break; the whitespace
  // pass below collapses the runs this produces.
  out = out.replace(
    /<\/(p|div|section|article|aside|ul|ol|table|figure|dl|dd|dt|main)>/gi,
    "\n\n",
  );

  return out;
}

function tidy(text: string): string {
  return decodeEntities(text.replace(/<[^>]+>/g, " "))
    .split("\n")
    // Trimmed at BOTH ends: a block conversion routinely leaves the leading
    // space that separated two inline elements, and markdown reads an indented
    // line as preformatted. Nothing here emits meaningful indentation, since a
    // code fence is produced already trimmed.
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+/, "")
    .replace(/\s+$/, "");
}

export function extractTitle(html: string): string | null {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? inlineText(match[1]) || null : null;
}

export function extractDescription(html: string): string | null {
  const match =
    html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) ??
    html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
  return match ? decodeEntities(match[1]).trim() || null : null;
}

export interface HtmlToMarkdownOptions {
  /** Absolute origin used to resolve root-relative links. */
  baseUrl?: string;
  /** Canonical URL printed under the title so an agent can cite the page. */
  canonicalUrl?: string;
}

export function htmlToMarkdown(html: string, options: HtmlToMarkdownOptions = {}): string {
  const baseUrl = (options.baseUrl ?? "").replace(/\/$/, "");
  const title = extractTitle(html);
  const description = extractDescription(html);

  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;

  const converted = convertBlocks(
    convertLinks(convertTables(dropNonContentElements(body), baseUrl), baseUrl),
  );

  const head: string[] = [];
  if (title) head.push(`# ${title}`);
  if (options.canonicalUrl) head.push(`> Source: ${options.canonicalUrl}`);
  if (description) head.push(description);

  const bodyText = tidy(converted);
  // The document title already opens the file, so a body <h1> repeating it adds
  // nothing for a reader who is paying per token.
  const withoutDuplicateH1 =
    title && bodyText.startsWith(`# ${title}`)
      ? bodyText.slice(`# ${title}`.length).trimStart()
      : bodyText;

  return `${[...head, withoutDuplicateH1].filter(Boolean).join("\n\n")}\n`;
}
