// Public API da feature de autenticação: o resto do app importa daqui, nunca
// de caminhos internos. Isso mantém a liberdade de reorganizar api/, hooks/ e
// components/ sem quebrar quem usa.

export { AuthProvider } from "./components/AuthProvider";
export { ProtectedRoute } from "./components/ProtectedRoute";
export { LoginForm } from "./components/LoginForm";
export { useAuth } from "./hooks/useAuth";
export type { AuthState, AuthenticatedUser, Credentials, LoginResult } from "./types";
