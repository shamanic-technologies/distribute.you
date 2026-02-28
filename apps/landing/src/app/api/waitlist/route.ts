import { NextRequest, NextResponse } from "next/server";

const LIFECYCLE_EMAILS_SERVICE_URL = process.env.LIFECYCLE_EMAILS_SERVICE_URL;
const LIFECYCLE_EMAILS_SERVICE_API_KEY = process.env.LIFECYCLE_EMAILS_SERVICE_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (!LIFECYCLE_EMAILS_SERVICE_URL || !LIFECYCLE_EMAILS_SERVICE_API_KEY) {
      console.error("LIFECYCLE_EMAILS_SERVICE_URL or API_KEY is not configured");
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(`${LIFECYCLE_EMAILS_SERVICE_URL}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": LIFECYCLE_EMAILS_SERVICE_API_KEY,
      },
      body: JSON.stringify({
        appId: "distribute",
        eventType: "waitlist",
        recipientEmail: email,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: "Unknown error" }));
      console.error(`Lifecycle emails service error (${response.status}):`, JSON.stringify(errorBody));
      return NextResponse.json(
        { error: "Failed to send confirmation email", details: errorBody },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waitlist signup error:", error);
    return NextResponse.json(
      { error: "Failed to process signup" },
      { status: 500 }
    );
  }
}
