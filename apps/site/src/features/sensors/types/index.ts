import type { SensorFilters, SensorSummary } from "@/types/sensor";

/** Modo do formulário — cria sensor, cria proxy ou edita um existente. */
export type SensorFormMode = "create" | "createProxy" | "edit";

export interface SensorFormState {
  mode: SensorFormMode;
  sensor?: SensorSummary;
}

/** Ação de mesh/CRUD em andamento num nó, para spinner e bloqueio de botões. */
export type SensorAction =
  | "measure"
  | "health"
  | "calibrate"
  | "reset"
  | "delete";

export interface SensorFilterOption {
  label: string;
  value: SensorFilters;
}

export interface FeedbackMessage {
  tone: "success" | "error";
  text: string;
}
