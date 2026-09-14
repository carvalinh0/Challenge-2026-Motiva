import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getChartColors, tooltipStyle } from "@/lib/chartTheme";
import { useLayoutContext } from "@/routes/layoutContext";
import type { ReadingsBySensor } from "../types";

/**
 * Parte-do-todo por sensor: barras empilhadas horizontais, que aguentam nomes
 * longos de nó sem cortar rótulo.
 */
export function ReadingsBySensorChart({
  data,
  page = 1,
  totalPages = 1,
  totalSensors = data.length,
  onPageChange,
}: {
  data: ReadingsBySensor[];
  page?: number;
  totalPages?: number;
  totalSensors?: number;
  onPageChange?: (page: number) => void;
}) {
  const { darkMode } = useLayoutContext();
  const colors = getChartColors(darkMode);

  const axisProps = {
    stroke: colors.axis,
    tick: { fill: colors.textMuted, fontSize: 12 },
    tickLine: false,
  };

  return (
    // Altura por linha + faixa do eixo: o container cresce com os dados em vez
    // de espremer os rótulos do eixo.
    <div>
      <div style={{ height: Math.max(150, data.length * 42 + 64) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
          >
            <CartesianGrid
              stroke={colors.grid}
              horizontal={false}
              strokeWidth={1}
            />
            <XAxis type="number" allowDecimals={false} {...axisProps} />
            <YAxis type="category" dataKey="name" width={120} {...axisProps} />
            <Tooltip
              {...tooltipStyle(colors)}
              cursor={{ fill: colors.grid, fillOpacity: 0.3 }}
            />
            <Legend
              wrapperStyle={{ fontSize: "0.8rem", color: colors.textMuted }}
            />
            {/* Marcas finas (maxBarSize) e 2px de superfície entre segmentos —
              nada de contorno em volta das marcas. */}
            <Bar
              dataKey="Alto"
              stackId="leituras"
              fill={colors.alto}
              stroke={colors.surface}
              strokeWidth={2}
              maxBarSize={26}
            />
            <Bar
              dataKey="Baixo"
              stackId="leituras"
              fill={colors.baixo}
              stroke={colors.surface}
              strokeWidth={2}
              maxBarSize={26}
            />
            <Bar
              dataKey="Sem leitura"
              stackId="leituras"
              fill={colors.semLeitura}
              stroke={colors.surface}
              strokeWidth={2}
              maxBarSize={26}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {totalPages > 1 && onPageChange && (
        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-600">
          <span className="text-xs text-gray-500 dark:text-gray-300">
            Página {page} de {totalPages} · {totalSensors} sensor(es)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              aria-label="Página anterior"
              className="cursor-pointer rounded-lg border border-gray-300 p-1.5 disabled:opacity-40 dark:border-gray-500"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              aria-label="Próxima página"
              className="cursor-pointer rounded-lg border border-gray-300 p-1.5 disabled:opacity-40 dark:border-gray-500"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
