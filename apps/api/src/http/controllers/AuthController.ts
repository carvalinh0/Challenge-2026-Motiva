import type { Context } from "hono";
import type { LoginUseCase } from "../../application/use-cases/auth/LoginUseCase";
import { loginSchema } from "../../application/dtos/auth.dto";
import { validateBody } from "../middlewares/validate";
import { ok } from "../response";

export class AuthController {
    constructor(private readonly login: LoginUseCase) {}

    authenticate = async (c: Context) => {
        const body = await validateBody(c, loginSchema);
        return ok(c, await this.login.execute(body));
    };

    /** Confirma para o front que o token ainda vale (e de quem ele é). */
    me = async (c: Context) => ok(c, { username: c.get("username") });
}
