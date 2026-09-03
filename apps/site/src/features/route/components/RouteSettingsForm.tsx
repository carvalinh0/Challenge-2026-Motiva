import { MapPin } from "lucide-react";
import type { RouteSettings } from "../hooks/useRoutePlan";

interface RouteSettingsFormProps {
  settings: RouteSettings;
  onChange: (patch: Partial<RouteSettings>) => void;
}

const FIELD_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 " +
  "dark:border-gray-500 dark:bg-gray-600 dark:text-white";

const LABEL_CLASS = "block text-xs font-medium text-gray-500 dark:text-gray-300";

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className={LABEL_CLASS}>
        {label}
        {suffix && <span className="font-normal"> ({suffix})</span>}
      </span>
      <input
        type="number"
        className={`mt-1 ${FIELD_CLASS}`}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          // Campo vazio vira NaN; manter o valor anterior evita o formulário
          // entrar num estado inválido enquanto a pessoa digita.
          if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
        }}
      />
    </label>
  );
}

export function RouteSettingsForm({ settings, onChange }: RouteSettingsFormProps) {
  const { base } = settings;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <div className="col-span-2 lg:col-span-3">
        <span className={LABEL_CLASS}>Base da equipe</span>
        <p className="mt-1 flex items-center gap-2 text-sm text-gray-800 dark:text-white">
          <MapPin size={16} className="shrink-0 text-[#6126F1]" />
          {base ? (
            `${base.latitude.toFixed(5)}, ${base.longitude.toFixed(5)}`
          ) : (
            <span className="text-gray-500 dark:text-gray-300">
              clique no mapa para definir de onde a equipe sai
            </span>
          )}
        </p>
      </div>

      <NumberField
        label="Paradas no dia"
        value={settings.targetStops}
        min={1}
        max={30}
        onChange={(targetStops) => onChange({ targetStops })}
      />

      <NumberField
        label="Jornada"
        suffix="horas"
        value={settings.workdayHours}
        min={1}
        max={16}
        step={0.5}
        onChange={(workdayHours) => onChange({ workdayHours })}
      />

      <NumberField
        label="Roçada por ponto"
        suffix="min"
        value={settings.serviceMinutes}
        min={5}
        max={480}
        step={5}
        onChange={(serviceMinutes) => onChange({ serviceMinutes })}
      />

      <label className="block">
        <span className={LABEL_CLASS}>Saída da base</span>
        <input
          type="time"
          className={`mt-1 ${FIELD_CLASS}`}
          value={settings.departure}
          onChange={(event) => onChange({ departure: event.target.value })}
        />
      </label>
    </div>
  );
}
