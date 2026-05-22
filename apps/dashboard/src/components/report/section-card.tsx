import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  description?: string;
  count?: number | null;
  actions?: ReactNode;
  children: ReactNode;
  placeholder?: boolean;
  placeholderNote?: string;
}

export function SectionCard({ title, description, count, actions, children, placeholder, placeholderNote }: SectionCardProps) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <header className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold text-gray-800">{title}</h2>
            {count != null && (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {count.toLocaleString("en-US")}
              </span>
            )}
            {placeholder && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wide">
                Placeholder
              </span>
            )}
          </div>
          {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
          {placeholder && placeholderNote && (
            <p className="text-xs text-amber-700 mt-1">{placeholderNote}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="px-5 py-10 text-center text-sm text-gray-500">{message}</div>
  );
}
