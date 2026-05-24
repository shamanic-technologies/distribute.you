import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Section } from "@/components/section";
import { getArticleBySlug } from "@/lib/blog/db";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Article not found — distribute" };
  return {
    title: `${article.title} — distribute`,
    description: article.excerpt ?? undefined,
    openGraph: {
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
    <main className="min-h-screen bg-white">
      <Navbar />

      <Section variant="prose" outerClassName="pt-16 pb-8" as="div">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 transition mb-8"
        >
          ← All articles
        </Link>

        <header className="mb-10">
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-4">
            <time dateTime={article.publishedAt} className="font-medium">
              {formatDate(article.publishedAt)}
            </time>
            {article.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
              >
                {t}
              </span>
            ))}
          </div>

          <h1 className="font-display text-3xl md:text-5xl font-bold text-gray-900 tracking-tight leading-tight mb-5">
            {article.title}
          </h1>

          {article.excerpt && (
            <p className="text-lg md:text-xl text-gray-500 leading-relaxed">
              {article.excerpt}
            </p>
          )}
        </header>

        {article.coverImageUrl && (
          <div className="relative w-full aspect-[16/9] mb-12 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
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
              prose prose-lg prose-gray max-w-none
              prose-headings:font-display prose-headings:text-gray-900 prose-headings:tracking-tight
              prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-12 prose-h3:text-xl
              prose-p:text-gray-700 prose-p:leading-relaxed
              prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-gray-900
              prose-blockquote:border-l-brand-400 prose-blockquote:bg-gray-50 prose-blockquote:py-1 prose-blockquote:not-italic
              prose-code:text-brand-700 prose-code:bg-brand-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-gray-900 prose-pre:text-gray-100
              prose-img:rounded-xl prose-img:border prose-img:border-gray-200
              prose-li:text-gray-700
            "
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : article.contentMarkdown ? (
          <pre className="whitespace-pre-wrap text-gray-800 leading-relaxed font-sans">
            {article.contentMarkdown}
          </pre>
        ) : (
          <p className="text-gray-400">No content available for this article.</p>
        )}

        <div className="mt-16 pt-8 border-t border-gray-100 flex items-center justify-between text-sm">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-gray-500 hover:text-brand-600 transition"
          >
            ← All articles
          </Link>
          <span className="text-gray-400">
            Updated {formatDate(article.updatedAt)}
          </span>
        </div>
      </Section>

      <Footer />
    </main>
  );
}
