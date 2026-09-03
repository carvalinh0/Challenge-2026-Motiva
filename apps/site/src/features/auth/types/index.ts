export interface Credentials {
  username: string;
  password: string;
}

/** Resposta de `POST /api/auth/login`. */
export interface LoginResult {
  token: string;
  /** Epoch em segundos, igual ao `exp` do JWT. */
  expiresAt: number;
  username: string;
}

export interface AuthenticatedUser {
  username: string;
}

export interface AuthState {
  username: string | null;
  isAuthenticated: boolean;
  /** True enquanto a sessão salva está sendo revalidada na API. */
  loading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}
