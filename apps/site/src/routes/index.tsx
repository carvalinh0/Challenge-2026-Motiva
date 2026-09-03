import { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/features/auth";
import { ROUTES } from "@/config/constants";
import { AppLayout } from "./AppLayout";
import { LoginPage } from "./LoginPage";

// Divisão por rota: o Dashboard carrega o Leaflet e a de Gráficos carrega o
// Recharts — as duas bibliotecas mais pesadas do projeto. Sem isso, quem só
// faz login já baixa tudo. O Login fica estático de propósito: é a primeira
// tela, e adiar o carregamento dela só atrasaria o que o usuário já quer ver.
const DashboardPage = lazy(() =>
  import("./DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const SensorsPage = lazy(() =>
  import("./SensorsPage").then((m) => ({ default: m.SensorsPage })),
);
const ChartsPage = lazy(() =>
  import("./ChartsPage").then((m) => ({ default: m.ChartsPage })),
);
const RoutePage = lazy(() =>
  import("./RoutePage").then((m) => ({ default: m.RoutePage })),
);

/** Fallback enquanto o chunk da página chega. */
function PageFallback() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <p className="text-gray-500 dark:text-gray-300">Carregando...</p>
    </main>
  );
}

function lazyPage(element: React.ReactNode) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

/** Mapa de rotas da aplicação. Tudo abaixo de /app exige sessão. */
export const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  { path: "/", element: <Navigate to={ROUTES.dashboard} replace /> },
  {
    path: ROUTES.dashboard,
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: lazyPage(<DashboardPage />) },
      { path: "sensores", element: lazyPage(<SensorsPage />) },
      { path: "graficos", element: lazyPage(<ChartsPage />) },
      { path: "roteiro", element: lazyPage(<RoutePage />) },
    ],
  },
]);
