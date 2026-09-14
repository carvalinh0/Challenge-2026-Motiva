import { env } from "@/config/env";
import { TOKEN_STORAGE_KEY } from "@/config/constants";
import type { ApiResponse } from "@/types/api";

// Setup da "biblioteca" de HTTP (aqui, o fetch nativo). Só transporte: quem
// sabe QUAIS rotas existem é a camada `api/` de cada feature.

export class ApiError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    status: number,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** 401/403 = sessão inválida ou expirada; quem chama derruba o login. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** 429 não é culpa da credencial — não pode derrubar a sessão. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** Sem status HTTP: a requisição não chegou a ser respondida. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export const tokenStorage = {
  get: (): string | null => localStorage.getItem(TOKEN_STORAGE_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_STORAGE_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_STORAGE_KEY),
};

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Sobrescreve o token do storage (usado ao validar um token recém-emitido). */
  token?: string | null;
}

/**
 * Faz a requisição, desembrulha o envelope `{status, message?, data?}` e
 * devolve só o `data`. Erros — de rede ou de HTTP — sempre chegam como
 * `ApiError`, para a UI nunca precisar distinguir um `TypeError` do fetch de
 * uma resposta 4xx.
 */
export async function request<T>(
  path: string,
  { method = "GET", body, token }: RequestOptions = {},
): Promise<T | null> {
  const authToken = token !== undefined ? token : tokenStorage.get();

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(
      "Não foi possível falar com a API. Verifique se ela está no ar e se VITE_API_URL está correto.",
      0,
    );
  }

  // 204 = sucesso sem corpo (ex.: push de medição).
  if (response.status === 204) return null;

  const payload = (await response
    .json()
    .catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok) {
    const message =
      payload && payload.status === "error"
        ? payload.message
        : `Erro ${response.status}`;
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ApiError(
      message,
      response.status,
      Number.isFinite(retryAfter) ? retryAfter : null,
    );
  }

  return payload && payload.status === "success"
    ? (payload.data ?? null)
    : null;
}

/** Monta uma query string ignorando valores vazios/indefinidos. */
export function toQuery(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** URL absoluta — necessária para EventSource, que não passa pelo `request`. */
export function absoluteUrl(path: string): string {
  return `${env.apiUrl}${path}`;
}
