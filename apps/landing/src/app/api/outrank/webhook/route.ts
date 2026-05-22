import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { OutrankWebhookSchema, extractArticle } from "@/lib/blog/outrank-schema";
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
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() === expected;
  }
  const xToken = request.headers.get("x-outrank-token") ?? "";
  if (xToken && xToken === expected) return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    console.warn("[landing/outrank] unauthorized webhook attempt");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = OutrankWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[landing/outrank] invalid payload", JSON.stringify(parsed.error.issues));
    return NextResponse.json(
      { error: "invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const article = extractArticle(parsed.data);
  const saved = await upsertArticle(article);

  console.log(`[landing/outrank] upserted article slug=${saved.slug} id=${saved.id}`);
  revalidatePath("/blog");
  revalidatePath(`/blog/${saved.slug}`);

  return NextResponse.json({ ok: true, slug: saved.slug, id: saved.id });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "outrank-webhook",
    method: "POST",
    auth: "Authorization: Bearer <OUTRANK_WEBHOOK_SECRET> (or X-Outrank-Token header)",
  });
}
