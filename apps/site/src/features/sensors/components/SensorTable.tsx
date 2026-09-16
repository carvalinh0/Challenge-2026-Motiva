import {
  Activity,
  Crosshair,
  Pencil,
  RotateCcw,
  Ruler,
  Trash2,
} from "lucide-react";
import { formatTimestamp } from "@/utils/format";
import {
  NIVEL_BADGE_CLASS,
  getNivel,
  nivelFromValue,
} from "@/utils/sensorStatus";
import type { SensorSummary } from "@/types/sensor";
import type { SensorAction } from "../types";
import { SensorActionButton } from "./SensorActionButton";

interface SensorTableProps {
  sensors: SensorSummary[];
  running: Record<string, SensorAction>;
  onMeasure: (sensor: SensorSummary) => void;
  onHealthcheck: (sensor: SensorSummary) => void;
  onCalibrate: (sensor: SensorSummary) => void;
  onEdit: (sensor: SensorSummary) => void;
  onReset: (sensor: SensorSummary) => void;
  onDelete: (sensor: SensorSummary) => void;
}

export function SensorTable({
  sensors,
  running,
  onMeasure,
  onHealthcheck,
  onCalibrate,
  onEdit,
  onReset,
  onDelete,
}: SensorTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 text-gray-600 dark:border-gray-600 dark:text-gray-300">
          <tr>
            <th className="p-2">Id</th>
            <th className="p-2">Nome</th>
            <th className="p-2">Tipo</th>
            <th className="p-2">Status</th>
            <th className="p-2">Última leitura</th>
            <th className="p-2">Momento da última leitura</th>
            <th className="p-2">Criado em</th>
            <th className="p-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="text-gray-800 dark:text-gray-100">
          {sensors.map((sensor) => {
            // Proxy não tem "nível" de grama, mas reporta valor como qualquer
            // nó — por isso a leitura crua quando é proxy.
            const nivel =
              sensor.type === "proxy"
                ? nivelFromValue(sensor.lastMeasurement?.value)
                : (getNivel(sensor) ?? nivelFromValue(null));
            const busy = running[sensor.id];

            return (
              <tr
                key={sensor.id}
                className="border-b border-gray-100 dark:border-gray-600"
              >
                <td className="p-2 font-medium">{sensor.id}</td>
                <td className="p-2">{sensor.name || "—"}</td>
                <td className="p-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      sensor.type === "proxy"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-200"
                    }`}
                  >
                    {sensor.type === "proxy" ? "Mensageiro" : "Sensor"}
                  </span>
                </td>
                <td className="p-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      sensor.active
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {sensor.active ? "Ativo" : "Offline"}
                  </span>
                </td>
                <td className="p-2">
                  {/* Estado com rótulo, nunca só cor. */}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${NIVEL_BADGE_CLASS[nivel]}`}
                  >
                    {nivel}
                  </span>
                </td>
                <td className="p-2 tabular-nums text-gray-500 dark:text-gray-300">
                  {formatTimestamp(sensor.lastMeasurement?.timestamp)}
                </td>
                <td className="p-2 tabular-nums text-gray-500 dark:text-gray-300">
                  {formatTimestamp(sensor.createdAt)}
                </td>
                <td className="p-2">
                  <div className="flex justify-end gap-1">
                    <SensorActionButton
                      title="Realizar medição"
                      icon={Ruler}
                      loading={busy === "measure"}
                      disabled={Boolean(busy)}
                      onClick={() => onMeasure(sensor)}
                    />
                    <SensorActionButton
                      title="Verificar funcionamento"
                      icon={Activity}
                      loading={busy === "health"}
                      disabled={Boolean(busy)}
                      onClick={() => onHealthcheck(sensor)}
                    />
                    <SensorActionButton
                      title="Reajustar janela de leitura do sensor"
                      icon={Crosshair}
                      loading={busy === "calibrate"}
                      disabled={Boolean(busy)}
                      onClick={() => onCalibrate(sensor)}
                    />
                    <SensorActionButton
                      title="Editar"
                      icon={Pencil}
                      disabled={Boolean(busy)}
                      onClick={() => onEdit(sensor)}
                    />
                    <SensorActionButton
                      title="Resetar"
                      icon={RotateCcw}
                      loading={busy === "reset"}
                      disabled={Boolean(busy)}
                      onClick={() => onReset(sensor)}
                    />
                    <SensorActionButton
                      title="Excluir"
                      icon={Trash2}
                      danger
                      loading={busy === "delete"}
                      disabled={Boolean(busy)}
                      onClick={() => onDelete(sensor)}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
