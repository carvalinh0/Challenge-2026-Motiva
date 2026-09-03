// Constantes globais da aplicação. Valores usados por uma feature só moram na
// própria feature; aqui fica o que é compartilhado ou é decisão de produto.

export const TOKEN_STORAGE_KEY = "motiva.jwt";

export const THEME_STORAGE_KEY = "theme";

/** Chave dos parâmetros do roteiro (base, jornada, nº de paradas). */
export const ROUTE_SETTINGS_STORAGE_KEY = "motiva.roteiro";

/** Quantas medições pedir ao abrir o detalhe de um sensor. */
export const DEFAULT_HISTORY_SIZE = 90;

export const ROUTES = {
  login: "/login",
  dashboard: "/app",
  sensors: "/app/sensores",
  charts: "/app/graficos",
  route: "/app/roteiro",
} as const;
