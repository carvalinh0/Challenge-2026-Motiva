// Setup do tema dos gráficos (Recharts). Paleta validada com o validador da
// skill de dataviz contra as superfícies REAIS deste site — card branco no
// claro, gray-700 no escuro — e não contra as superfícies de referência, que
// são mais escuras.
//
// O modo escuro tem passos próprios, escolhidos para o fundo gray-700; não é
// um "flip" automático do claro:
//   - o vermelho #d03b3b cai para 2.15:1 sobre gray-700, então no escuro vira
//     #e66767 (≥3:1);
//   - o azul #2a78d6 idem, vira #5598e7 (o passo #3987e5 dava 2.83:1 e o
//     #86b6ef ficava abaixo do piso de croma, lendo como cinza).
//
// Alto/Baixo/Sem leitura são ESTADOS, não identidades — por isso usam a paleta
// de status (good/warning/critical), nunca as cores categóricas de série.
// O amarelo fica abaixo de 3:1 no claro por natureza: a compensação prevista é
// rótulo visível + tabela, e as duas coisas existem na tela de gráficos.

export interface ChartColors {
  alto: string;
  baixo: string;
  semLeitura: string;
  semDados: string;
  serie: string;
  grid: string;
  axis: string;
  textPrimary: string;
  textMuted: string;
  surface: string;
}

export const chartPalette: Record<"light" | "dark", ChartColors> = {
  light: {
    alto: "#d03b3b",
    baixo: "#0ca30c",
    semLeitura: "#fab219",
    semDados: "#898781",
    serie: "#2a78d6",
    grid: "#e1e0d9",
    axis: "#c3c2b7",
    textPrimary: "#0b0b0b",
    textMuted: "#52514e",
    surface: "#ffffff",
  },
  dark: {
    alto: "#e66767",
    baixo: "#0ca30c",
    semLeitura: "#fab219",
    semDados: "#898781",
    serie: "#5598e7",
    grid: "#4b5563",
    axis: "#6b7280",
    textPrimary: "#ffffff",
    textMuted: "#c3c2b7",
    surface: "#374151",
  },
};

export function getChartColors(darkMode: boolean): ChartColors {
  return darkMode ? chartPalette.dark : chartPalette.light;
}

/** Estilo compartilhado do tooltip, para todos os gráficos reagirem igual. */
export function tooltipStyle(colors: ChartColors) {
  return {
    contentStyle: {
      background: colors.surface,
      border: `1px solid ${colors.grid}`,
      borderRadius: "0.5rem",
      color: colors.textPrimary,
      fontSize: "0.8rem",
    },
    labelStyle: { color: colors.textMuted },
    itemStyle: { color: colors.textPrimary },
  };
}
