import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  channelMark,
  OWN_MARK_SRC,
  vendorLogoUrl,
} from "@/lib/channel-marks";

const root = path.resolve(__dirname, "../..");
const homepage = fs.readFileSync(
  path.join(root, "public/landing/index-v1.html"),
  "utf8",
);
const staticHtml = fs.readFileSync(
  path.join(root, "src/lib/static-html.ts"),
  "utf8",
);
const depth = fs.readFileSync(
  path.join(root, "public/landing/css/depth.css"),
  "utf8",
);

describe("the mark a channel wears", () => {
  it("borrows the platform's own logo when we run it on their platform", () => {
    // A provider mark is never ours to redraw, and this repo does not hand-roll
    // provider SVGs.
    expect(channelMark("google-ads")).toEqual({
      kind: "vendor",
      domain: "google.com",
    });
    expect(channelMark("organic-linkedin-publishing")).toEqual({
      kind: "vendor",
      domain: "linkedin.com",
    });
  });

  it("wears OUR mark when the channel is ours", () => {
    // A two-letter contraction was tried and dropped: "FR" for Feedback Request
    // reads as a country code, and an abbreviation of our own naming is not a
    // mark, it is something to decode.
    expect(channelMark("sales-cold-email-outreach")).toEqual({ kind: "own" });
    expect(channelMark("cold-call-outreach")).toEqual({ kind: "own" });
    expect(OWN_MARK_SRC).toContain("logo-distribute");
  });

  it("falls through to our mark for a slug nobody has mapped", () => {
    // A channel published tomorrow renders correctly with no edit here — just
    // without a borrowed logo until someone adds one.
    expect(channelMark("a-channel-shipped-tomorrow")).toEqual({ kind: "own" });
  });

  it("emits no vendor URL without a token, rather than one that 401s", () => {
    // A broken image on the constellation reads as a channel we cannot run.
    expect(vendorLogoUrl("google.com", 28, undefined)).toBeNull();
    expect(vendorLogoUrl("google.com", 28, "pk_test")).toContain(
      "img.logo.dev/google.com",
    );
  });

  it("asks for twice the rendered size, for retina", () => {
    expect(vendorLogoUrl("x.com", 28, "pk_test")).toContain("size=56");
  });
});

describe("the constellation", () => {
  it("is built from the live catalogue, never from a list kept here", () => {
    // It is the section that makes "one API, every channel" something you can
    // see. A hand-kept list would be wrong the first time a channel ships.
    const block = staticHtml.slice(staticHtml.indexOf("async function withConstellation"));
    expect(block.slice(0, 1400)).toContain("fetchChannelCatalogue()");
    expect(block.slice(0, 1400)).toContain("groupChannelsByFamily");
  });

  it("removes itself rather than rendering an empty field", () => {
    // A homepage showing an empty constellation would advertise that we run no
    // channels at all.
    const block = staticHtml.slice(staticHtml.indexOf("async function withConstellation"));
    expect(block.slice(0, 1400)).toContain('replaceAll(CONSTELLATION_TOKEN, "")');
  });

  it("escapes everything the producer sends before it reaches the page", () => {
    const block = staticHtml.slice(staticHtml.indexOf("async function withConstellation"));
    expect(block.slice(0, 1800)).toContain("escapeHtml(");
  });

  it("has its slot on the homepage, inside the canopy", () => {
    // The canopy is where the spread belongs: every channel as fruit on the
    // tree, above the mechanism and well above the price.
    expect(homepage).toContain("__CONSTELLATION__");
    const section = homepage.slice(homepage.indexOf('<section id="channels"'));
    expect(section.slice(0, 200)).toContain('data-strata="canopy"');
  });
});

describe("the homepage descends", () => {
  it("carries the stylesheet and the descent on its body", () => {
    expect(homepage).toContain('href="css/depth.css');
    expect(homepage).toContain('<body class="depth">');
  });

  it("names a stratum on every section", () => {
    const sections = homepage.match(/<section[^>]*>/g) ?? [];
    for (const tag of sections) {
      expect(tag, `a section with no stratum: ${tag}`).toContain("data-strata=");
    }
  });

  it("marks the crossing exactly once", () => {
    expect(homepage.match(/class="horizon"/g) ?? []).toHaveLength(1);
  });

  it("ends in the soil", () => {
    const last = homepage.lastIndexOf("data-strata=");
    expect(homepage.slice(last, last + 30)).toContain("soil");
  });
});

describe("the accent survives the crossing", () => {
  it("is lifted below the horizon, where the charter blue cannot be read", () => {
    // #2563eb measures 2.66:1 on the trunk and fails even the large-text bar,
    // so every eyebrow and accented word in the dark half was unreadable.
    // #60a5fa clears AA on all three dark strata (5.4 / 6.3 / 7.0).
    for (const stratum of ["trunk", "root", "soil"]) {
      const block = depth.slice(
        depth.indexOf(`[data-strata="${stratum}"] {`),
        depth.indexOf("}", depth.indexOf(`[data-strata="${stratum}"] {`)),
      );
      expect(block, `${stratum} does not lift the accent`).toContain(
        "--green: #60a5fa",
      );
    }
  });

  it("leaves the light half on the charter blue", () => {
    for (const stratum of ["sky", "canopy", "branch"]) {
      const block = depth.slice(
        depth.indexOf(`[data-strata="${stratum}"] {`),
        depth.indexOf("}", depth.indexOf(`[data-strata="${stratum}"] {`)),
      );
      expect(block).not.toContain("--green:");
    }
  });
});
