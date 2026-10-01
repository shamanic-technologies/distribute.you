import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  renderInstinctPage,
  renderInstinctStartPage,
  INSTINCT_START_PATH,
  WHATSAPP_HREF,
  TELEGRAM_HREF,
} from "../../src/lib/pages/instinct";

const landing = renderInstinctPage();
const start = renderInstinctStartPage();
const text = (html: string) => html.replace(/<style>[\s\S]*?<\/style>|<script>[\s\S]*?<\/script>|<[^>]+>/g, " ");

describe("the instinct-style landing", () => {
  it("is one page with one call to action, leading to the channel picker", () => {
    expect(landing.match(/class="cta"/g)).toHaveLength(1);
    expect(landing).toContain(`href="${INSTINCT_START_PATH}"`);
    expect(landing).not.toMatch(/<form|<input/);
  });

  it("states the channels we have: WhatsApp and Telegram, never iMessage", () => {
    for (const page of [landing, start]) expect(text(page)).not.toMatch(/iMessage/i);
    expect(start).toContain(WHATSAPP_HREF);
    expect(start).toContain(TELEGRAM_HREF);
  });

  it("tags every channel link as a conversation started", () => {
    const links = start.match(/<a [^>]*href="https:\/\/(wa\.me|t\.me)[^>]*>/g) ?? [];
    expect(links.length).toBe(4);
    for (const l of links) expect(l).toMatch(/data-contact="(whatsapp|telegram)"/);
    expect(start).toContain('posthog.capture("contact_clicked"');
  });

  it("ships its QR codes, and none of instinct's own assets", () => {
    for (const f of ["qr-whatsapp.svg", "qr-telegram.svg"]) {
      expect(existsSync(path.resolve(__dirname, "../../public/landing/instinct", f)), f).toBe(true);
    }
    for (const page of [landing, start]) expect(page).not.toMatch(/stickman|brush-stroke\.png|melange/i);
  });

  it("follows the copy rules: no em-dash, the cost is the client's, no promised meetings, not indexed", () => {
    for (const page of [landing, start]) {
      expect(page).not.toContain("—");
      expect(page).toContain('name="robots" content="noindex"');
      expect(text(page)).not.toMatch(/costs us|at cost|guarantee/i);
    }
  });
});
