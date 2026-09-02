import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

const BOARD = read("components/campaigns/funnel-leg-columns-board.tsx");
const PAGE = read("components/campaigns/campaigns-page.tsx");

describe("the funnel board's call site", () => {
  // A component that handles the funnel perfectly is the feature entirely absent if the
  // page never renders it, so the guard pins the CALL SITE and not only the component.
  it("is rendered by the campaigns page, under a funnel and nowhere else", () => {
    const at = PAGE.indexOf("<FunnelLegColumnsBoard");
    expect(at).toBeGreaterThan(-1);
    const call = PAGE.slice(at, PAGE.indexOf("/>", at));
    expect(call).toContain("brandId={brandId}");
    expect(call).toContain("offerId={offerId}");
    expect(call).toContain("funnel={narrowedFunnel}");
    // Off a funnel there is no single walk to lay out.
    const gate = PAGE.slice(PAGE.lastIndexOf("{funnelKey &&", at), at);
    expect(gate).toContain("narrowedFunnel");
  });

  it("opens the SAME controls modal every other budget surface opens", () => {
    expect(BOARD).toContain("CampaignControlsModal");
    // A second narrowing is how two surfaces come to state different money for one
    // channel. The board lays out an answer; it does not compute one.
    expect(BOARD).toContain("funnelChannelBudgets");
    expect(BOARD).not.toContain("offerScopedCents");
    expect(BOARD).not.toContain("saveBrandFunnelBudget");
    expect(BOARD).not.toContain("setCampaignStatus");
  });

  it("hands the modal the channels that have no campaign yet", () => {
    const at = BOARD.indexOf("<CampaignControlsModal");
    expect(at).toBeGreaterThan(-1);
    expect(BOARD.slice(at, BOARD.indexOf("/>", at))).toContain("offerable={offerable}");
  });

  // A card and the modal it opens must never state opposite things about one channel,
  // so the verdict comes from the SAME resolver the modal writes through — never a
  // second copy of the rule, and never the ceiling standing in for a status.
  it("takes its running verdict from buildControlRows, on the shared campaigns key", () => {
    expect(BOARD).toContain("buildControlRows");
    expect(BOARD).toContain('["campaigns", brandId]');
    expect(BOARD).toContain("runningBySlug");
    // The ceiling separates "stopped" from "never bought"; it never decides what runs.
    expect(BOARD).not.toContain("card.funded ? \"Running\"");
  });

  // No guess: while the campaigns read is unsettled the pill is a skeleton, not a word.
  it("states no verdict while the campaigns read is unsettled", () => {
    expect(BOARD).toContain("campaignsQ.isPending && !campaignsQ.isError");
    const at = BOARD.indexOf('card.state === "unknown"');
    expect(at).toBeGreaterThan(-1);
    expect(BOARD.slice(at, at + 160)).toContain("Skeleton");
  });

  // Money stays on the card whatever the status: a paused channel that still holds a
  // ceiling reads Paused AND states its $/day, because that is what is true of it.
  it("keeps the ceiling on the card independently of the verdict", () => {
    const at = BOARD.indexOf("fmtDailyBudgetUsd(card.savedCents)");
    expect(at).toBeGreaterThan(-1);
    const cell = BOARD.slice(BOARD.lastIndexOf("{pending ?", at), at);
    expect(cell).not.toContain("card.state");
  });

  // Reveal on SETTLE: a failed budget read paints the cards without a ceiling rather
  // than holding them in a skeleton forever.
  it("reveals on settle, never on success alone", () => {
    expect(BOARD).toContain("budgetsQ.isPending && !budgetsQ.isError");
  });

  // Four columns at the widest, two at the middle, one on a phone — and the whole width
  // of the page, which is the shape this replaced a one-row-per-arrow table for.
  it("lays the arrows out as full-width columns", () => {
    expect(BOARD).toContain("grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4");
  });

  // Measured at 1440: four columns leave 292px, and the longest published channel name
  // does not fit on one line. A name a reader cannot finish is a card that does not say
  // what it is.
  it("wraps a long channel name instead of truncating it", () => {
    const at = BOARD.indexOf("{card.channel.name}");
    const line = BOARD.slice(BOARD.lastIndexOf("<p", at), at);
    expect(line).toContain("line-clamp-2");
    expect(line).not.toContain("truncate");
  });
});
