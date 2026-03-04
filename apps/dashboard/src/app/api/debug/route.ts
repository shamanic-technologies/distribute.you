import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const hasApiKey = !!process.env.DISTRIBUTE_API_KEY;
  const apiUrl = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

  let authResult: { userId: string | null; orgId: string | null } = { userId: null, orgId: null };
  let authError: string | null = null;
  try {
    const { userId, orgId } = await auth();
    authResult = { userId, orgId };
  } catch (err) {
    authError = err instanceof Error ? err.message : String(err);
  }

  let apiReachable = false;
  let apiError: string | null = null;
  try {
    const res = await fetch(`${apiUrl}/health`);
    apiReachable = res.ok;
  } catch (err) {
    apiError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    hasApiKey,
    apiUrl,
    auth: authResult,
    authError,
    apiReachable,
    apiError,
    nodeVersion: process.version,
  });
}
