import { NextResponse } from "next/server";
import { ADMIN_ALLOWED_EMAILS } from "@/lib/admin-allowlist";
import { buildClientLines, clientsMessage, sendTelegram } from "@/lib/clients-telegram";
import { verifyStaffDigestCronRequest } from "@/lib/staff-digest";

export const dynamic = "force-dynamic";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`[dashboard-clients-telegram] ${name} is required`);
  return value;
}

/**
 * The owner's morning Telegram: every active client brand on one line (budgets,
 * audiences, payment mode, card, top-up, invested, next charge). Triggered by the
 * box cron `cron-clients-telegram.sh`, same CRON_SECRET bearer as the staff digest.
 */
export async function GET(req: Request) {
  try {
    if (!verifyStaffDigestCronRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const config = {
      apiUrl: requireEnv("NEXT_PUBLIC_DISTRIBUTE_API_URL").replace(/\/$/, ""),
      adminApiKey: requireEnv("ADMIN_DISTRIBUTE_API_KEY"),
      staffEmail: ADMIN_ALLOWED_EMAILS[0],
      telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
      telegramChatId: requireEnv("TELEGRAM_OWNER_CHAT_ID"),
    };
    const lines = await buildClientLines(config);
    const text = clientsMessage(lines, new Date());
    await sendTelegram(config, text);
    console.log(`[dashboard-clients-telegram] sent ${lines.length} active clients`);
    return NextResponse.json({ ok: true, clients: lines.length, text });
  } catch (err) {
    console.error("[dashboard-clients-telegram] cron failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
