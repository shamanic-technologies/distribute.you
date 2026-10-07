import { z } from "zod";

/**
 * What one LinkedIn post card draws, and the pure bits of LinkedIn's own way of printing
 * it (relative age "3d", compact counts "1,204", reaction order). Alias-free so the unit
 * tests read the real thing. The reader in `lib/api.ts` maps the producer's shape here.
 */

export type ReactionKind = "like" | "celebrate" | "support" | "love" | "insightful" | "funny";

/** LinkedIn's order of the reaction icons, as its feed stacks them. */
export const REACTION_ORDER: ReactionKind[] = ["like", "celebrate", "support", "love", "insightful", "funny"];

export interface PostAuthorView {
  name: string;
  avatarUrl: string | null;
  /** The grey line under the name: followers for a page, the headline for a person. */
  subtitle: string | null;
  url: string | null;
}

export type PostMediaView =
  | { kind: "images"; urls: string[] }
  | { kind: "video"; thumbnailUrl: string | null; url: string | null }
  | { kind: "article"; url: string; title: string | null; description: string | null; imageUrl: string | null; source: string | null }
  | { kind: "document"; title: string | null; pageCount: number | null; thumbnailUrl: string | null; url: string | null };

export interface PostCommentView {
  id: string;
  author: PostAuthorView;
  text: string;
  postedAt: string | null;
  reactions: number | null;
}

/** A mention, hashtag or link inside a post's text (UTF-16 offsets, as JS strings count). */
export interface TextLink {
  start: number;
  length: number;
  url: string | null;
}

export interface PostView {
  id: string;
  url: string;
  author: PostAuthorView;
  postedAt: string | null;
  text: string;
  links: TextLink[];
  media: PostMediaView | null;
  /** A plain repost: "<page> reposted this", drawn above the original's card. */
  header: string | null;
  /** A quote: the original post, drawn inside the card. */
  original: Omit<PostView, "original" | "comments" | "reactions" | "commentsCount" | "repostsCount" | "header"> | null;
  reactions: { total: number; byKind: Partial<Record<ReactionKind, number>> } | null;
  commentsCount: number | null;
  repostsCount: number | null;
  comments: PostCommentView[];
  /** The producer's word on the comments: `failed` = they could not be read, `not_fetched` = not asked yet. */
  commentsStatus: "fetched" | "none" | "failed" | "not_fetched";
}

