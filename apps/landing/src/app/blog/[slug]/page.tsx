import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Section } from "@/components/section";
import { PROD_URLS } from "@/lib/env-urls";
import {
  BRAND_LOGO_URL,
  DEFAULT_OG_IMAGE_PATH,
  TWITTER_HANDLE,
} from "@/lib/seo";
import { getArticleBySlug } from "@/lib/blog/db";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Article not found — distribute" };
  const articleUrl = `${PROD_URLS.landing}/blog/${article.slug}`;
  const image = article.coverImageUrl
    ? [{ url: article.coverImageUrl }]
    : [{ url: DEFAULT_OG_IMAGE_PATH, width: 1200, height: 630, alt: article.title }];
  return {
    title: `${article.title} — distribute`,
    description: article.excerpt ?? undefined,
    alternates: { canonical: articleUrl },
    openGraph: {
      type: "article",
      url: articleUrl,
      title: article.title,
      description: article.excerpt ?? undefined,
      images: image,
      siteName: "distribute",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt ?? undefined,
      images: article.coverImageUrl ? [article.coverImageUrl] : [DEFAULT_OG_IMAGE_PATH],
      creator: TWITTER_HANDLE,
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
  const articleUrl = `${PROD_URLS.landing}/blog/${article.slug}`;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt,
    url: articleUrl,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    image: article.coverImageUrl ?? `${PROD_URLS.landing}${DEFAULT_OG_IMAGE_PATH}`,
    publisher: {
      "@type": "Organization",
      name: "distribute",
      url: PROD_URLS.landing,
      logo: BRAND_LOGO_URL,
    },
  };

  return (
    <main className="dy-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Navbar />

      <Section variant="prose" outerClassName="dy-section-tight" as="div">
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-1 text-sm text-[var(--dy-sub)] transition hover:text-[var(--dy-accent-hi)]"
        >
          ← All articles
        </Link>

        <header className="mb-10">
          <div className="dy-mono mb-4 flex flex-wrap items-center gap-3 text-xs text-[var(--dy-muted)]">
            <time dateTime={article.publishedAt} className="font-medium">
              {formatDate(article.publishedAt)}
            </time>
            {article.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-full bg-[var(--dy-surface-hi)] px-2 py-0.5 text-[var(--dy-sub)]"
              >
                {t}
              </span>
            ))}
          </div>

          <h1 className="dy-title mb-5 text-3xl md:text-5xl">
            {article.title}
          </h1>

          {article.excerpt && (
            <p className="dy-body text-lg md:text-xl">
              {article.excerpt}
            </p>
          )}
        </header>

        {article.coverImageUrl && (
          <div className="relative mb-12 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-[var(--dy-border-hi)] bg-[var(--dy-surface-hi)]">
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
              prose-headings:text-[var(--dy-text)] prose-headings:tracking-tight
              prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-12 prose-h3:text-xl
              prose-p:text-[var(--dy-sub)] prose-p:leading-relaxed
              prose-a:text-[var(--dy-accent-hi)] prose-a:no-underline hover:prose-a:underline
              prose-strong:text-[var(--dy-text)]
              prose-blockquote:border-l-[var(--dy-accent)] prose-blockquote:bg-[var(--dy-surface)] prose-blockquote:py-1 prose-blockquote:not-italic
              prose-code:text-[var(--dy-accent-hi)] prose-code:bg-[var(--dy-accent-dim)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-[var(--dy-surface)] prose-pre:text-[var(--dy-text)]
              prose-img:rounded-xl prose-img:border prose-img:border-[var(--dy-border-hi)]
              prose-li:text-[var(--dy-sub)]
            "
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : article.contentMarkdown ? (
          <pre className="whitespace-pre-wrap font-sans leading-relaxed text-[var(--dy-sub)]">
            {article.contentMarkdown}
          </pre>
        ) : (
          <p className="text-[var(--dy-muted)]">No content available for this article.</p>
        )}

        <div className="mt-16 flex items-center justify-between border-t border-[var(--dy-border)] pt-8 text-sm">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-[var(--dy-sub)] transition hover:text-[var(--dy-accent-hi)]"
          >
            ← All articles
          </Link>
          <span className="dy-mono text-xs text-[var(--dy-muted)]">
            Updated {formatDate(article.updatedAt)}
          </span>
        </div>
      </Section>

      <Footer />
    </main>
  );
}
