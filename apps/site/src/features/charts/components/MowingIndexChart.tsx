import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getChartColors, tooltipStyle } from "@/lib/chartTheme";
import { useLayoutContext } from "@/routes/layoutContext";
import type { ReadingsByDay } from "../types";

/** Série única — sem legenda; o título do painel já nomeia a série. */
export function MowingIndexChart({ data }: { data: ReadingsByDay[] }) {
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
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={colors.grid} vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis domain={[0, 100]} unit="%" width={45} {...axisProps} />
          {/* O formatter do Recharts entrega `ValueType | undefined`, então o
              tipo do parâmetro vem da inferência e o valor é normalizado. */}
          <Tooltip
            {...tooltipStyle(colors)}
            formatter={(value) => [`${Number(value)}%`, "Acima do limite"]}
          />
          <Line
            type="monotone"
            dataKey="highPercent"
            stroke={colors.alto}
            strokeWidth={2}
            dot={{ r: 4, fill: colors.alto, stroke: colors.surface, strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
