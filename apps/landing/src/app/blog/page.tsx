import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Section } from "@/components/section";
import { PROD_URLS } from "@/lib/env-urls";
import { DEFAULT_OG_IMAGE_PATH, TWITTER_HANDLE } from "@/lib/seo";
import { listArticles, type BlogArticle } from "@/lib/blog/db";

export const revalidate = 60;

const BLOG_URL = `${PROD_URLS.landing}/blog`;

export const metadata: Metadata = {
  title: "Blog — Stories from the Solo Path",
  description:
    "Stories, playbooks, and benchmarks for solo builders and small teams running their own distribution — outbound, PR, and growth.",
  alternates: { canonical: BLOG_URL },
  openGraph: {
    type: "website",
    url: BLOG_URL,
    title: "Blog — Stories from the Solo Path",
    description:
      "Stories, playbooks, and benchmarks for solo builders and small teams running their own distribution — outbound, PR, and growth.",
    images: [{ url: DEFAULT_OG_IMAGE_PATH, width: 1200, height: 630, alt: "distribute Blog" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog — Stories from the Solo Path",
    description:
      "Stories, playbooks, and benchmarks for solo builders and small teams running their own distribution — outbound, PR, and growth.",
    images: [DEFAULT_OG_IMAGE_PATH],
    creator: TWITTER_HANDLE,
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function fetchArticles(): Promise<BlogArticle[]> {
  return listArticles(50);
}

function CoverPlaceholder({ title }: { title: string }) {
  const initial = title.trim().charAt(0).toUpperCase() || "•";
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-gradient-to-br from-brand-100 via-brand-50 to-amber-50 flex items-center justify-center">
      <span className="font-display text-6xl text-brand-400/80 select-none">
        {initial}
      </span>
    </div>
  );
}

function FeaturedArticleCard({ article }: { article: BlogArticle }) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-2xl"
    >
      <article className="flex flex-col md:flex-row overflow-hidden rounded-2xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-md transition-all duration-200">
        <div className="md:w-1/2 relative">
          {article.coverImageUrl ? (
            <div className="relative aspect-[16/9] md:aspect-auto md:h-full w-full overflow-hidden bg-gray-100">
              <Image
                src={article.coverImageUrl}
                alt={article.title}
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </div>
          ) : (
            <div className="md:h-full">
              <CoverPlaceholder title={article.title} />
            </div>
          )}
        </div>

        <div className="md:w-1/2 flex flex-col justify-center p-6 md:p-10 lg:p-12">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
            {article.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
              >
                {t}
              </span>
            ))}
          </div>

          <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 group-hover:text-brand-600 transition leading-tight tracking-tight mb-4">
            {article.title}
          </h2>

          {article.excerpt && (
            <p className="text-base text-gray-500 leading-relaxed line-clamp-4 mb-6">
              {article.excerpt}
            </p>
          )}

          <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:gap-2 transition-all">
            Read article
            <span aria-hidden>→</span>
          </span>
        </div>
      </article>
    </Link>
  );
}

function ArticleCard({ article }: { article: BlogArticle }) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-2xl"
    >
      <article className="h-full flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-md transition-all duration-200">
        {article.coverImageUrl ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
            <Image
              src={article.coverImageUrl}
              alt={article.title}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
        ) : (
          <CoverPlaceholder title={article.title} />
        )}

        <div className="flex-1 flex flex-col p-5">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
            {article.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
              >
                {t}
              </span>
            ))}
          </div>

          <h2 className="font-display text-lg font-semibold text-gray-900 group-hover:text-brand-600 transition leading-snug mb-2 line-clamp-2">
            {article.title}
          </h2>

          {article.excerpt && (
            <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 mb-4">
              {article.excerpt}
            </p>
          )}

          <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-brand-600 group-hover:gap-2 transition-all">
            Read article
            <span aria-hidden>→</span>
          </span>
        </div>
      </article>
    </Link>
  );
}

export default async function BlogIndexPage() {
  const articles = await fetchArticles();

  return (
    <main className="dy-page">
      <Navbar />

      <Section variant="prose" outerClassName="dy-section" className="text-center">
        <div className="dy-eyebrow mb-6">
          <span className="dy-dot" />
          distribute blog
        </div>
        <h1 className="dy-title mb-4 text-4xl md:text-5xl">
          Stories from the solo path
        </h1>
        <p className="dy-body mx-auto max-w-xl text-base md:text-lg">
          Playbooks, benchmarks, and field notes on running distribution for a
          portfolio of products — without a marketing team.
        </p>
      </Section>

      <Section variant="wide" outerClassName="pb-24">
        {articles.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No articles yet. Come back soon.
          </div>
        ) : (
          <>
            <FeaturedArticleCard article={articles[0]} />
            {articles.length > 1 && (
              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {articles.slice(1).map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      <Footer />
    </main>
  );
}
