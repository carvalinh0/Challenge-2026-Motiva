// Contrato de transporte da API — o envelope que TODA rota devolve.
// Espelha `apps/api/src/http/response.ts`.
//
// Os tipos aqui são escritos à mão de propósito: importar direto do pacote da
// API acoplaria o build do site ao código-fonte do servidor. Se um dia isso
// incomodar, o caminho é extrair um pacote `packages/contracts` compartilhado
// pelos dois — não importar de `apps/api`.

export interface ApiSuccess<T> {
  status: "success";
  message?: string;
  data?: T;
}

export interface ApiFailure {
  status: "error";
  message: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
