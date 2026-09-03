// Use cases não conhecem HTTP. Eles sinalizam falha por tipo de erro, e a
// camada http traduz para status code (ver errorHandler). Assim a mesma regra
// serve para qualquer entrada — HTTP hoje, fila ou CLI amanhã.

export class ApplicationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

export class NotFoundError extends ApplicationError {}

export class ConflictError extends ApplicationError {}

/** Regra de negócio impede a operação, mesmo com entrada bem formada (→ 422). */
export class UnprocessableError extends ApplicationError {}

export class UnauthenticatedError extends ApplicationError {}

export class UnauthorizedError extends ApplicationError {}

/** A mesh não respondeu a tempo (→ 504). */
export class MeshTimeoutError extends ApplicationError {}

/** Dependência externa indisponível, ex.: MQTT desconectado (→ 503). */
export class ServiceUnavailableError extends ApplicationError {}