/** LinkedIn's age stamp: "now", "12m", "5h", "3d", "2w", "4mo", "1yr". */
export function linkedinAge(iso: string, now: Date): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (now.getTime() - t) / 1000);
  if (s < 60) return "now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h`;
  const d = h / 24;
  if (d < 7) return `${Math.floor(d)}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  return `${Math.floor(d / 365)}yr`;
}

/** The reaction kinds present on a post, most used first (ties in LinkedIn's order), at most three. */
export function topReactionKinds(byKind: Partial<Record<ReactionKind, number>>): ReactionKind[] {
  return REACTION_ORDER.filter((k) => (byKind[k] ?? 0) > 0)
    .sort((a, b) => (byKind[b] ?? 0) - (byKind[a] ?? 0) || REACTION_ORDER.indexOf(a) - REACTION_ORDER.indexOf(b))
    .slice(0, 3);
}

/** The text cut into plain runs and linked runs (mentions, hashtags, links), in order. */
export function textRuns(text: string, links: TextLink[]): { text: string; url: string | null; linked: boolean }[] {
  const runs: { text: string; url: string | null; linked: boolean }[] = [];
  let at = 0;
  for (const l of [...links].sort((a, b) => a.start - b.start)) {
    if (l.start < at || l.start + l.length > text.length || l.length <= 0) continue;
    if (l.start > at) runs.push({ text: text.slice(at, l.start), url: null, linked: false });
    runs.push({ text: text.slice(l.start, l.start + l.length), url: l.url, linked: true });
    at = l.start + l.length;
  }
  if (at < text.length) runs.push({ text: text.slice(at), url: null, linked: false });
  return runs;
}

/** LinkedIn folds a post after three lines; a text this long or with this many breaks gets "…more". */
export function isLongPost(text: string): boolean {
  return text.length > 210 || text.split("\n").length > 3;
}

// ─── The producer's shape (social-service `.../linkedin-posts`, through the gateway) ───────

const AuthorSchema = z.object({
  name: z.string().nullable(),
  type: z.string().nullable(),
  url: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  info: z.string().nullable(),
});

const BodyShape = {
  id: z.string(),
  url: z.string().nullable(),
  postedAt: z.string().nullable(),
  author: AuthorSchema,
  text: z.string().nullable(),
  textAttributes: z.array(z.object({ start: z.number(), length: z.number(), type: z.string(), url: z.string().nullable() })),
  media: z.object({
    images: z.array(z.object({ url: z.string() })),
    video: z.object({ thumbnailUrl: z.string().nullable(), videoUrl: z.string().nullable() }).nullable(),
    article: z
      .object({ title: z.string().nullable(), subtitle: z.string().nullable(), link: z.string().nullable(), description: z.string().nullable(), imageUrl: z.string().nullable() })
      .nullable(),
    document: z.object({ title: z.string().nullable(), pageCount: z.number().nullable(), coverImageUrls: z.array(z.string()), url: z.string().nullable() }).nullable(),
  }),
  reactions: z.object({
    total: z.number().nullable(),
    byType: z.record(z.string(), z.number()).nullable(),
    hiddenByAuthor: z.boolean(),
  }),
  commentsCount: z.number().nullable(),
  repostsCount: z.number().nullable(),
};

const CommentSchema = z.object({
  urn: z.string().nullable(),
  author: z.object({ name: z.string().nullable(), headline: z.string().nullable(), avatarUrl: z.string().nullable(), url: z.string().nullable() }),
  text: z.string().nullable(),
  createdAt: z.string().nullable(),
  reactionCount: z.number().nullable(),
  url: z.string().nullable(),
});

export const LinkedinFeedResponseSchema = z.object({
  status: z.string(),
  reason: z.string().nullable(),
  linkedinPage: z.object({ url: z.string() }).nullable().optional(),
  sync: z.object({ refreshing: z.boolean().optional() }).passthrough().nullable(),
  total: z.number(),
  posts: z.array(
    z.object({
      ...BodyShape,
      kind: z.string(),
      header: z.string().nullable(),
      activityAt: z.string().nullable(),
      repostOf: z.object(BodyShape).nullable(),
      comments: z.object({
        status: z.string(),
        items: z.array(CommentSchema).nullable(),
      }),
    }),
  ),
  nextCursor: z.string().nullable(),
});
export type LinkedinFeedResponse = z.infer<typeof LinkedinFeedResponseSchema>;
type Body = z.infer<z.ZodObject<typeof BodyShape>>;

/** One page of a LinkedIn feed (a brand's company page, or a person's profile), ready to draw. */
export interface LinkedinFeedPage {
  /** `none` = no LinkedIn page/profile was found; `undecided` = the producer could not tell. */
  status: "ready" | "pending" | "failed" | "none" | "undecided";
  reason: string | null;
  sourceUrl: string | null;
  refreshing: boolean;
  total: number;
  posts: PostView[];
  nextCursor: string | null;
}

function feedStatus(s: string): LinkedinFeedPage["status"] {
  if (s === "ready" || s === "pending" || s === "failed") return s;
  if (s.startsWith("no_linkedin")) return "none";
  if (s.endsWith("_unresolved")) return "undecided";
  // A state this reader does not know: say so loudly, draw it as a failure with its name.
  console.error("[dashboard] LinkedIn feed: unknown status", s);
  return "failed";
}

function author(a: z.infer<typeof AuthorSchema>): PostAuthorView {
  return { name: a.name ?? "LinkedIn member", avatarUrl: a.avatarUrl, subtitle: a.info, url: a.url };
}

function media(m: Body["media"]): PostMediaView | null {
  if (m.images.length > 0) return { kind: "images", urls: m.images.map((i) => i.url) };
  if (m.video) return { kind: "video", thumbnailUrl: m.video.thumbnailUrl, url: m.video.videoUrl };
  if (m.document) return { kind: "document", title: m.document.title, pageCount: m.document.pageCount, thumbnailUrl: m.document.coverImageUrls[0] ?? null, url: m.document.url };
  if (m.article?.link) {
    return { kind: "article", url: m.article.link, title: m.article.title, description: m.article.description, imageUrl: m.article.imageUrl, source: m.article.subtitle };
  }
  return null;
}

function reactions(r: Body["reactions"]): PostView["reactions"] {
  if (r.hiddenByAuthor || r.total == null) return null;
  const byKind: Partial<Record<ReactionKind, number>> = {};
  for (const k of REACTION_ORDER) {
    const n = r.byType?.[k];
    if (n) byKind[k] = n;
  }
  return { total: r.total, byKind };
}

function body(b: Body): Omit<PostView, "original" | "comments" | "reactions" | "commentsCount" | "repostsCount" | "header"> {
  return {
    id: b.id,
    url: b.url ?? `https://www.linkedin.com/feed/update/urn:li:activity:${b.id}/`,
    author: author(b.author),
    postedAt: b.postedAt,
    text: b.text ?? "",
    links: b.textAttributes.map((t) => ({ start: t.start, length: t.length, url: t.url })),
    media: media(b.media),
  };
}

function commentsStatus(s: string): PostView["commentsStatus"] {
  if (s === "fetched" || s === "none" || s === "failed" || s === "not_fetched") return s;
  console.error("[dashboard] LinkedIn feed: unknown comments status", s);
  return "failed";
}

export function toLinkedinFeedPage(r: LinkedinFeedResponse): LinkedinFeedPage {
  return {
    status: feedStatus(r.status),
    reason: r.reason,
    sourceUrl: r.linkedinPage?.url ?? null,
    refreshing: r.sync?.refreshing === true,
    total: r.total,
    nextCursor: r.nextCursor,
    posts: r.posts.map((p) => ({
      ...body(p),
      header: p.kind === "repost" ? p.header : null,
      postedAt: p.postedAt ?? p.activityAt,
      original: p.repostOf ? body(p.repostOf) : null,
      reactions: reactions(p.reactions),
      commentsCount: p.commentsCount,
      repostsCount: p.repostsCount,
      commentsStatus: commentsStatus(p.comments.status),
      comments: (p.comments.items ?? []).map((c, i) => ({
        id: c.urn ?? `${p.id}-${i}`,
        author: { name: c.author.name ?? "LinkedIn member", avatarUrl: c.author.avatarUrl, subtitle: c.author.headline, url: c.author.url },
        text: c.text ?? "",
        postedAt: c.createdAt,
        reactions: c.reactionCount,
      })),
    })),
  };
}
