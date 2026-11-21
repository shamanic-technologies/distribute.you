import { NextResponse } from "next/server";
import sharp from "sharp";
import { ADMIN_ALLOWED_EMAILS } from "@/lib/admin-allowlist";
import { fetchSaasCash, saasCashCaption, saasCashCharts, sendSaasCashTelegram } from "@/lib/saas-cash";
import { verifyStaffDigestCronRequest } from "@/lib/staff-digest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`[dashboard-saas-cash-telegram] ${name} is required`);
  return value;
}

async function toPng(svg: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
}

/**
 * The owner's morning SaaS revenue Telegram (owner 2026-11-21): cash collected, agency
 * excluded, as two charts (weekly bars, cumulative line) + the gross / net / with-agency
 * figures in the caption. Every figure is features-service's (`/v1/features/audit/saas-cash`).
 * Triggered by the box cron `cron-saas-cash-telegram.sh` at 07:00 Paris, same CRON_SECRET
 * bearer as the clients Telegram, same bot and owner chat.
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
    const cash = await fetchSaasCash(config);
    const { weeklySvg, cumulativeSvg } = saasCashCharts(cash);
    const caption = saasCashCaption(cash);
    const [weekly, cumulative] = await Promise.all([toPng(weeklySvg), toPng(cumulativeSvg)]);
    await sendSaasCashTelegram(config, caption, { weekly, cumulative });
    console.log(`[dashboard-saas-cash-telegram] sent: ${caption.replace(/\n/g, " | ")}`);
    return NextResponse.json({ ok: true, caption });
  } catch (err) {
    console.error("[dashboard-saas-cash-telegram] cron failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
