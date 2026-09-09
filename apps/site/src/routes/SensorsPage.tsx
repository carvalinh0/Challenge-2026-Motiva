import { useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Alert } from "@/components/Alert";
import { FilterChips } from "@/components/FilterChips";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import {
  SensorFormModal,
  SensorTable,
  sensorsApi,
  useSensorActions,
  useSensors,
} from "@/features/sensors";
import type { SensorFilterOption, SensorFormState } from "@/features/sensors";
import type { SensorInput } from "@/types/sensor";

const FILTERS: readonly SensorFilterOption[] = [
  { label: "Todos", value: {} },
  { label: "Ativos", value: { active: true } },
  { label: "Perdidos", value: { lost: true } },
] as const;

export function SensorsPage() {
  const [filter, setFilter] = useState<SensorFilterOption>(FILTERS[0]!);
  const [modal, setModal] = useState<SensorFormState | null>(null);

  // O objeto de filtro entra como dependência de efeito no hook — sem
  // memoizar, cada render criaria um novo e o efeito rodaria em loop.
  const filters = useMemo(() => filter.value, [filter]);

  const { sensors, loading, error, reload, refresh } = useSensors(filters);
  const actions = useSensorActions(reload);

  async function submitForm(id: number, data: SensorInput) {
    if (modal?.mode === "edit") await sensorsApi.update(id, data);
    else if (modal?.mode === "createProxy") await sensorsApi.createProxy(id, data);
    else await sensorsApi.create(id, data);
    await reload();
  }

  return (
    <main className="flex-1 overflow-x-hidden">
      <PageHeader title="Sensores">
        <button
          onClick={refresh}
          disabled={loading}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-600"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
        <button
          onClick={() => setModal({ mode: "createProxy" })}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-600"
        >
          <Plus size={16} /> Proxy
        </button>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#6126F1] px-3 py-1.5 text-sm text-white hover:bg-[#4107d4]"
        >
          <Plus size={16} /> Sensor
        </button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 p-4 pb-0">
        <FilterChips options={FILTERS} selected={filter} onSelect={setFilter} />
      </div>

      {actions.feedback && (
        <Alert tone={actions.feedback.tone === "success" ? "success" : "error"}>
          {actions.feedback.text}
        </Alert>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <div className="p-4">
        <Panel
          title={`${sensors.length} nó(s) cadastrado(s)`}
          description="Ações de mesh falam com o hardware de verdade e podem demorar (medição ~90s, calibração ~4min)."
        >
          {loading && sensors.length === 0 ? (
            <p className="py-8 text-center text-gray-500 dark:text-gray-300">
              Carregando...
            </p>
          ) : sensors.length === 0 ? (
            <p className="py-8 text-center text-gray-500 dark:text-gray-300">
              Nenhum nó neste filtro.
            </p>
          ) : (
            <SensorTable
              sensors={sensors}
              running={actions.running}
              onMeasure={actions.measure}
              onHealthcheck={actions.healthcheck}
              onCalibrate={actions.calibrate}
              onEdit={(sensor) => setModal({ mode: "edit", sensor })}
              onReset={actions.reset}
              onDelete={actions.remove}
            />
          )}
        </Panel>
      </div>

      {modal && (
        <SensorFormModal
          mode={modal.mode}
          initial={modal.sensor}
          onClose={() => setModal(null)}
          onSubmit={submitForm}
        />
      )}
    </main>
  );
}
