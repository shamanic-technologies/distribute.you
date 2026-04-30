import Link from "next/link";

interface BreadcrumbNavProps {
  service?: string;
  table?: string;
}

export function BreadcrumbNav({ service, table }: BreadcrumbNavProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-gray-500">
      <Link href="/" className="hover:text-gray-900 transition-colors">
        Home
      </Link>
      {service && (
        <>
          <span>/</span>
          <Link
            href={`/${service}`}
            className={`hover:text-gray-900 transition-colors ${!table ? "text-gray-900 font-medium" : ""}`}
          >
            {service}
          </Link>
        </>
      )}
      {table && (
        <>
          <span>/</span>
          <span className="text-gray-900 font-medium">{table}</span>
        </>
      )}
    </nav>
  );
}
