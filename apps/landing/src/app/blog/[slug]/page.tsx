import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Section } from "@/components/section";
import { PROD_URLS } from "@/lib/env-urls";
import { getArticleBySlug } from "@/lib/blog/db";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Article not found — distribute" };
  const articleUrl = `${PROD_URLS.landing}/blog/${article.slug}`;
  return {
    title: `${article.title} — distribute`,
    description: article.excerpt ?? undefined,
    alternates: { canonical: articleUrl },
    openGraph: {
      type: "article",
      url: articleUrl,
      title: article.title,
      description: article.excerpt ?? undefined,
      images: article.coverImageUrl ? [{ url: article.coverImageUrl }] : undefined,
    },
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const body = article.contentHtml ?? null;

  return (
    <main className="v2-page">
      <Navbar />

      <Section variant="prose" outerClassName="v2-section-tight" as="div">
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-1 text-sm text-[var(--v2-sub)] transition hover:text-[var(--v2-accent-hi)]"
        >
          ← All articles
        </Link>

        <header className="mb-10">
          <div className="v2-mono mb-4 flex flex-wrap items-center gap-3 text-xs text-[var(--v2-muted)]">
            <time dateTime={article.publishedAt} className="font-medium">
              {formatDate(article.publishedAt)}
            </time>
            {article.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-full bg-[var(--v2-surface-hi)] px-2 py-0.5 text-[var(--v2-sub)]"
              >
                {t}
              </span>
            ))}
          </div>

          <h1 className="v2-title mb-5 text-3xl md:text-5xl">
            {article.title}
          </h1>

          {article.excerpt && (
            <p className="v2-body text-lg md:text-xl">
              {article.excerpt}
            </p>
          )}
        </header>

        {article.coverImageUrl && (
          <div className="relative mb-12 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-[var(--v2-border-hi)] bg-[var(--v2-surface-hi)]">
            <Image
              src={article.coverImageUrl}
              alt={article.title}
              fill
              unoptimized
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
        )}
      </Section>

      <Section variant="prose" outerClassName="pb-20" as="article">
        {body ? (
          <div
            className="
              prose prose-lg max-w-none
              prose-headings:text-[var(--v2-text)] prose-headings:tracking-tight
              prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-12 prose-h3:text-xl
              prose-p:text-[var(--v2-sub)] prose-p:leading-relaxed
              prose-a:text-[var(--v2-accent-hi)] prose-a:no-underline hover:prose-a:underline
              prose-strong:text-[var(--v2-text)]
              prose-blockquote:border-l-[var(--v2-accent)] prose-blockquote:bg-[var(--v2-surface)] prose-blockquote:py-1 prose-blockquote:not-italic
              prose-code:text-[var(--v2-accent-hi)] prose-code:bg-[var(--v2-accent-dim)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-[var(--v2-surface)] prose-pre:text-[var(--v2-text)]
              prose-img:rounded-xl prose-img:border prose-img:border-[var(--v2-border-hi)]
              prose-li:text-[var(--v2-sub)]
            "
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : article.contentMarkdown ? (
          <pre className="whitespace-pre-wrap font-sans leading-relaxed text-[var(--v2-sub)]">
            {article.contentMarkdown}
          </pre>
        ) : (
          <p className="text-[var(--v2-muted)]">No content available for this article.</p>
        )}

        <div className="mt-16 flex items-center justify-between border-t border-[var(--v2-border)] pt-8 text-sm">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-[var(--v2-sub)] transition hover:text-[var(--v2-accent-hi)]"
          >
            ← All articles
          </Link>
          <span className="v2-mono text-xs text-[var(--v2-muted)]">
            Updated {formatDate(article.updatedAt)}
          </span>
        </div>
      </Section>

      <Footer />
    </main>
  );
}
