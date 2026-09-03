import type { Context } from "hono";
import type { RegisterProxyUseCase } from "../../application/use-cases/proxy/RegisterProxyUseCase";
import type { GetProxyUseCase } from "../../application/use-cases/proxy/GetProxyUseCase";
import type { DeleteProxyUseCase } from "../../application/use-cases/proxy/DeleteProxyUseCase";
import type { ResetProxyUseCase } from "../../application/use-cases/proxy/ResetProxyUseCase";
import { createProxySchema } from "../../application/dtos/sensor.dto";
import { param, validateBody } from "../middlewares/validate";
import { ok } from "../response";

export class ProxyController {
    constructor(
        private readonly registerProxy: RegisterProxyUseCase,
        private readonly getProxy: GetProxyUseCase,
        private readonly deleteProxy: DeleteProxyUseCase,
        private readonly resetProxy: ResetProxyUseCase,
    ) {}

    create = async (c: Context) => {
        const body = await validateBody(c, createProxySchema);
        await this.registerProxy.execute(param(c, "id"), body);
        return ok(c, undefined, "Proxy criado com sucesso", 201);
    };

    get = async (c: Context) => ok(c, await this.getProxy.execute(param(c, "id")));

    delete = async (c: Context) => {
        await this.deleteProxy.execute(param(c, "id"));
        return ok(c);
    };

    reset = async (c: Context) => {
        await this.resetProxy.execute(param(c, "id"));
        return ok(c);
    };
}
