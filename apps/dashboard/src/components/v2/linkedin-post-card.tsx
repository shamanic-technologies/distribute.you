"use client";

import { useState } from "react";
import { Initials } from "@/components/v2/ui";
import { formatCount } from "@/lib/format-number";
import {
  isLongPost,
  linkedinAge,
  textRuns,
  topReactionKinds,
  type PostAuthorView,
  type PostCommentView,
  type PostMediaView,
  type PostView,
  type ReactionKind,
  type TextLink,
} from "@/lib/v2/linkedin-post-view";

/**
 * One LinkedIn post, drawn the way LinkedIn's own feed draws it (owner 2026-10-07: "copier
 * coller du format de posts sur LinkedIn"): author row, text folded after three lines with
 * "…more", media, the reaction icons and counts, the action bar, then the comments. The
 * colours stay v2 tokens; the anatomy is LinkedIn's. Action bar items do something real:
 * Comment opens the comments, the others open the post on LinkedIn.
 */

const REACTION_LOOK: Record<ReactionKind, { glyph: string; bg: string; label: string }> = {
  like: { glyph: "👍", bg: "#378fe9", label: "Like" },
  celebrate: { glyph: "👏", bg: "#6dae4f", label: "Celebrate" },
  support: { glyph: "🤲", bg: "#a872e8", label: "Support" },
  love: { glyph: "❤️", bg: "#f6573b", label: "Love" },
  insightful: { glyph: "💡", bg: "#f5bb5c", label: "Insightful" },
  funny: { glyph: "😂", bg: "#44bfd3", label: "Funny" },
};

function Avatar({ author, size, round }: { author: PostAuthorView; size: number; round: boolean }) {
  const [broken, setBroken] = useState(false);
  if (author.avatarUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={author.avatarUrl}
        alt=""
        onError={() => setBroken(true)}
        className={`shrink-0 object-cover ${round ? "rounded-full" : "rounded-[4px]"}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return <Initials name={author.name} size={size} round={round} />;
}

function AuthorName({ author, className }: { author: PostAuthorView; className: string }) {
  return author.url ? (
    <a href={author.url} target="_blank" rel="noopener noreferrer" className={`${className} hover:text-[var(--accent)] hover:underline`}>
      {author.name}
    </a>
  ) : (
    <span className={className}>{author.name}</span>
  );
}

function PostText({ text, links }: { text: string; links: TextLink[] }) {
  const long = isLongPost(text);
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="px-4 pb-2 text-[14px] leading-[20px]">
      <p className={`whitespace-pre-wrap break-words ${long && !open ? "line-clamp-3" : ""}`}>
        {textRuns(text, links).map((r, i) =>
          !r.linked ? (
            <span key={i}>{r.text}</span>
          ) : r.url ? (
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--accent)] hover:underline">
              {r.text}
            </a>
          ) : (
            <span key={i} className="font-semibold text-[var(--accent)]">
              {r.text}
            </span>
          ),
        )}
      </p>
      {long && !open && (
        <button type="button" onClick={() => setOpen(true)} className="k-fg3 text-[14px] hover:text-[var(--accent)] hover:underline">
          …more
        </button>
      )}
    </div>
  );
}

function Media({ media }: { media: PostMediaView }) {
  if (media.kind === "images") {
    const urls = media.urls.slice(0, 4);
    if (urls.length === 0) return null;
    return (
      <div className={`grid gap-0.5 ${urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {urls.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={u}
            src={u}
            alt=""
            loading="lazy"
            className={`w-full bg-[var(--bg-inset)] object-cover ${urls.length === 1 ? "max-h-[560px]" : "aspect-square"} ${urls.length === 3 && i === 0 ? "col-span-2 aspect-[2/1]" : ""}`}
          />
        ))}
      </div>
    );
  }
  if (media.kind === "video") {
    return (
      <a href={media.url ?? undefined} target="_blank" rel="noopener noreferrer" className="relative block bg-[var(--bg-inset)]">
        {media.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.thumbnailUrl} alt="" loading="lazy" className="max-h-[560px] w-full object-cover" />
        ) : (
          <div className="aspect-video w-full" />
        )}
        <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white">
          <svg width="22" height="22" viewBox="0 0 16 16" aria-label="Play video">
            <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" />
          </svg>
        </span>
      </a>
    );
  }
  if (media.kind === "article") {
    return (
      <a href={media.url} target="_blank" rel="noopener noreferrer" className="block bg-[var(--bg-inset)] hover:bg-[var(--bg-hover)]">
        {media.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.imageUrl} alt="" loading="lazy" className="aspect-[1.91/1] w-full object-cover" />
        )}
        <div className="px-3 py-2">
          <p className="line-clamp-2 text-[14px] font-semibold leading-[20px]">{media.title ?? media.url}</p>
          {media.source && <p className="k-fg3 text-[12px]">{media.source}</p>}
        </div>
      </a>
    );
  }
  return (
    <a href={media.url ?? undefined} target="_blank" rel="noopener noreferrer" className="block bg-[var(--bg-inset)]">
      {media.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.thumbnailUrl} alt="" loading="lazy" className="max-h-[560px] w-full object-contain" />
      )}
      <p className="px-3 py-2 text-[14px] font-semibold">
        {media.title ?? "Document"}
        {media.pageCount != null && <span className="k-fg3 font-normal"> · {media.pageCount} pages</span>}
      </p>
    </a>
  );
}

