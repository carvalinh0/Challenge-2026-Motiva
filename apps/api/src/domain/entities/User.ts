// Não há tabela de usuários: existe um único administrador, vindo do .env
// (ADMIN_USER/ADMIN_PASSWORD). Esta entidade é o que vira `sub` do JWT.
export interface User {
    username: string;
}

export interface AuthenticatedUser extends User {
    /** Emissão/expiração em segundos desde a epoch (padrão JWT). */
    issuedAt: number;
    expiresAt: number;
}
