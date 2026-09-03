import type { ReactNode } from "react";

export type AlertTone = "success" | "error" | "info";

const TONE_CLASS: Record<AlertTone, string> = {
  success: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  info: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
};

/** Faixa de aviso — o mesmo visual de feedback em todas as telas. */
export function Alert({ tone, children }: { tone: AlertTone; children: ReactNode }) {
  return (
    <div className={`mx-4 mt-4 rounded-lg p-3 text-sm ${TONE_CLASS[tone]}`} role="alert">
      {children}
    </div>
  );
}
