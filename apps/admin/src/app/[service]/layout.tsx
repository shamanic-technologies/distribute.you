import { fetchTables } from "@/lib/admin-api";
import { ServiceSidebar } from "@/components/service-sidebar";
import { ServiceTabs } from "@/components/service-tabs";

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
      <main className="flex-1 p-8">
        <ServiceTabs service={service} />
        {children}
      </main>
    </div>
  );
}
