import { Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SensorActionButtonProps {
  title: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
}

/** Botão de ação da tabela: só ícone, com o rótulo em title/aria-label. */
export function SensorActionButton({
  title,
  icon: Icon,
  onClick,
  disabled,
  loading,
  danger,
}: SensorActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`cursor-pointer rounded-lg p-2 disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
      }`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
    </button>
  );
}
