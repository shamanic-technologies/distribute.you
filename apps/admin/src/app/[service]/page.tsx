import Link from "next/link";
import { fetchTables } from "@/lib/admin-api";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";

export default async function ServicePage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service } = await params;
  const tables = await fetchTables(service);

  return (
    <div>
      <BreadcrumbNav service={service} />
      <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-6">{service}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((table) => (
          <Link
            key={table.name}
            href={`/${service}/${table.name}`}
            className="block p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
            data-testid="table-card"
          >
            <h2 className="text-lg font-semibold text-gray-900">{table.name}</h2>
            <p className="mt-1 text-sm text-gray-500">{table.rowCount} rows</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {table.columns.slice(0, 5).map((col) => (
                <span
                  key={col}
                  className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                >
                  {col}
                </span>
              ))}
              {table.columns.length > 5 && (
                <span className="inline-block px-2 py-0.5 text-gray-400 text-xs">
                  +{table.columns.length - 5} more
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
