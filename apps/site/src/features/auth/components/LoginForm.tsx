import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import { ROUTES } from "@/config/constants";
import { useAuth } from "../hooks/useAuth";
import MotivaLogo from "@/assets/motiva_title.png";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(ROUTES.dashboard, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // <form> em vez de <div>: dá Enter para enviar e autofill de senha de graça.
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-md flex-col space-y-4 rounded-xl bg-slate-200 p-6 py-5 shadow"
    >
      <h1 className="text-center text-3xl font-bold text-purple-900">Login</h1>

      <p className="mb-2 text-slate-500">
        Monitoramento inteligente e sustentável de roçadas
      </p>

      <label className="font-semibold text-purple-900" htmlFor="username">
        Usuário
      </label>
      <input
        id="username"
        name="username"
        autoComplete="username"
        autoFocus
        className="h-12 w-full rounded-xl bg-white px-4 text-purple-900 shadow-md outline-none focus:ring-2 focus:ring-purple-300"
        type="text"
        placeholder="Digite seu usuário"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />

      <label className="font-semibold text-purple-900" htmlFor="password">
        Senha
      </label>
      <input
        id="password"
        name="password"
        autoComplete="current-password"
        className="h-12 w-full rounded-xl bg-white px-4 text-purple-900 shadow-md outline-none focus:ring-2 focus:ring-purple-300"
        type="password"
        placeholder="Digite sua senha"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      {error && (
        <p role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 text-center">
        <Button
          type="submit"
          disabled={submitting || !username || !password}
          className="inline-flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Entrando..." : "Entrar"}
        </Button>
      </div>

      <img src={MotivaLogo} alt="Motiva" className="mx-auto mt-8 h-auto w-90" />
    </form>
  );
}
