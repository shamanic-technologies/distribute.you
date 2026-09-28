import type { Metadata } from "next";
import { brandQuery, parseInviteBrand } from "@/lib/org-invite";
import { JoinPageClient } from "./join-page";

/**
 * Server shell of the invite-link page, so the link previews as what it is. Pasted
 * into WhatsApp, Slack or an email, it used to unfurl as the generic dashboard
 * ("distribute.you Dashboard / Manage your API keys"). The preview now names the team
 * and shows `distribute.you × <brand logo>`, from the brand the link carries.
 */
type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
  return q;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const brand = parseInviteBrand(toParams(await searchParams));
  const title = brand ? `Join the ${brand.name} team on distribute.you` : "Join your team on distribute.you";
  const description = brand
    ? `You are invited to join ${brand.name} on distribute.you. Open the link, sign in, and you are in.`
    : "You are invited to join a team on distribute.you. Open the link, sign in, and you are in.";
  const q = brandQuery(brand);
  const image = `/api/public/og/join${q ? `?${q}` : ""}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params;
  return <JoinPageClient token={decodeURIComponent(token)} />;
}
