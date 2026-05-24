import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { OutrankWebhookSchema, extractArticles } from "@/lib/blog/outrank-schema";
import { upsertArticle } from "@/lib/blog/db";

export const runtime = "nodejs";

function getExpectedToken(): string {
  const token = process.env.OUTRANK_WEBHOOK_SECRET;
  if (!token) {
    throw new Error("[landing/outrank] OUTRANK_WEBHOOK_SECRET is not configured");
  }
  return token;
}

function isAuthorized(request: NextRequest): boolean {
  const expected = getExpectedToken();
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return false;
  return header.slice(7).trim() === expected;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    console.warn("[landing/outrank] unauthorized webhook attempt");
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = OutrankWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[landing/outrank] invalid payload", JSON.stringify(parsed.error.issues));
    return NextResponse.json(
      { message: "Invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const articles = extractArticles(parsed.data);

  for (const article of articles) {
    const saved = await upsertArticle(article);
    console.log(
      `[landing/outrank] upserted slug=${saved.slug} id=${saved.id} event=${parsed.data.event_type}`,
    );
    revalidatePath(`/blog/${saved.slug}`);
    revalidateTag(`blog-article-${saved.slug}`, "default");
  }
  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  revalidateTag("blog-articles", "default");

  return NextResponse.json({ message: "Webhook processed successfully" });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "outrank-webhook",
    method: "POST",
    auth: "Authorization: Bearer <OUTRANK_WEBHOOK_SECRET>",
    supportedEvents: ["publish_articles", "update_article"],
    docs: "https://www.outrank.so/docs/webhook",
  });
}
