import { NIVEL, NIVEL_BADGE_CLASS } from "@/utils/sensorStatus";

type FilterableNivel = typeof NIVEL.ALTO | typeof NIVEL.BAIXO;

const FILTER_OPTIONS: FilterableNivel[] = [NIVEL.ALTO, NIVEL.BAIXO];

interface StatusFilterProps {
  value: FilterableNivel | null;
  onChange: (value: FilterableNivel | null) => void;
}

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 pt-4">
      {FILTER_OPTIONS.map((nivel) => {
        const active = value === nivel;
        return (
          <button
            key={nivel}
            type="button"
            onClick={() => onChange(active ? null : nivel)}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              active
                ? `${NIVEL_BADGE_CLASS[nivel]} border-transparent`
                : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {nivel}
          </button>
        );
      })}
    </div>
  );
}
