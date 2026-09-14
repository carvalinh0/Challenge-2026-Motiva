import { useState } from "react";
import { RefreshCw, TableProperties } from "lucide-react";
import { Alert } from "@/components/Alert";
import { FilterChips } from "@/components/FilterChips";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import {
  MowingIndexChart,
  PERIOD_OPTIONS,
  ReadingVolumeChart,
  ReadingsBySensorChart,
  ReadingsTable,
  useChartData,
} from "@/features/charts";
import type { PeriodOption } from "@/features/charts";

export function ChartsPage() {
  const [period, setPeriod] = useState<PeriodOption>(PERIOD_OPTIONS[1]!);
  const [showTable, setShowTable] = useState(false);

  const {
    loading,
    error,
    bySensor,
    byDay,
    totalReadings,
    page,
    setPage,
    totalSensors,
    totalPages,
  } = useChartData(period);

  return (
    <main className="flex-1 overflow-x-hidden">
      <PageHeader title="Gráficos">
        <button
          onClick={() => setShowTable((current) => !current)}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-600"
        >
          <TableProperties size={16} />
          {showTable ? "Ver gráficos" : "Ver tabela"}
        </button>
      </PageHeader>

      {/* Filtro único, acima de tudo que ele afeta: os três gráficos
          re-renderizam sobre a mesma fatia. */}
      <div className="flex flex-wrap items-center gap-2 p-4 pb-0">
        <FilterChips
          options={PERIOD_OPTIONS}
          selected={period}
          onSelect={setPeriod}
        />
        <span className="ml-auto text-sm text-gray-500 dark:text-gray-300">
          {loading ? "Carregando..." : `${totalReadings} leitura(s) no período`}
        </span>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {!loading && totalReadings === 0 && !error && (
        <div className="m-4 rounded-lg bg-white p-8 text-center shadow-lg dark:bg-gray-700">
          <RefreshCw
            size={28}
            className="mx-auto mb-2 text-gray-400 dark:text-gray-300"
          />
          <p className="font-medium text-gray-700 dark:text-white">
            Nenhuma medição no período
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-300">
            Escolha um período maior ou acione uma medição na aba Sensores.
          </p>
        </div>
      )}

      {totalReadings > 0 && showTable && (
        <div className="p-4">
          <Panel
            title="Tabela de leituras"
            description="Os mesmos dados dos gráficos, em texto."
          >
            <ReadingsTable data={bySensor} />
          </Panel>
        </div>
      )}

      {totalReadings > 0 && !showTable && (
        <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2">
          <Panel
            title="Leituras por sensor"
            description="Quantas vezes cada sensor reportou cada estado."
            className="xl:col-span-2"
          >
            <div className="max-h-[32rem] overflow-y-auto pr-2">
              <ReadingsBySensorChart
                data={bySensor}
                page={page}
                totalPages={totalPages}
                totalSensors={totalSensors}
                onPageChange={setPage}
              />
            </div>
          </Panel>

          <Panel
            title="Índice de roçada"
            description="% das leituras do dia que vieram acima do limite."
          >
            <MowingIndexChart data={byDay} />
          </Panel>

          <Panel
            title="Total de leituras recebidas por dia"
            description="Quantas medições foram recebidas"
          >
            <ReadingVolumeChart data={byDay} />
          </Panel>
        </div>
      )}
    </main>
  );
}
