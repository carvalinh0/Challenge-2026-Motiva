import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { tokenStorage } from "@/lib/httpClient";
import { authApi } from "../api/authApi";
import { AuthContext } from "../hooks/authContext";
import type { LoginResult } from "../types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  // Só há o que carregar se existir token salvo — derivar isso do estado
  // inicial evita um setState síncrono dentro do efeito (render em cascata).
  const [loading, setLoading] = useState(() => Boolean(tokenStorage.get()));

  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) return;

    let cancelled = false;
    // Um JWT expirado continua no localStorage; só a API sabe se ainda vale.
    authApi
      .me(token)
      .then((user) => {
        if (!cancelled) setUsername(user?.username ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        tokenStorage.clear();
        setUsername(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (user: string, password: string): Promise<LoginResult> => {
      const result = await authApi.login(user, password);
      if (!result) throw new Error("Resposta de login vazia");
      tokenStorage.set(result.token);
      setUsername(result.username);
      return result;
    },
    [],
  );

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUsername(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ username, isAuthenticated: Boolean(username), loading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
