import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { Alert } from "@/components/Alert";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import {
  SensorFormModal,
  SensorConfirmationModal,
  SensorTable,
  sensorsApi,
  useSensorActions,
  useSensorsPage,
} from "@/features/sensors";
import type { SensorFormState } from "@/features/sensors";
import type {
  SensorInput,
  SensorPageQuery,
  SensorSummary,
  SensorType,
} from "@/types/sensor";
import { getNivel, NIVEL, nivelFromValue } from "@/utils/sensorStatus";

const SENSORS_PER_PAGE = 20;

const TYPE_FILTERS = [
  { label: "Todos", value: "all" },
  { label: "Sensores", value: "sensor" },
  { label: "Mensageiros", value: "proxy" },
] as const;

const STATUS_FILTERS = [
  { label: "Todos", value: "all" },
  { label: "Ativos", value: "active" },
  { label: "Offline", value: "offline" },
] as const;

const READING_FILTERS = [
  { label: "Todos", value: "all" },
  { label: NIVEL.ALTO, value: NIVEL.ALTO },
  { label: NIVEL.BAIXO, value: NIVEL.BAIXO },
  { label: NIVEL.SEM_LEITURA, value: NIVEL.SEM_LEITURA },
  { label: NIVEL.SEM_DADOS, value: NIVEL.SEM_DADOS },
] as const;

type SensorPageFilters = {
  search: string;
  type: SensorType | "all";
  status: "active" | "offline" | "all";
  reading: (typeof READING_FILTERS)[number]["value"];
  createdFrom: string;
  createdTo: string;
  readingFrom: string;
  readingTo: string;
};

const INITIAL_FILTERS: SensorPageFilters = {
  search: "",
  type: "all",
  status: "all",
  reading: "all",
  createdFrom: "",
  createdTo: "",
  readingFrom: "",
  readingTo: "",
};

