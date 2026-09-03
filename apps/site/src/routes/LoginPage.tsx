import { Navigate } from "react-router-dom";
import { LoginForm, useAuth } from "@/features/auth";
import { ROUTES } from "@/config/constants";
import backgroundImage from "@/assets/rodovia_aerea.jpeg";

export function LoginPage() {
  const { isAuthenticated, loading } = useAuth();

  // Quem já tem sessão válida não precisa ver o formulário de novo.
  if (!loading && isAuthenticated) return <Navigate to={ROUTES.dashboard} replace />;

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center bg-cover bg-center p-6"
      style={{
        backgroundImage: `
          linear-gradient(
            to right,
            rgb(142 115 232 / 75%),
            rgb(94 34 243 / 75%),
            rgb(48 10 174 / 75%)
          ),
          url(${backgroundImage})
        `,
      }}
    >
      <LoginForm />
    </div>
  );
}
