import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { DOCS_ROUTES } from "../../src/lib/docs-routes";
import { DOCS_OG_IMAGE_PATH, docsMetadata } from "../../src/lib/docs-metadata";

// A link pasted into WhatsApp, Slack or LinkedIn renders the page's og:image.
// Every page sets its own `openGraph`, and Next replaces that block rather than
// merging it with the layout's, so an image declared only in the layout never
// reached a single page: the preview showed whatever the chat app had cached.
const root = path.resolve(__dirname, "../..");

describe("social preview image", () => {
  it.each(DOCS_ROUTES.map((r) => r.path))("%s declares the OG and Twitter image", (p) => {
    const meta = docsMetadata(p);
    const og = meta.openGraph?.images;
    const tw = meta.twitter?.images;
    expect(JSON.stringify(og)).toContain(DOCS_OG_IMAGE_PATH);
    expect(JSON.stringify(tw)).toContain(DOCS_OG_IMAGE_PATH);
  });

  it("is generated at build by a static route with a .png name", () => {
    expect(DOCS_OG_IMAGE_PATH).toMatch(/\.png$/);
    const route = path.join(root, "src/app", DOCS_OG_IMAGE_PATH.slice(1), "route.tsx");
    const src = readFileSync(route, "utf8");
    expect(src).toContain('export const dynamic = "force-static"');
    expect(src).toContain("ImageResponse");
  });

  it("no longer ships the retired logo-only jpg", () => {
    expect(existsSync(path.join(root, "public/og-image.jpg"))).toBe(false);
    const layout = readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
    expect(layout).not.toContain("og-image.jpg");
  });
});
