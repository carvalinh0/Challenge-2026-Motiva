import { createContext } from "react";
import type { AuthState } from "../types";

// O contexto mora num arquivo sem JSX de propósito: se fosse exportado do
// mesmo módulo do provider, o Fast Refresh do Vite deixaria de funcionar
// naquele arquivo (regra react-refresh/only-export-components).
export const AuthContext = createContext<AuthState | null>(null);
