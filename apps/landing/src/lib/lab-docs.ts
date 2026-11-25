/**
 * The docs integrations as the lab offers them (owner 2026-11-25, LAB-SOLO-PIVOT-1125):
 * three ways to use distribute.you and nothing else. From an AI (MCP / API) in Conductor,
 * Claude Desktop, ChatGPT, Hermes, Grok Bot or Dots; on WhatsApp or Telegram; by email.
 *
 * The live docs list other clients (Claude Code, Cursor) and automation platforms (Make,
 * n8n, Zapier); the lab hides those pages (`LAB_HIDDEN_SECTIONS`). The pages only the lab
 * has are drawn here, inside the live `/docs/integrations` page (its nav, sidebar and
 * footer), so they wear the same chrome as every other docs page. Nothing here is
 * reachable from production: only the skin route calls it.
 *
 * Alias-free: unit-tested directly.
 */
import { DISTRY_CHAT_URL } from "./distry-skin";
import { CLAUDE_CODE_MCP_COMMAND, MCP_SERVER_NAME, MCP_URL } from "./docs/developer-surfaces";

export const LAB_INTEGRATIONS_PATH = "/docs/integrations";

type LabIntegration = {
  slug: string;
  name: string;
  /** One line under the heading, and the card's line on the overview. */
  line: string;
  /** The page body (HTML, inside `.prose`); null = the live page is served as it is. */
  body: string | null;
};

/** What every MCP client page says once the server is added. */
const AFTER_ADDING = `<h2>Then ask</h2>
<p>Say what you want in plain words, for example <em>"Get me meetings for acme.com"</em>. Your AI signs you up, reads your website and shows you the plan to confirm.</p>
<p>On the free plan, Distry asks for the keys the campaign needs, one by one, in the same chat.</p>`;

function mcpClientBody(client: string): string {
  return `<h2>Add the server</h2>
<ol>
<li>Open the MCP or connector settings of ${client}.</li>
<li>Add a remote server named <code>${MCP_SERVER_NAME}</code>.</li>
<li>Paste the URL: <code>${MCP_URL}</code></li>
<li>Save. The distribute.you tools show up in ${client}.</li>
</ol>
${AFTER_ADDING}`;
}

/** The integrations, in the order the owner named them. */
export const LAB_INTEGRATIONS: readonly LabIntegration[] = [
  {
    slug: "conductor",
    name: "Conductor",
    line: "Use distribute.you from every Conductor workspace.",
    body: `<h2>Add the server</h2>
<p>Conductor runs Claude Code in each workspace. Add the server once, from any terminal:</p>
<pre><code>${CLAUDE_CODE_MCP_COMMAND}</code></pre>
<p>Every new Conductor chat can then use the distribute.you tools.</p>
${AFTER_ADDING}`,
  },
  { slug: "claude-desktop", name: "Claude Desktop", line: "Add distribute.you to the Claude Desktop app.", body: null },
  { slug: "chatgpt", name: "ChatGPT", line: "Use distribute.you from ChatGPT.", body: null },
  { slug: "hermes", name: "Hermes", line: "Add distribute.you to your Hermes agent.", body: mcpClientBody("Hermes") },
  { slug: "grok-bot", name: "Grok Bot", line: "Use distribute.you from Grok Bot.", body: mcpClientBody("Grok Bot") },
  { slug: "dots", name: "Dots", line: "Use distribute.you from Dots.", body: mcpClientBody("Dots") },
  {
    slug: "whatsapp",
    name: "WhatsApp",
    line: "Text Distry on WhatsApp like a teammate.",
    body: `<h2>Say hi</h2>
<p><a href="${DISTRY_CHAT_URL}" target="_blank" rel="noopener noreferrer">Open the chat with Distry</a> and tell it what you sell.</p>
<p>Distry sends the plan, you answer "go", and the replies from your leads come back in the same chat.</p>`,
  },
  {
    slug: "telegram",
    name: "Telegram",
    line: "Talk to Distry on Telegram.",
    body: `<h2>Link your chat</h2>
<p>Ask Distry, from your AI or on WhatsApp, to link Telegram to your account.</p>
<p>From then on, Distry answers you on Telegram the same way: the plan, your "go", and the replies.</p>`,
  },
  {
    slug: "email",
    name: "Email",
    line: "Work with Distry by email, from any inbox.",
    body: `<h2>Reply to Distry</h2>
<p>Distry writes to you when a campaign needs you: a plan to confirm, a lead who answered.</p>
<p>Reply in the same thread. Distry reads it and answers there, with the next step ready.</p>`,
  },
];

