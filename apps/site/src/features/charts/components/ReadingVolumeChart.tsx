import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getChartColors, tooltipStyle } from "@/lib/chartTheme";
import { useLayoutContext } from "@/routes/layoutContext";
import type { ReadingsByDay } from "../types";

/** Volume diário de medições — queda aqui é sinal de nó mudo. */
export function ReadingVolumeChart({ data }: { data: ReadingsByDay[] }) {
  const { darkMode } = useLayoutContext();
  const colors = getChartColors(darkMode);

  const axisProps = {
    stroke: colors.axis,
    tick: { fill: colors.textMuted, fontSize: 12 },
    tickLine: false,
  };

  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={colors.grid} vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis allowDecimals={false} width={35} {...axisProps} />
          <Tooltip
            {...tooltipStyle(colors)}
            cursor={{ fill: colors.grid, fillOpacity: 0.3 }}
            formatter={(value) => [Number(value), "Leituras"]}
          />
          <Bar dataKey="total" fill={colors.serie} radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
