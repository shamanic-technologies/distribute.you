import { URLS } from "@distribute/content";
import { PROD_URLS } from "@/lib/env-urls";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const BENCHMARKS_URL = `${PROD_URLS.landing}/benchmarks`;

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "distribute", item: PROD_URLS.landing },
    { "@type": "ListItem", position: 2, name: "Benchmarks", item: BENCHMARKS_URL },
  ],
};

export default function BenchmarksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dy-dark-scope">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Navbar />
      {children}
      <Footer
        disclaimer={
          <>
            All data is from real campaigns. Updated hourly.{" "}
            <a href={URLS.github} className="underline hover:text-gray-300">
              Open source methodology.
            </a>
          </>
        }
      />
    </div>
  );
}
