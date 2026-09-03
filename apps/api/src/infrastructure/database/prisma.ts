import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../../../generated/prisma/client";

// Prisma 7 exige um driver adapter explícito. Usamos o libSQL (e não o
// better-sqlite3, que é o default da documentação) porque este projeto roda
// sob Bun, e o binding nativo do better-sqlite3 não carrega lá
// (ERR_DLOPEN_FAILED — ver oven-sh/bun#4290). O libSQL fala o mesmo SQLite,
// com o mesmo arquivo .db.
//
// O caminho vem do DATABASE_URL e resolve a partir do diretório de execução
// (apps/api) — tanto aqui quanto no CLI do Prisma, que é o que garante que
// migration e runtime falem com o mesmo arquivo.
const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
});

export const prisma = new PrismaClient({ adapter });
