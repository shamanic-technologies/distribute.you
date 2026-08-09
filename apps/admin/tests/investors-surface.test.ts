import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const sidebar = read("src/components/context-sidebar.tsx");
const composer = read("src/components/investors/investor-update-composer.tsx");
const listView = read("src/components/investors/investor-list-view.tsx");
const api = read("src/lib/api.ts");

/** Measured to the closing brace of AppLevelSidebar; do not widen. */
function appLevelSidebar(): string {
  const at = sidebar.indexOf("function AppLevelSidebar(");
  expect(at).toBeGreaterThan(-1);
  const end = sidebar.indexOf("\n// Org Level Sidebar", at);
  expect(end).toBeGreaterThan(at);
  return sidebar.slice(at, end);
}

describe("admin sidebar", () => {
  it("puts Customer Success below the other blocks", () => {
    const block = appLevelSidebar();
    const cs = block.indexOf(">Customer Success<");
    const dashboard = block.indexOf(">Dashboard<");
    const audit = block.indexOf(">Audit<");
    const features = block.indexOf(">Features<");
    expect(cs).toBeGreaterThan(dashboard);
    expect(cs).toBeGreaterThan(audit);
    expect(cs).toBeGreaterThan(features);
  });

  it("puts the Investors section under Customer Success", () => {
    const block = appLevelSidebar();
    expect(block.indexOf(">Investors<")).toBeGreaterThan(block.indexOf(">Customer Success<"));
  });

  it("links both investor pages", () => {
    const block = appLevelSidebar();
    expect(block).toContain('href: "/investors"');
    expect(block).toContain('href: "/investors/update"');
  });

  it("keeps the list link exact so the update page does not light both", () => {
    expect(appLevelSidebar()).toContain('isActive={pathname === "/investors"}');
  });
});

