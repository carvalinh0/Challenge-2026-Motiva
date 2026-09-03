interface FilterChipsProps<T extends { label: string }> {
  options: readonly T[];
  selected: T;
  onSelect: (option: T) => void;
}

/**
 * Linha de filtros em pílula. Genérica de propósito: o filtro de período dos
 * gráficos e o de estado dos sensores são o mesmo controle com dados
 * diferentes.
 */
export function FilterChips<T extends { label: string }>({
  options,
  selected,
  onSelect,
}: FilterChipsProps<T>) {
  return (
    <>
      {options.map((option) => (
        <button
          key={option.label}
          onClick={() => onSelect(option)}
          className={`cursor-pointer rounded-full px-3 py-1 text-sm ${
            option.label === selected.label
              ? "bg-[#6126F1] text-white"
              : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          }`}
        >
          {option.label}
        </button>
      ))}
    </>
  );
}
