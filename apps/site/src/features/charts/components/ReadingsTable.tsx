import type { ReadingsBySensor } from "../types";

/**
 * Visão em tabela dos mesmos dados dos gráficos. Existe porque toda
 * codificação por cor precisa de um equivalente textual — e porque o amarelo
 * de "sem leitura" fica abaixo de 3:1 no tema claro, o que exige essa
 * alternativa.
 */
export function ReadingsTable({ data }: { data: ReadingsBySensor[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 text-gray-600 dark:border-gray-600 dark:text-gray-300">
          <tr>
            <th className="p-2">Sensor</th>
            <th className="p-2 text-right">Alto</th>
            <th className="p-2 text-right">Baixo</th>
            <th className="p-2 text-right">Sem leitura</th>
            <th className="p-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="tabular-nums text-gray-800 dark:text-gray-100">
          {data.map((row) => (
            <tr key={row.id} className="border-b border-gray-100 dark:border-gray-600">
              <td className="p-2 font-medium">{row.id}</td>
              <td className="p-2 text-right">{row.Alto}</td>
              <td className="p-2 text-right">{row.Baixo}</td>
              <td className="p-2 text-right">{row["Sem leitura"]}</td>
              <td className="p-2 text-right">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
