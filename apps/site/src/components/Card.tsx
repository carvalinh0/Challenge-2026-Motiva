import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface CardProps {
  title: string;
  info: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  titleClassName?: string;
  infoClassName?: string;
}

/**
 * Stat tile: um número por card. É a forma certa para um valor único — um
 * gráfico de uma barra só não diria nada além do que o número já diz.
 */
export function Card({
  title,
  info,
  hint,
  icon: Icon,
  titleClassName = "",
  infoClassName = "",
}: CardProps) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-gray-700">
      <div className="flex items-center justify-between gap-2">
        <h2 className={`text-xl font-bold ${titleClassName}`}>{title}</h2>
        {Icon && <Icon size={20} className={infoClassName} aria-hidden="true" />}
      </div>
      {/* Figuras proporcionais (sem tabular-nums): número grande solto. */}
      <p className={`p-1 text-3xl font-semibold ${infoClassName}`}>{info}</p>
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}