export function SensorsPage() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<SensorFormState | null>(null);

  const serverFilters = useMemo<SensorPageQuery>(
    () => ({
      page: page + 1,
      limit: SENSORS_PER_PAGE,
      name: filters.search || undefined,
      type: filters.type === "all" ? undefined : filters.type,
      active: filters.status === "active" ? true : undefined,
      lost: filters.status === "offline" ? true : undefined,
      createdFrom: filters.createdFrom || undefined,
      createdTo: filters.createdTo || undefined,
    }),
    [filters, page],
  );
  const {
    items: sensors,
    total,
    totalPages,
    loading,
    error,
    reload,
    refresh,
  } = useSensorsPage(serverFilters);
  const actions = useSensorActions(reload);

  const filteredSensors = useMemo(
    () => sensors.filter((sensor) => matchesFilters(sensor, filters)),
    [filters, sensors],
  );
  const pageCount = totalPages;
  const currentPage = Math.min(page, pageCount - 1);

  useEffect(() => {
    setPage(0);
  }, [filters]);

  useEffect(() => {
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  function updateFilter<K extends keyof SensorPageFilters>(
    key: K,
    value: SensorPageFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(INITIAL_FILTERS);
  }

  async function submitForm(id: number, data: SensorInput) {
    if (modal?.mode === "edit") await sensorsApi.update(id, data);
    else if (modal?.mode === "createProxy")
      await sensorsApi.createProxy(id, data);
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
          <Plus size={16} /> Mensageiro
        </button>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#6126F1] px-3 py-1.5 text-sm text-white hover:bg-[#4107d4]"
        >
          <Plus size={16} /> Sensor
        </button>
      </PageHeader>

      <div className="flex flex-wrap items-end gap-3 p-4 pb-0">
        <NameSearch
          value={filters.search}
          onChange={(value) => updateFilter("search", value)}
        />
        <FilterSelect
          label="Tipo"
          value={filters.type}
          options={TYPE_FILTERS}
          onChange={(value) =>
            updateFilter("type", value as SensorPageFilters["type"])
          }
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          options={STATUS_FILTERS}
          onChange={(value) =>
            updateFilter("status", value as SensorPageFilters["status"])
          }
        />
        <FilterSelect
          label="Última leitura"
          value={filters.reading}
          options={READING_FILTERS}
          onChange={(value) =>
            updateFilter("reading", value as SensorPageFilters["reading"])
          }
        />
        <DateRange
          label="Criado entre"
          from={filters.createdFrom}
          to={filters.createdTo}
          onFromChange={(value) => updateFilter("createdFrom", value)}
          onToChange={(value) => updateFilter("createdTo", value)}
        />
        <DateRange
          label="Última leitura entre"
          from={filters.readingFrom}
          to={filters.readingTo}
          onFromChange={(value) => updateFilter("readingFrom", value)}
          onToChange={(value) => updateFilter("readingTo", value)}
        />
        <button
          type="button"
          onClick={clearFilters}
          className="h-9 cursor-pointer rounded-lg border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          Limpar filtros
        </button>
      </div>

      {actions.feedback && (
        <Alert tone={actions.feedback.tone === "success" ? "success" : "error"}>
          {actions.feedback.text}
        </Alert>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <div className="p-4">
        <Panel
          title={`${filteredSensors.length} de ${total} sensores`}
          description="Ações na rede falam com os sensores de verdade e podem demorar (medição ~90s, calibração ~4min)."
        >
          {loading && sensors.length === 0 ? (
            <p className="py-8 text-center text-gray-500 dark:text-gray-300">
              Carregando...
            </p>
          ) : filteredSensors.length === 0 ? (
            <p className="py-8 text-center text-gray-500 dark:text-gray-300">
              Nenhum sensor neste filtro.
            </p>
          ) : (
            <SensorTable
              sensors={filteredSensors}
              running={actions.running}
              onMeasure={actions.measure}
              onHealthcheck={actions.healthcheck}
              onCalibrate={actions.calibrate}
              onEdit={(sensor) => setModal({ mode: "edit", sensor })}
              onReset={actions.reset}
              onDelete={actions.remove}
            />
          )}
          {total > SENSORS_PER_PAGE && (
            <Pagination
              currentPage={currentPage}
              pageCount={pageCount}
              total={total}
              onPrevious={() => setPage((value) => Math.max(0, value - 1))}
              onNext={() =>
                setPage((value) => Math.min(pageCount - 1, value + 1))
              }
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

      {actions.confirmation && (
        <SensorConfirmationModal
          action={actions.confirmation.action}
          sensor={actions.confirmation.sensor}
          onCancel={actions.cancel}
          onConfirm={actions.confirm}
        />
      )}
    </main>
  );
}

function matchesFilters(sensor: SensorSummary, filters: SensorPageFilters) {
  if (
    filters.search &&
    !normalizeText(sensor.name ?? "").includes(normalizeText(filters.search))
  ) {
    return false;
  }
  if (filters.type !== "all" && sensor.type !== filters.type) return false;
  if (filters.status === "active" && !sensor.active) return false;
  if (filters.status === "offline" && sensor.active) return false;

  const reading =
    sensor.type === "proxy"
      ? nivelFromValue(sensor.lastMeasurement?.value)
      : (getNivel(sensor) ?? nivelFromValue(null));
  if (filters.reading !== "all" && reading !== filters.reading) return false;

  return (
    inDateRange(sensor.createdAt, filters.createdFrom, filters.createdTo) &&
    inDateRange(
      sensor.lastMeasurement?.timestamp,
      filters.readingFrom,
      filters.readingTo,
    )
  );
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function inDateRange(timestamp: number | undefined, from: string, to: string) {
  if (!from && !to) return true;
  if (timestamp == null) return false;
  const date = new Date(timestamp);
  if (from && date < new Date(`${from}T00:00:00`)) return false;
  if (to && date > new Date(`${to}T23:59:59.999`)) return false;
  return true;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-28 cursor-pointer rounded-lg border border-gray-300 bg-white px-2 text-sm font-normal text-gray-800 dark:border-gray-500 dark:bg-gray-700 dark:text-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NameSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
      Buscar por nome
      <span className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Nome do sensor"
          className="h-9 w-48 rounded-lg border border-gray-300 bg-white pl-8 pr-2 text-sm font-normal text-gray-800 outline-none focus:ring-2 focus:ring-purple-300 dark:border-gray-500 dark:bg-gray-700 dark:text-white"
        />
      </span>
    </label>
  );
}

function DateRange({
  label,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  label: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
        {label}
      </legend>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-300">
          De
          <input
            type="date"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
            className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-800 dark:border-gray-500 dark:bg-gray-700 dark:text-white"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-300">
          Até
          <input
            type="date"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
            className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-800 dark:border-gray-500 dark:bg-gray-700 dark:text-white"
          />
        </label>
      </div>
    </fieldset>
  );
}

function Pagination({
  currentPage,
  pageCount,
  total,
  onPrevious,
  onNext,
}: {
  currentPage: number;
  pageCount: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const first = currentPage * SENSORS_PER_PAGE + 1;
  const last = Math.min((currentPage + 1) * SENSORS_PER_PAGE, total);

  return (
    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-600">
      <span className="text-xs text-gray-500 dark:text-gray-300">
        Exibindo {first}–{last} de {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentPage === 0}
          aria-label="Página anterior"
          className="cursor-pointer rounded-lg border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-600"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-20 text-center text-sm text-gray-600 dark:text-gray-200">
          Página {currentPage + 1} de {pageCount}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={currentPage === pageCount - 1}
          aria-label="Próxima página"
          className="cursor-pointer rounded-lg border border-gray-300 p-1.5 text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-600"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
