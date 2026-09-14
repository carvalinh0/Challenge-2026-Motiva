import { AlertTriangle, X } from "lucide-react";
import type { SensorSummary } from "@/types/sensor";

export type SensorConfirmationAction = "calibrate" | "reset" | "delete";

interface SensorConfirmationModalProps {
  action: SensorConfirmationAction;
  sensor: SensorSummary;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

const COPY: Record<
  SensorConfirmationAction,
  { title: string; description: string; confirmLabel: string; danger: boolean }
> = {
  calibrate: {
    title: "Recalibrar sensor?",
    description:
      "O sensor tera sua janela de leitura calibrada remotamente. Esse processo pode levar alguns minutos.",
    confirmLabel: "Recalibrar",
    danger: false,
  },
  reset: {
    title: "Resetar sensor?",
    description: "As medições deste sensor serão apagadas e essa ação não pode ser desfeita.",
    confirmLabel: "Resetar",
    danger: false,
  },
  delete: {
    title: "Excluir sensor?",
    description: "O sensor e todas as suas medições serão excluídos permanentemente.",
    confirmLabel: "Excluir",
    danger: true,
  },
};

export function SensorConfirmationModal({
  action,
  sensor,
  onCancel,
  onConfirm,
}: SensorConfirmationModalProps) {
  const copy = COPY[action];

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sensor-confirmation-title"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-700"
      >
        <div className="flex items-start gap-4 border-b border-gray-100 p-6 dark:border-gray-600">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              copy.danger
                ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300"
                : "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            <AlertTriangle size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="sensor-confirmation-title"
              className="text-lg font-bold text-gray-900 dark:text-white"
            >
              {copy.title}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
              Sensor <span className="font-semibold text-gray-700 dark:text-gray-100">{sensor.id}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-600 dark:hover:text-white"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm leading-6 text-gray-600 dark:text-gray-200">{copy.description}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`cursor-pointer rounded-full px-5 py-2 text-sm font-semibold text-white ${
                copy.danger
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-[#6126F1] hover:bg-[#4107d4]"
              }`}
            >
              {copy.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}