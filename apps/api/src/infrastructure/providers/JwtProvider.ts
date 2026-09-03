import { sign, verify } from "hono/jwt";
import type { TokenSigner } from "../../application/use-cases/auth/LoginUseCase";

export interface JwtPayload {
    sub: string;
    iat: number;
    exp: number;
}

const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60 * 24; // 24h

// Fixo e explícito nos dois lados: verificar sem fixar o algoritmo abriria
// espaço para um token forjado escolher o seu próprio (ex.: "none").
const ALGORITHM = "HS256";

// Usa o `hono/jwt` (HS256), que já vem na dependência do framework — não vale
// puxar mais uma lib de cripto só para assinar um token de admin.
export class JwtProvider implements TokenSigner {
    private readonly secret: string;
    private readonly expiresInSeconds: number;

    constructor(secret: string, expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS) {
        this.secret = secret;
        this.expiresInSeconds = expiresInSeconds;
    }

    async sign(username: string): Promise<{ token: string; expiresAt: number }> {
        const issuedAt = Math.floor(Date.now() / 1000);
        const expiresAt = issuedAt + this.expiresInSeconds;

        const token = await sign(
            { sub: username, iat: issuedAt, exp: expiresAt },
            this.secret,
            ALGORITHM,
        );
        return { token, expiresAt };
    }

    /** Lança se assinatura, formato ou expiração forem inválidos. */
    async verify(token: string): Promise<JwtPayload> {
        return (await verify(token, this.secret, ALGORITHM)) as unknown as JwtPayload;
    }
}
