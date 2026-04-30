import Link from "next/link";
import { fetchServices } from "@/lib/admin-api";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { ServiceSidebar } from "@/components/service-sidebar";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const services = await fetchServices();

  return (
    <div className="flex">
      <ServiceSidebar services={services} />
      <main className="flex-1 p-8">
        <BreadcrumbNav />
        <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-6">Services</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <Link
              key={service.name}
              href={`/${service.name}`}
              className="block p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
              data-testid="service-card"
            >
              <h2 className="text-lg font-semibold text-gray-900">{service.name}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {service.tableCount} table{service.tableCount !== 1 ? "s" : ""}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
