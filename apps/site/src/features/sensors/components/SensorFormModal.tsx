import { useState } from "react";
import type { FormEvent, InputHTMLAttributes } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/Button";
import type { SensorInput, SensorSummary } from "@/types/sensor";
import type { SensorFormMode } from "../types";

interface SensorFormModalProps {
  mode: SensorFormMode;
  initial?: SensorSummary;
  onClose: () => void;
  onSubmit: (id: number, data: SensorInput) => Promise<void>;
}

/**
 * Serve para criar sensor, criar proxy e editar — as três operações mexem nos
 * mesmos campos, e duplicar o formulário criaria três lugares para o contrato
 * da API sair de sincronia.
 */
export function SensorFormModal({
  mode,
  initial,
  onClose,
  onSubmit,
}: SensorFormModalProps) {
  const editing = mode === "edit";
  const isProxy = mode === "createProxy" || initial?.type === "proxy";

  // Campos como string: é o que o <input> devolve, e permite distinguir
  // "vazio" de 0 — sem isso um "sem coordenada" viraria a ilha de Null.
  const [form, setForm] = useState({
    id: initial?.id?.toString() ?? (mode === "createProxy" ? "0" : ""),
    name: "",
    latitude: initial?.latitude?.toString() ?? "",
    longitude: initial?.longitude?.toString() ?? "",
    proxy_id: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: SensorInput = {
        ...(form.name ? { name: form.name } : {}),
        ...(form.latitude !== "" ? { latitude: Number(form.latitude) } : {}),
        ...(form.longitude !== "" ? { longitude: Number(form.longitude) } : {}),
        ...(!isProxy && form.proxy_id ? { proxy_id: Number(form.proxy_id) } : {}),
      };

      await onSubmit(Number(form.id), payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const title = editing
    ? `Editar ${initial?.id}`
    : isProxy
      ? "Novo proxy"
      : "Novo sensor";

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-full w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-700"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <Field
            label="ID"
            value={form.id}
            onValueChange={(v) => update("id", v)}
            disabled={editing}
            required
            hint={editing ? "O id não pode ser alterado." : undefined}
          />
          <Field
            label="Nome"
            value={form.name}
            onValueChange={(v) => update("name", v)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Latitude"
              type="number"
              step="any"
              value={form.latitude}
              onValueChange={(v) => update("latitude", v)}
            />
            <Field
              label="Longitude"
              type="number"
              step="any"
              value={form.longitude}
              onValueChange={(v) => update("longitude", v)}
            />
          </div>
          {!isProxy && (
            <Field
              label="Id do proxy responsável"
              value={form.proxy_id}
              onValueChange={(v) => update("proxy_id", v)}
            />
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full px-4 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-600"
          >
            Cancelar
          </button>
          <Button type="submit" disabled={saving || !form.id} className="w-auto px-6">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  label: string;
  hint?: string;
  onValueChange: (value: string) => void;
};

function Field({ label, hint, onValueChange, ...props }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-100">
        {label}
      </span>
      <input
        {...props}
        onChange={(event) => onValueChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900 outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-gray-100 dark:border-gray-500 dark:bg-gray-600 dark:text-white dark:disabled:bg-gray-800"
      />
      {hint && <span className="text-xs text-gray-500 dark:text-gray-300">{hint}</span>}
    </label>
  );
}