const OVERVIEW_BODY = `<h2>From your AI</h2>
<p>Add our MCP server at <code>${MCP_URL}</code>, then ask in plain words. The <a href="/docs/api">API</a> covers every operation too.</p>
<h2>On WhatsApp or Telegram</h2>
<p>Text Distry like a teammate. The plan and the replies come back in the chat.</p>
<h2>By email</h2>
<p>Reply to Distry in the same thread, from any inbox.</p>
<h2>When the credit runs out</h2>
<p>Every door answers the same way: no credit left, with a link to add more.</p>`;

const SIDEBAR_LINK = "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition text-gray-600 hover:bg-gray-50 hover:text-gray-900";
const CARD = "block p-3 border border-gray-200 rounded-lg hover:border-brand-300 hover:shadow-xs transition";

const pathOf = (i: LabIntegration) => `${LAB_INTEGRATIONS_PATH}/${i.slug}`;

/** The integration pages only the lab draws (the overview included); the others are live pages. */
export function isLabDrawnDocsPage(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  return path === LAB_INTEGRATIONS_PATH || LAB_INTEGRATIONS.some((i) => i.body !== null && pathOf(i) === path);
}

function page(title: string, line: string, inner: string): string {
  return `<main><div class="max-w-4xl mx-auto px-6 py-8"><h1 class="text-2xl font-semibold text-gray-900 mb-3">${title}</h1><p class="text-base text-gray-500 mb-8">${line}</p>${inner}</div></main>`;
}

function overview(): string {
  const cards = LAB_INTEGRATIONS.map(
    (i) => `<a class="${CARD}" href="${pathOf(i)}"><h3 class="text-sm font-semibold text-gray-900">${i.name}</h3><p class="text-xs text-gray-500 mt-0.5">${i.line}</p></a>`,
  ).join("");
  return page(
    "distribute.you Integrations",
    "Three ways to use distribute.you: from your AI, on WhatsApp or Telegram, and by email.",
    `<div class="grid gap-2 mb-10">${cards}</div><div class="prose">${OVERVIEW_BODY}</div>`,
  );
}

/** The sidebar's Integrations list, restated: exactly the lab's integrations. */
function withLabSidebar(html: string): string {
  const items = [{ name: "Overview", href: LAB_INTEGRATIONS_PATH }, ...LAB_INTEGRATIONS.map((i) => ({ name: i.name, href: pathOf(i) }))]
    .map((l) => `<li><a class="${SIDEBAR_LINK}" href="${l.href}">${l.name}</a></li>`)
    .join("");
  return html.replace(/(>Integrations<\/h3>\s*<ul\b[^>]*>)[\s\S]*?(<\/ul>)/g, (_m, open: string, close: string) => `${open}${items}${close}`);
}

/**
 * A docs page as the lab serves it. Every docs page gets the lab's sidebar; the overview
 * and the pages only the lab has get their body drawn into the live overview page
 * (`template`, fetched by the skin route), with their own title.
 */
export function withLabDocs(html: string, pathname: string): string {
  const path = pathname.replace(/\/+$/, "");
  let out = withLabSidebar(html);
  if (!isLabDrawnDocsPage(path)) return out;
  const found = LAB_INTEGRATIONS.find((i) => pathOf(i) === path);
  const main = found?.body ? page(`distribute.you ${found.name} Integration`, found.line, `<div class="prose">${found.body}</div>`) : overview();
  const title = found ? `${found.name} Integration | distribute.you Docs` : "distribute.you Integrations";
  const description = found ? found.line : "Use distribute.you from your AI, on WhatsApp or Telegram, and by email.";
  if (!/<main>[\s\S]*?<\/main>/.test(out)) {
    console.error(`[landing] lab docs: no <main> in the integrations template for ${path}`);
    return out;
  }
  out = out.replace(/<main>[\s\S]*?<\/main>/, () => main);
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  out = out.replace(/(<meta name="description" content=")[^"]*(")/, (_m, a: string, b: string) => `${a}${description}${b}`);
  return out;
}
