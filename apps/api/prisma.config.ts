import { defineConfig } from "prisma/config";

// O CLI do Prisma roda sob Node, não sob o Bun — então o .env não é carregado
// sozinho aqui, mesmo invocando via `bunx`. Daí o dotenv.
//
// Em produção (ex.: Railway) as variáveis já vêm do ambiente e o dotenv pode
// nem estar instalado, se só as dependências de produção forem baixadas — por
// isso a importação é opcional em vez de obrigatória.
try {
    await import("dotenv/config");
} catch {
    // Sem dotenv: assume-se que o ambiente já traz as variáveis.
}

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: process.env["DATABASE_URL"],
    },
});
