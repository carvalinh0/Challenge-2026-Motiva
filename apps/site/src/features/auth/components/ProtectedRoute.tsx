import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { ROUTES } from "@/config/constants";
import { useAuth } from "../hooks/useAuth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  // Enquanto a sessão está sendo restaurada não dá pra decidir nada:
  // redirecionar aqui mandaria pro login todo reload de quem está logado.
  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-200 dark:bg-gray-800">
        <p className="text-slate-600 dark:text-gray-300">Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to={ROUTES.login} replace />;

  return children;
}
