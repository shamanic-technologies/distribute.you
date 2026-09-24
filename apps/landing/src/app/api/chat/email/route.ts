import { cleanEmail, threadCode } from "@/lib/chat/rules";
import { openThread, setThreadEmail } from "@/lib/chat/store";
import { sendToTeam, telegramConfig } from "@/lib/chat/telegram";

export const dynamic = "force-dynamic";

/** A visitor leaves an email so the team can follow up once they close the page. */
export async function POST(request: Request) {
  const config = telegramConfig();
  if (!config) return Response.json({ error: "chat_offline" }, { status: 503 });
  const input = (await request.json().catch(() => null)) as
    | { thread?: { id?: unknown; secret?: unknown }; email?: unknown }
    | null;
  const email = cleanEmail(input?.email);
  if (!email || typeof input?.thread?.id !== "string" || typeof input?.thread?.secret !== "string") {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }
  const opened = await openThread({ id: input.thread.id, secret: input.thread.secret });
  if (!opened) return Response.json({ error: "unknown_thread" }, { status: 404 });
  await setThreadEmail(opened.id, email);
  await sendToTeam(config, `📧 #${threadCode(opened.id)} left an email: ${email}`);
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
