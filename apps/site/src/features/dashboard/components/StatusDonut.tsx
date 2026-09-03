import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { getChartColors, tooltipStyle } from "@/lib/chartTheme";
import { NIVEL, NIVEL_COLOR_KEY, getNivel } from "@/utils/sensorStatus";
import { useLayoutContext } from "@/routes/layoutContext";
import type { Nivel } from "@/utils/sensorStatus";
import type { SensorSummary } from "@/types/sensor";

// Parte-do-todo com 4 fatias, lido de relance — é o caso em que rosca serve.
// Proxies ficam de fora de propósito: eles não medem altura de grama, então
// misturá-los aqui compararia coisas diferentes na mesma escala.
const ORDER: Nivel[] = [
  NIVEL.ALTO,
  NIVEL.BAIXO,
  NIVEL.SEM_LEITURA,
  NIVEL.SEM_DADOS,
];

export function StatusDonut({ sensors }: { sensors: SensorSummary[] }) {
  const { darkMode } = useLayoutContext();
  const colors = getChartColors(darkMode);

  const counts = sensors
    .filter((s) => s.type === "sensor")
    .reduce<Partial<Record<Nivel, number>>>((acc, sensor) => {
      const nivel = getNivel(sensor);
      if (nivel) acc[nivel] = (acc[nivel] ?? 0) + 1;
      return acc;
    }, {});

  const data = ORDER.filter((nivel) => (counts[nivel] ?? 0) > 0).map((nivel) => ({
    name: nivel,
    value: counts[nivel] ?? 0,
    color: colors[NIVEL_COLOR_KEY[nivel]],
  }));

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-300">
        Nenhum sensor cadastrado
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      {/* Dimensão fixa e `shrink-0`: dentro de um flex, o ResponsiveContainer
          com largura percentual pode medir 0 e não desenhar nada — foi o que
          aconteceu quando a página passou a ser carregada sob lazy/Suspense. */}
      <div className="h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={45}
            outerRadius={75}
            // 2px de respiro entre fatias em vez de contorno nas marcas.
            paddingAngle={2}
            stroke={colors.surface}
            strokeWidth={2}
          >
            {data.map((item) => (
              <Cell key={item.name} fill={item.color} />
            ))}
          </Pie>
          <Tooltip
            {...tooltipStyle(colors)}
            formatter={(value, name) => {
              const count = Number(value);
              return [`${count} sensor${count > 1 ? "es" : ""}`, String(name)];
            }}
          />
        </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda com o valor ao lado: a identidade nunca depende só da cor. */}
      <ul className="space-y-1.5 text-sm">
        {data.map((item) => (
          <li key={item.name} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm"
              style={{ background: item.color }}
              aria-hidden="true"
            />
            <span className="text-gray-700 dark:text-gray-100">
              {item.name}
              <span className="ml-1 font-semibold tabular-nums">{item.value}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
