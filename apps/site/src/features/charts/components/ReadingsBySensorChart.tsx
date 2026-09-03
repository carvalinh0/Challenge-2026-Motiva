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
import { getChartColors, tooltipStyle } from "@/lib/chartTheme";
import { useLayoutContext } from "@/routes/layoutContext";
import type { ReadingsBySensor } from "../types";

/**
 * Parte-do-todo por sensor: barras empilhadas horizontais, que aguentam nomes
 * longos de nó sem cortar rótulo.
 */
export function ReadingsBySensorChart({ data }: { data: ReadingsBySensor[] }) {
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
    <div style={{ height: Math.max(150, data.length * 42 + 64) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
        >
          <CartesianGrid stroke={colors.grid} horizontal={false} strokeWidth={1} />
          <XAxis type="number" allowDecimals={false} {...axisProps} />
          <YAxis type="category" dataKey="id" width={90} {...axisProps} />
          <Tooltip
            {...tooltipStyle(colors)}
            cursor={{ fill: colors.grid, fillOpacity: 0.3 }}
          />
          <Legend wrapperStyle={{ fontSize: "0.8rem", color: colors.textMuted }} />
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
  );
}