function ReactionIcons({ kinds }: { kinds: ReactionKind[] }) {
  return (
    <span className="flex items-center">
      {kinds.map((k, i) => (
        <span
          key={k}
          title={REACTION_LOOK[k].label}
          className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] ring-2 ring-[var(--bg-raised)]"
          style={{ background: REACTION_LOOK[k].bg, marginLeft: i === 0 ? 0 : -4, zIndex: 3 - i }}
        >
          {REACTION_LOOK[k].glyph}
        </span>
      ))}
    </span>
  );
}

function ActionIcon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
const ACTION_D = {
  like: "M6 9.5V16H3.5V9.5Zm0 0 3-5.5c1.2 0 2 .9 1.8 2.1L10.3 8.5h4.4c1 0 1.7.9 1.5 1.9l-1 4.5c-.2.7-.8 1.1-1.5 1.1H6",
  comment: "M3.5 4.5h13v9h-7l-3.5 3v-3h-2.5z",
  repost: "M5 7.5 7.5 5 10 7.5M7.5 5v7.5a2 2 0 0 0 2 2H12M15 12.5 12.5 15 10 12.5M12.5 15V7.5a2 2 0 0 0-2-2H8",
  send: "M17 3 3 9l5.5 2.5L11 17zM8.5 11.5 17 3",
};

function Comment({ c, now }: { c: PostCommentView; now: Date | null }) {
  return (
    <div className="flex gap-2">
      <Avatar author={c.author} size={32} round />
      <div className="min-w-0 flex-1">
        <div className="rounded-[0_8px_8px_8px] bg-[var(--bg-inset)] px-3 py-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <AuthorName author={c.author} className="block truncate text-[14px] font-semibold" />
              {c.author.subtitle && <p className="k-fg3 truncate text-[12px]">{c.author.subtitle}</p>}
            </div>
            {c.postedAt && now && <span className="k-fg3 shrink-0 text-[12px]">{linkedinAge(c.postedAt, now)}</span>}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-[20px]">{c.text}</p>
        </div>
        {c.reactions != null && c.reactions > 0 && (
          <p className="k-fg3 mt-0.5 flex items-center gap-1 pl-3 text-[12px] tabular-nums">
            <ReactionIcons kinds={["like"]} /> {formatCount(c.reactions)}
          </p>
        )}
      </div>
    </div>
  );
}

function AuthorRow({ author, postedAt, now, size, postUrl }: { author: PostAuthorView; postedAt: string | null; now: Date | null; size: number; postUrl?: string }) {
  return (
    <div className="flex items-start gap-2 px-4 pb-2 pt-3">
      <Avatar author={author} size={size} round={false} />
      <div className="min-w-0 flex-1 leading-[16px]">
        <AuthorName author={author} className="block truncate text-[14px] font-semibold leading-[20px]" />
        {author.subtitle && <p className="k-fg3 truncate text-[12px]">{author.subtitle}</p>}
        <p className="k-fg3 flex items-center gap-1 text-[12px]">
          {postedAt && now ? (
            postUrl ? (
              <a href={postUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] hover:underline">
                {linkedinAge(postedAt, now)}
              </a>
            ) : (
              linkedinAge(postedAt, now)
            )
          ) : null}
          {postedAt && now && <span aria-hidden="true">•</span>}
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-label="Public">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
            <path d="M2 8h12M8 2c1.8 2 1.8 10 0 12M8 2c-1.8 2-1.8 10 0 12" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        </p>
      </div>
    </div>
  );
}