describe("investor update composer", () => {
  it("sends the markdown and lets the producer render it — rendering here would duplicate the unsubscribe footer", () => {
    // Scoped to the mutation: `__html:` is legitimate elsewhere in this file
    // (the preview and the history both render HTML), so a file-wide check
    // would assert something we do not mean. Measured at 1046 chars from the
    // mutation to the line after it; do not widen.
    const at = composer.indexOf("  const sendMutation = useMutation({");
    expect(at).toBeGreaterThan(-1);
    const body = composer.slice(at, at + 1046);
    expect(body).toContain("sendMailingListUpdate(INVESTOR_LIST_SLUG, { subject: subject.trim(), body })");
    expect(body).not.toContain("html");
  });

  it("asks the producer to render the preview, so it cannot flatter the inbox", () => {
    // This used to render markdown here, with a copy of the producer's own
    // renderer. The copy drifted the moment the producer grew its inline-styled
    // email renderer, so the console showed bare markup while investors
    // received a laid-out email. There is no renderer here now.
    expect(composer).toContain("previewMailingListUpdate");
    expect(composer).not.toContain("marked");
  });

  it("says the unsubscribe is appended on send rather than drawing one it does not control", () => {
    expect(composer).toContain("UNSUBSCRIBE_PREVIEW_NOTE");
  });

  it("shows a past update from the body as SENT, not by re-rendering the markdown", () => {
    expect(composer).toContain("html={update.htmlBody}");
  });

  it("counts only people who have not opted out — the list size would overstate the send", () => {
    expect(composer).toContain("(s) => !s.optedOut");
  });

  it("reports the opted-out skips the sender returns, so a smaller reach is explained", () => {
    expect(composer).toContain("skippedOptedOut");
  });

  it("asks before sending rather than firing on the first click", () => {
    expect(composer).toContain("confirming");
    expect(composer).toContain("Yes, send to");
  });

  it("keeps the in-flight label at full opacity, per the mutation-button rule", () => {
    expect(composer).toContain('sending ? "cursor-wait" : "disabled:opacity-40');
  });

  it("never renders a raw err.message to the user", () => {
    expect(composer).not.toContain("err.message");
    expect(composer).not.toContain("error.message");
    expect(composer).toContain("console.error");
  });

  it("does not hand-write the image markdown syntax", () => {
    expect(composer).toContain("imageMarkdown(");
    expect(composer).not.toContain("`![");
  });

  it("takes an image as a FILE — there is no pasted-link field left", () => {
    // An image hosted somewhere else can be moved, expire or block hotlinking
    // long after the update has landed in forty inboxes.
    expect(composer).toContain('type="file"');
    expect(composer).toContain("uploadStaffImage(");
    expect(composer).not.toContain('type="url"');
    expect(composer).not.toContain("setImageUrl");
  });

  it("gates the file before uploading and the returned URL after, then decodes it", () => {
    expect(composer).toContain("imageFileProblem(");
    expect(composer).toContain("imageUrlProblem(uploaded.url)");
    expect(composer).toContain("probe.onload");
  });

  it("uploads on the pick — there is no second button to miss", () => {
    // The first real update went out with no picture because the file sat
    // chosen in the form and the separate Insert button was never pressed.
    expect(composer).toContain("void uploadAndInsert(picked)");
    expect(composer).not.toContain('"Insert"');
    expect(composer).not.toContain(">Insert<");
  });

  it("gates the send while a picked image is not in the body", () => {
    expect(composer).toContain("investorUpdateBlocker(subject, body, pendingImage?.name ?? null)");
  });

  it("says the image landed, since the line drops below the fold of the textarea", () => {
    expect(composer).toContain("added at the end of the update");
  });

  it("falls back to the filename for alt text rather than sending an empty one", () => {
    expect(composer).toContain("imageAltFromFilename(file.name)");
  });

  it("asks the storage service to optimise for email BEFORE the bytes are written", () => {
    // The recipient's mail client has no credentials of ours, so what is stored
    // is exactly what is delivered. Re-encoding on read is not an option: that
    // route is service-authed and a client would get a 401 where the picture is.
    expect(composer).toContain('optimizeFor: "email"');
  });

  it("states the stored weight, the only place the author sees what came out", () => {
    expect(composer).toContain("formatUploadSize(uploaded.size)");
    expect(composer).toContain("Stored at");
  });

  it("uploads under a sanitized name, since the key lands in the public URL", () => {
    // A macOS screenshot carries spaces, the storage key kept them, and the
    // markdown image then ended at the first space and rendered as raw text.
    expect(composer).toContain("filename: sanitizeUploadFilename(file.name)");
    expect(composer).not.toContain("filename: file.name,");
  });

  it("takes the accept list from the catalogue, so picker and gate cannot disagree", () => {
    expect(composer).toContain("ACCEPTED_IMAGE_ACCEPT_ATTR");
    expect(composer).not.toContain('accept="image/png');
  });

  it("restores the draft before it starts saving, or the first render writes over it", () => {
    const restoreAt = composer.indexOf("setDraftHydrated(true)");
    const saveAt = composer.indexOf("writeDraft(storage, { subject, body })");
    expect(restoreAt).toBeGreaterThan(-1);
    expect(saveAt).toBeGreaterThan(restoreAt);
    expect(composer).toContain("if (!draftHydrated) return;");
  });

  it("gates hydration on STATE, not a ref, and depends on it", () => {
    // Reproduced with Playwright against real localStorage: with a ref, the
    // saving effect's next pass still held the EMPTY values of the render it
    // was created in, so it scheduled a write of the blank form and the line
    // sat on "Saving draft..." on a page nobody had typed into.
    expect(composer).toContain("const [draftHydrated, setDraftHydrated] = useState(false)");
    expect(composer).toContain("}, [draftHydrated, subject, body]);");
    expect(composer).not.toContain("draftHydrated.current");
  });

  it("debounces the save from the shared constant rather than a literal", () => {
    expect(composer).toContain("DRAFT_SAVE_DEBOUNCE_MS");
  });

  it("purges the draft once the update is out, so it is never offered back", () => {
    const at = composer.indexOf("  const sendMutation = useMutation({");
    expect(at).toBeGreaterThan(-1);
    // Measured to the closing brace of onSuccess; do not widen.
    expect(composer.slice(at, at + 900)).toContain("clearDraft(storage)");
  });

  it("says the draft is local to this browser, since it does not follow you", () => {
    expect(composer).toContain("Draft restored from this browser.");
    expect(composer).toContain("Draft saved in this browser.");
  });
});

