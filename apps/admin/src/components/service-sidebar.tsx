import Link from "next/link";

interface ServiceSidebarProps {
  services?: { name: string }[];
  tables?: { name: string }[];
  currentService?: string;
  currentTable?: string;
}

export function ServiceSidebar({ services, tables, currentService, currentTable }: ServiceSidebarProps) {
  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white min-h-screen p-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        {tables ? "Tables" : "Services"}
      </h2>
      <ul className="space-y-0.5">
        {tables
          ? tables.map((t) => (
              <li key={t.name}>
                <Link
                  href={`/${currentService}/${t.name}`}
                  className={`block px-3 py-1.5 rounded text-sm transition-colors ${
                    currentTable === t.name
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {t.name}
                </Link>
              </li>
            ))
          : services?.map((s) => (
              <li key={s.name}>
                <Link
                  href={`/${s.name}`}
                  className={`block px-3 py-1.5 rounded text-sm transition-colors ${
                    currentService === s.name
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {s.name}
                </Link>
              </li>
            ))}
      </ul>
    </aside>
  );
}
