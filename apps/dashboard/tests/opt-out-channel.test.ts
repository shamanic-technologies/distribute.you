import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OPT_OUT_CHANNELS,
  optOutChannelOption,
  type OptOutChannel,
} from "../src/lib/opt-out-channel";

const board = readFileSync(
  join(__dirname, "..", "src", "components", "leads", "lead-board.tsx"),
  "utf8",
);
const page = readFileSync(
  join(__dirname, "..", "src", "components", "audiences", "engaged-leads-page.tsx"),
  "utf8",
);
const api = readFileSync(join(__dirname, "..", "src", "lib", "api.ts"), "utf8");

describe("how somebody told us to stop", () => {
  it("carries instantly-service's vocabulary value for value", () => {
    // It owns this closed set. A value invented here is refused upstream; a value
    // missing here simply cannot be stated, which is how the whole feature was
    // unreachable in the first place.
    expect(OPT_OUT_CHANNELS.map((o) => o.channel).sort()).toEqual(
      [
        "sms",
        "phone_call",
        "email_reply",
        "forwarded_thread",
        "in_person",
        "web_form",
        "other",
      ].sort(),
    );
  });

  it("puts the commonest first and 'some other way' last", () => {
    // The ordinary case is the first thing under the cursor, and the vague one is
    // never a default anybody lands on by accident.
    expect(OPT_OUT_CHANNELS[0].channel).toBe("email_reply");
    expect(OPT_OUT_CHANNELS[OPT_OUT_CHANNELS.length - 1].channel).toBe("other");
  });

  it("labels every channel as the end of 'how did they tell us?'", () => {
    for (const option of OPT_OUT_CHANNELS) {
      expect(option.label.length).toBeGreaterThan(2);
      // Read back as a sentence, so they are not bare nouns.
      expect(option.label[0]).toBe(option.label[0].toUpperCase());
    }
  });

  it("returns null for a channel this build does not carry, never a fabricated label", () => {
    // instantly-service can widen the set before this app ships.
    expect(optOutChannelOption("carrier_pigeon")).toBeNull();
    expect(optOutChannelOption(null)).toBeNull();
    expect(optOutChannelOption(undefined)).toBeNull();
    expect(optOutChannelOption("")).toBeNull();
    expect(optOutChannelOption("sms" satisfies OptOutChannel)?.label).toBe("By SMS");
  });
});

describe("recording an opt-out is a different write from stating a reply", () => {
  it("is scoped to the PERSON, so it carries no campaign", () => {
    // Honouring "stop contacting me" in one campaign while another keeps sending is
    // precisely the outcome the law cares about, so instantly-service applies it to
    // every campaign the org holds for that address — and a body carrying a campaign
    // id would say otherwise.
    const record = api.slice(
      api.indexOf("export async function recordLeadOptOut("),
      api.indexOf("export async function withdrawLeadOptOut("),
    );
    expect(record).toContain('apiCall<RecordLeadOptOutResponse>("/emails/opt-outs"');
    expect(record).toContain("channel: body.channel,");
    expect(record).not.toContain("campaign_id");
  });

  it("withdraws rather than erases, and carries no campaign either", () => {
    const withdraw = api.slice(
      api.indexOf("export async function withdrawLeadOptOut("),
      api.indexOf("/** One recorded opt-out"),
    );
    expect(withdraw).toContain('"/emails/opt-outs/withdrawals"');
    expect(withdraw).not.toContain("campaign_id");
  });

  it("goes through its OWN mutation, never the reply-kind one", () => {
    // Flattening the two is what would let a reply kind be written where a consent
    // record belongs.
    expect(page).toContain("recordLeadOptOut({ email, channel })");
    expect(page).toContain("withdrawLeadOptOut({ email })");
    expect(page).toContain("optOutOnBoard.mutate(");
    expect(page).toContain("withdrawOptOutOnBoard.mutate(");
  });

  it("disables the picker while ANY of the three writes is in flight", () => {
    // One shared `busy`, or a second click lands on top of the first.
    //
    // Anchored on the BOARD's mount, not on the first `busy={` in the file: the leads
    // table's Close won cell carries one too and is declared earlier, so a bare
    // first-index lookup reads that one and asserts against the wrong control.
    const mount = page.slice(page.indexOf("<LeadBoard\n"));
    const busy = mount.slice(mount.indexOf("busy={"), mount.indexOf("busy={") + 200);
    expect(busy).toContain("moveOnBoard.isPending");
    expect(busy).toContain("optOutOnBoard.isPending");
    expect(busy).toContain("withdrawOptOutOnBoard.isPending");
  });
});

describe("the form asks the two things a move into or out of Opt-out needs", () => {
  it("asks HOW they told us, because the channel is a consent record", () => {
    // Required, so it is asked rather than defaulted: an opt-out nobody can audit
    // later is exactly what a consent record must not be.
    expect(board).toContain("OPT_OUT_CHANNELS.map(");
    expect(board).toContain("How did");
    expect(board).toContain('type: "optOut",');
    expect(board).toContain("channel: option.channel,");
  });

  it("says the record applies beyond this campaign, which a card cannot show", () => {
    expect(board).toContain(
      "This stops every campaign we are running at them, not only this one.",
    );
  });

  it("confirms before letting anybody OUT, and states what does not happen", () => {
    // The half that is easy to assume: nothing that was stopped starts again.
    expect(board).toContain("columnMoveConfirmation(pending.card.column)");
    expect(board).toContain('type: "withdrawal",');
    expect(board).toContain("Take the opt-out back");
  });

  it("asks the leaving question BEFORE the target's own", () => {
    // Whatever column the card was dropped on, the write is the same withdrawal — so
    // a card dragged from Opt-out to Sales interest must not be asked for a reply
    // kind it is not about to write.
    const confirmAt = board.indexOf("pendingConfirmation && pending.card.email");
    const optOutAt = board.indexOf("pendingOptOut && pending.card.email");
    const kindsAt = board.indexOf("pendingKinds.map(");
    expect(confirmAt).toBeGreaterThan(-1);
    expect(confirmAt).toBeLessThan(optOutAt);
    expect(optOutAt).toBeLessThan(kindsAt);
    // And the two never fire together: leaving Opt-out wins outright.
    expect(board).toContain('pending?.to.key === "opt_out" && !pendingConfirmation');
  });
});
