import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Moldura padrão das seções com título — gráficos, mapa e tabelas usam esta. */
export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: PanelProps) {
  return (
    <section className={`rounded-lg bg-white p-4 shadow-lg dark:bg-gray-700 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h2>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-300">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
