import type { LoginDTO, LoginResultDTO } from "../../dtos/auth.dto";
import { UnauthorizedError } from "../../errors/ApplicationError";

export interface TokenSigner {
    sign(username: string): Promise<{ token: string; expiresAt: number }>;
}

export interface AdminCredentials {
    username: string;
    password: string;
}

/**
 * Não existe tabela de usuários: há um único administrador, vindo do .env.
 * O use case recebe as credenciais esperadas prontas para não depender de
 * process.env — assim continua testável e agnóstico de infraestrutura.
 */
export class LoginUseCase {
    constructor(
        private readonly admin: AdminCredentials,
        private readonly tokens: TokenSigner,
    ) {}

    async execute(data: LoginDTO): Promise<LoginResultDTO> {
        const userMatches = safeEquals(data.username, this.admin.username);
        const passwordMatches = safeEquals(data.password, this.admin.password);

        // Compara os dois SEMPRE (sem short-circuit) para não vazar, pelo
        // tempo de resposta, se foi o usuário ou a senha que errou.
        if (!userMatches || !passwordMatches) {
            throw new UnauthorizedError("Usuário ou senha inválidos");
        }

        const { token, expiresAt } = await this.tokens.sign(this.admin.username);
        return { token, expiresAt, username: this.admin.username };
    }
}

// Comparação em tempo constante para o comprimento dado. Não é crítico neste
// contexto (um único admin), mas é barato o bastante para não abrir mão.
function safeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}
