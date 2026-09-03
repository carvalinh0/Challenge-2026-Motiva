import { request } from "@/lib/httpClient";
import type { AuthenticatedUser, LoginResult } from "../types";

// Rotas de autenticação. Nenhum componente monta URL na mão — se um caminho
// mudar na API, muda só aqui.
export const authApi = {
  /** Única rota pública da API. */
  login: (username: string, password: string) =>
    request<LoginResult>("/api/auth/login", {
      method: "POST",
      body: { username, password },
    }),

  /** Confirma se o token ainda vale e de quem ele é. */
  me: (token?: string) => request<AuthenticatedUser>("/api/auth/me", { token }),
};
