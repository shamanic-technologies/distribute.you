import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  renderDesktopPage,
  renderDesktopToppedUpPage,
  renderDesktopInstallScript,
  DESKTOP_DOWNLOAD_URL,
  DESKTOP_INSTALL_COMMAND,
} from "../../src/lib/pages/desktop";

const page = renderDesktopPage();
const toppedUp = renderDesktopToppedUpPage();
const script = renderDesktopInstallScript();
const text = (html: string) => html.replace(/<style>[\s\S]*?<\/style>|<script>[\s\S]*?<\/script>|<[^>]+>/g, " ");

describe("the private-beta desktop page", () => {
  it("is noindex and kept off the sitemap and the homepage", () => {
    for (const html of [page, toppedUp]) expect(html).toContain('<meta name="robots" content="noindex">');
    const sitemap = readFileSync(path.resolve(__dirname, "../../src/app/sitemap.ts"), "utf8");
    expect(sitemap).not.toContain("/desktop");
    const home = readFileSync(path.resolve(__dirname, "../../public/landing/index-v2.html"), "utf8");
    expect(home).not.toContain("/desktop");
  });

  it("leads with the Terminal install: the browser download is blocked once by Gatekeeper", () => {
    expect(page.indexOf(DESKTOP_INSTALL_COMMAND)).toBeLessThan(page.indexOf(`href="${DESKTOP_DOWNLOAD_URL}"`));
    expect(text(page)).toMatch(/Open Anyway/);
  });

  it("offers the download and the one-line install", () => {
    expect(page).toContain(`href="${DESKTOP_DOWNLOAD_URL}"`);
    expect(page).toContain(DESKTOP_INSTALL_COMMAND);
    expect(DESKTOP_DOWNLOAD_URL).toMatch(/\/releases\/download\/desktop-latest\/Distribute\.zip$/);
  });

  it("states the desktop offer: free app, prepaid credit, never the monthly plan", () => {
    const copy = text(page);
    expect(copy).toMatch(/free during the beta/i);
    expect(copy).toMatch(/prepaid credit/i);
    expect(copy).not.toMatch(/\$99|per month|\/month|subscription plan|free trial|\$1\/day|pay[- ]as[- ]you[- ]go/i);
  });

  it("carries the why and obeys the copy bans", () => {
    expect(text(page)).toContain("Revenue made easy.");
    for (const html of [page, toppedUp]) {
      const copy = text(html);
      expect(copy).not.toMatch(/[—–]/);
      expect(copy).not.toMatch(/open rate|opened|costs us|at cost|best model|guarantee/i);
    }
  });

  it("draws the app with no invented figures", () => {
    const mock = page.slice(page.indexOf('<figure class="window"'), page.indexOf("</figure>"));
    expect(text(mock)).not.toMatch(/\d/);
  });
});

describe("the install script", () => {
  it("downloads the release with curl, installs the app and opens it", () => {
    expect(script.startsWith("#!/bin/sh")).toBe(true);
    expect(script).toContain(`URL="${DESKTOP_DOWNLOAD_URL}"`);
    expect(script).toContain("set -eu");
    expect(script).toMatch(/Applications/);
    expect(script).toContain('open "$DEST/Distribute.app"');
  });
});