export function LinkedInPostCard({ post, now }: { post: PostView; now: Date | null }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const kinds = post.reactions ? topReactionKinds(post.reactions.byKind) : [];
  const counts = [
    post.commentsCount ? `${formatCount(post.commentsCount)} comment${post.commentsCount === 1 ? "" : "s"}` : null,
    post.repostsCount ? `${formatCount(post.repostsCount)} repost${post.repostsCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  const hasSocial = (post.reactions?.total ?? 0) > 0 || counts.length > 0;
  const action = "k-fg2 flex h-12 flex-1 items-center justify-center gap-1.5 rounded-[4px] text-[14px] font-semibold hover:bg-[var(--bg-hover)]";
  return (
    <article className="k-card overflow-hidden">
      {post.header && (
        <p className="k-fg3 mx-4 border-b border-[var(--line-subtle)] py-2 text-[12px]">{post.header}</p>
      )}
      <AuthorRow author={post.author} postedAt={post.postedAt} now={now} size={48} postUrl={post.url} />
      <PostText text={post.text} links={post.links} />
      {post.media && <Media media={post.media} />}
      {post.original && (
        <div className="mx-4 mb-2 overflow-hidden rounded-[8px] border border-[var(--line)]">
          <AuthorRow author={post.original.author} postedAt={post.original.postedAt} now={now} size={32} postUrl={post.original.url} />
          <PostText text={post.original.text} links={post.original.links} />
          {post.original.media && <Media media={post.original.media} />}
        </div>
      )}
      {hasSocial && (
        <div className="k-fg3 flex items-center gap-2 px-4 py-2 text-[12px] tabular-nums">
          {post.reactions && post.reactions.total > 0 && (
            <span className="flex items-center gap-1">
              <ReactionIcons kinds={kinds.length > 0 ? kinds : ["like"]} />
              {formatCount(post.reactions.total)}
            </span>
          )}
          <span className="ml-auto flex gap-1">
            {post.commentsCount ? (
              <button type="button" onClick={() => setCommentsOpen((v) => !v)} className="hover:text-[var(--accent)] hover:underline">
                {counts[0]}
              </button>
            ) : null}
            {counts.length === 2 && <span aria-hidden="true">•</span>}
            {post.repostsCount ? <span>{counts[counts.length - 1]}</span> : null}
          </span>
        </div>
      )}
      <div className="mx-4 flex border-t border-[var(--line-subtle)] py-1">
        <a href={post.url} target="_blank" rel="noopener noreferrer" className={action}>
          <ActionIcon d={ACTION_D.like} /> Like
        </a>
        <button type="button" onClick={() => setCommentsOpen((v) => !v)} aria-expanded={commentsOpen} className={action}>
          <ActionIcon d={ACTION_D.comment} /> Comment
        </button>
        <a href={post.url} target="_blank" rel="noopener noreferrer" className={action}>
          <ActionIcon d={ACTION_D.repost} /> Repost
        </a>
        <a href={post.url} target="_blank" rel="noopener noreferrer" className={action}>
          <ActionIcon d={ACTION_D.send} /> Send
        </a>
      </div>
      {commentsOpen && (
        <div className="space-y-3 px-4 pb-4 pt-1">
          {post.comments.length === 0 ? (
            <p className="k-fg3 text-[13px]">
              {post.commentsStatus === "failed"
                ? "The comments could not be read from LinkedIn."
                : post.commentsStatus === "not_fetched"
                  ? "The comments have not been read yet."
                  : "No comments yet."}
            </p>
          ) : (
            post.comments.map((c) => <Comment key={c.id} c={c} now={now} />)
          )}
          {post.commentsCount != null && post.commentsCount > post.comments.length && (
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="k-fg2 block text-[13px] font-semibold hover:text-[var(--accent)] hover:underline">
              See all {formatCount(post.commentsCount)} comments on LinkedIn
            </a>
          )}
        </div>
      )}
    </article>
  );
}
