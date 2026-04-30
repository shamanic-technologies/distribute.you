import { fetchRows, fetchTableSchema } from "@/lib/admin-api";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { DataTable } from "@/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";

export default async function TablePage({
  params,
  searchParams,
}: {
  params: Promise<{ service: string; table: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { service, table } = await params;
  const sp = await searchParams;

  const limit = Number(sp.limit) || 50;
  const offset = Number(sp.offset) || 0;
  const sort = (typeof sp.sort === "string" ? sp.sort : "") || "created_at";
  const order = (typeof sp.order === "string" ? sp.order : "desc") as "asc" | "desc";
  const search = typeof sp.search === "string" ? sp.search : "";

  const [schema, rowsData] = await Promise.all([
    fetchTableSchema(service, table),
    fetchRows(service, table, { limit, offset, sort, order, search }),
  ]);

  const columns: ColumnDef<Record<string, unknown>>[] = schema.map((col) => ({
    accessorKey: col.name,
    header: col.name,
  }));

  return (
    <div>
      <BreadcrumbNav service={service} table={table} />
      <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-6">{table}</h1>
      <DataTable
        columns={columns}
        data={rowsData.rows}
        total={rowsData.total}
        limit={limit}
        offset={offset}
        sort={sort}
        order={order}
        search={search}
        serviceName={service}
        tableName={table}
      />
    </div>
  );
}
