// Reads where every message of the 2026-09-24 opt-out footer placement tests landed.
//
//   node read-placement.mjs <design.json>      (inside the instantly-service container)
//
// It borrows that service's mailbox credentials and IMAP client, so extract-footer.sh
// ships it into the container. The design file names the sending and receiving mailboxes
// and is kept on the box, not in this public repository: those are live sending
// addresses, and publishing them helps nobody but a blocklist.
//
// Each run sent one ordinary cold email per (sender, receiver) pair over our own SMTP,
// every receiver a Google Workspace mailbox we own. The footer arm of a pair was fixed BY
// DESIGN as arms[(senderIndex + receiverIndex) % arms.length], so it is recomputed here
// rather than trusted from a log. A pair found in neither INBOX nor spam is "missing" (the
// send was refused or never arrived) and is excluded from every spam share.
//
// The output carries indices, never addresses, so it can be committed as the snapshot.
// Arms:
//   link_header  visible unsubscribe link in the body + List-Unsubscribe header (what we shipped)
//   no_footer    signature kept, no visible link, no header
//   body_only    the body alone: no signature, no link, no header
//   link_only    visible link, header removed
//   header_only  header kept, visible link removed
//   reply_stop   header kept, visible link replaced by a plain "Reply stop" line (the fix, as deployed)
import { readFileSync } from "node:fs";
import { resolveMailboxCredential, loginFor, GMAIL_IMAP_PORT } from "/app/dist/lib/self-send/mailbox-credentials.js";
import { createImapClient } from "/app/dist/lib/self-send/imap-client.js";

const designPath = process.argv[2];
if (!designPath) throw new Error("usage: read-placement.mjs <design.json>");
const { runs } = JSON.parse(readFileSync(designPath, "utf8"));
const CALLER = { method: "GET", path: "/internal/blog/footer-placement" };
const SINCE = new Date("2026-09-24T00:00:00Z");

const receivers = [...new Set(runs.flatMap((r) => r.receivers))];
const found = new Map(); // subject|from|receiver -> folder; first observation wins
for (const rcv of receivers) {
  const cred = await resolveMailboxCredential(rcv, CALLER);
  const client = createImapClient({ host: cred.imapHost, port: GMAIL_IMAP_PORT, secure: true, auth: { user: loginFor(cred), pass: cred.appPassword }, logger: false });
  client.on("error", (e) => console.error(`imap error on a receiver: ${e?.message ?? e}`));
  await client.connect();
  const folders = [];
  for await (const b of await client.list()) folders.push(b.path);
  for (const f of folders.filter((x) => /^(INBOX|\[Gmail\]\/Spam|Junk|Spam)$/i.test(x))) {
    const lock = await client.getMailboxLock(f);
    try {
      for (const run of runs) {
        const uids = await client.search({ subject: run.subject, since: SINCE }, { uid: true });
        if (!uids?.length) continue;
        for await (const m of client.fetch(uids, { uid: true, envelope: true }, { uid: true })) {
          if (m.envelope?.subject !== run.subject) continue;
          const from = (m.envelope?.from?.[0]?.address ?? "").toLowerCase();
          const key = `${run.subject}|${from}|${rcv}`;
          if (!found.has(key)) found.set(key, f);
        }
      }
    } finally { lock.release(); }
  }
  await client.logout().catch(() => {});
}

const rows = [];
for (const run of runs) run.senders.forEach((s, i) => run.receivers.forEach((r, j) => {
  const f = found.get(`${run.subject}|${s.toLowerCase()}|${r}`);
  rows.push({ run: run.id, arm: run.arms[(i + j) % run.arms.length], sender: i, receiver: j, place: !f ? "missing" : /spam|junk/i.test(f) ? "spam" : "inbox" });
}));
console.log(JSON.stringify({
  readAt: new Date().toISOString(),
  runs: runs.map((r) => ({
    id: r.id, startedAt: r.startedAt, arms: r.arms, senders: r.senders.length, receivers: r.receivers.length,
    senderDomains: new Set(r.senders.map((s) => s.split("@")[1])).size,
    receiverDomains: new Set(r.receivers.map((s) => s.split("@")[1])).size,
  })),
  rows,
}));