describe("investor list view", () => {
  it("shows opted-out state — a member the provider blocks must not read as subscribed", () => {
    expect(listView).toContain("subscriber.optedOut ?");
    expect(listView).toContain("(s) => !s.optedOut");
  });

  it("distinguishes an unsubscribe from a bounce from a spam complaint", () => {
    for (const reason of ["HardBounce", "SpamComplaint", "ManualSuppression"]) {
      expect(listView).toContain(reason);
    }
  });

  it("sends the raw paste — the producer owns parsing and dedup against what is stored", () => {
    expect(listView).toContain("addMailingListSubscribers(INVESTOR_LIST_SLUG, blob)");
  });

  it("removes by email, since a subscriber has no id on the wire", () => {
    expect(listView).toContain("removeMailingListSubscriber(INVESTOR_LIST_SLUG, email)");
    expect(listView).not.toContain("subscriber.id");
  });

  it("never renders a raw err.message to the user", () => {
    expect(listView).not.toContain("err.message");
    expect(listView).toContain("console.error");
  });

  it("gates the add button on there being something valid to add", () => {
    expect(listView).toContain("parsed.accepted.length > 0");
  });

  it("reports rejects rather than dropping them quietly", () => {
    expect(listView).toContain("parsed.rejected.length");
  });
});

describe("investor api readers", () => {
  it("targets the gateway path api-service actually deployed, not an assumed prefix", () => {
    // api-service #799 mounts these at /v1/mailing-lists/:slug/*. apiCall
    // prepends /api/v1, so the reader path carries no further prefix.
    expect(api).toContain("`/mailing-lists/${slug}/subscribers`");
    expect(api).toContain("`/mailing-lists/${slug}/updates`");
    expect(api).not.toContain("/emails/mailing-lists/");
  });

  it("never puts recipients in BCC — per-recipient delivery is what makes the opt-out per-recipient", () => {
    const at = api.indexOf("export async function sendMailingListUpdate(");
    expect(at).toBeGreaterThan(-1);
    // Measured to the closing brace of the function; do not widen.
    const body = api.slice(at, at + 330);
    expect(body).not.toContain("bcc");
    expect(body).not.toContain("Bcc");
  });

  it("sends markdown as `body`, conforming to the deployed contract", () => {
    expect(api).toContain("input: { subject: string; body: string }");
  });

  it("types added/skipped as the arrays the sender returns, not counts", () => {
    expect(api).toContain("added: string[]");
    expect(api).toContain("skipped: string[]");
  });
});

describe("no em dash in rendered copy", () => {
  /**
   * The repo bans U+2014 in user-facing copy: it is the top AI-tell. Comments
   * are exempt, and a bare "—" standing in for a missing value is the codebase's
   * documented null glyph, not prose. What is banned is an em dash used as
   * punctuation inside a sentence a person reads.
   *
   * The one that mattered was the subject-field placeholder: it taught the em
   * dash into every investor subject line, and it is exactly where the one in
   * the first real send came from.
   */
  function prose(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "")
      // The null glyph, on its own, is not prose.
      .replace(/"—"/g, '""');
  }

  it("keeps the composer's rendered copy free of em dashes", () => {
    expect(prose(composer)).not.toContain("—");
  });

  it("keeps the list view's rendered copy free of em dashes", () => {
    expect(prose(listView)).not.toContain("—");
  });

  it("keeps the deck free of em dashes — it becomes a PDF an investor reads", () => {
    const deckSrc = read("src/components/investors/investor-deck-view.tsx");
    expect(prose(deckSrc)).not.toContain("—");
  });

  it("does not seed an em dash through the subject placeholder", () => {
    expect(composer).not.toContain('placeholder="distribute —');
  });
});
