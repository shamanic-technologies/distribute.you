import { fetchTables } from "@/lib/admin-api";
import { ServiceSidebar } from "@/components/service-sidebar";

export default async function ServiceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ service: string }>;
}) {
  const { service } = await params;
  const tables = await fetchTables(service);

  return (
    <div className="flex">
      <ServiceSidebar tables={tables} currentService={service} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
