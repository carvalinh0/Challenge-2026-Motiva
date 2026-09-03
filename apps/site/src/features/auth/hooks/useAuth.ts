import { useContext } from "react";
import { AuthContext } from "./authContext";
import type { AuthState } from "../types";

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  }
  return context;
}
