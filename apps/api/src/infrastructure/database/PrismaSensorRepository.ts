import type { Sensor, SensorType } from "../../domain/entities/Sensor";
import type {
    CreateSensorData,
    SensorRepository,
    UpdateSensorData,
} from "../../domain/repositories/SensorRepository";
import { ConflictError, UnprocessableError } from "../../application/errors/ApplicationError";
import { prisma } from "./prisma";

// Rede de segurança: traduz erro de integridade do banco em erro de aplicação.
//
// Os use cases já validam antes (proxy_id existe? node_id livre?), mas entre a
// checagem e a escrita há uma corrida — e qualquer caminho novo que esqueça a
// validação cairia aqui. Sem esta tradução, o erro vira 500 "Erro interno" com
// um stack do Prisma no log, sem dizer ao usuário o que ele fez de errado.
// Códigos: https://www.prisma.io/docs/orm/reference/error-reference
function translatePrismaError(err: unknown): never {
    const code = (err as { code?: string })?.code;

    if (code === "P2003") {
        throw new UnprocessableError(
            "Referência inválida: o proxy_id informado não existe. Cadastre o proxy antes.",
        );
    }
    if (code === "P2002") {
        throw new ConflictError(
            "Já existe um registro com esse valor único (id ou node_id).",
        );
    }
    throw err;
}

// Linha do banco -> entidade de domínio. `type` é TEXT no SQLite (não há enum),
// então a conversão acontece aqui, na borda.
type SensorRow = {
    id: string;
    name: string | null;
    latitude: number | null;
    longitude: number | null;
    type: string;
    nodeId: number | null;
    proxyId: string | null;
    lastSeen: Date | null;
};

function toDomain(row: SensorRow): Sensor {
    return {
        id: row.id,
        name: row.name,
        latitude: row.latitude,
        longitude: row.longitude,
        type: (row.type === "proxy" ? "proxy" : "sensor") satisfies SensorType,
        nodeId: row.nodeId,
        proxyId: row.proxyId,
        lastSeen: row.lastSeen,
    };
}

export class PrismaSensorRepository implements SensorRepository {
    async findById(id: string): Promise<Sensor | null> {
        const row = await prisma.sensor.findUnique({ where: { id } });
        return row ? toDomain(row) : null;
    }

    async findByNodeId(nodeId: number): Promise<Sensor | null> {
        const row = await prisma.sensor.findUnique({ where: { nodeId } });
        return row ? toDomain(row) : null;
    }

    async findAll(): Promise<Sensor[]> {
        const rows = await prisma.sensor.findMany({ orderBy: { id: "asc" } });
        return rows.map(toDomain);
    }

    async findByProxyId(proxyId: string): Promise<Sensor[]> {
        const rows = await prisma.sensor.findMany({
            where: { proxyId },
            orderBy: { id: "asc" },
        });
        return rows.map(toDomain);
    }

    async findAllWithNodeId(): Promise<Sensor[]> {
        const rows = await prisma.sensor.findMany({
            where: { nodeId: { not: null } },
            orderBy: { nodeId: "asc" },
        });
        return rows.map(toDomain);
    }

    async create(data: CreateSensorData): Promise<Sensor> {
        try {
            const row = await prisma.sensor.create({
                data: {
                    id: data.id,
                    name: data.name ?? null,
                    latitude: data.latitude ?? null,
                    longitude: data.longitude ?? null,
                    type: data.type ?? "sensor",
                    nodeId: data.nodeId ?? null,
                    proxyId: data.proxyId ?? null,
                },
            });
            return toDomain(row);
        } catch (err) {
            translatePrismaError(err);
        }
    }

    async update(id: string, data: UpdateSensorData): Promise<Sensor | null> {
        // Chaves com `undefined` são omitidas para o Prisma não interpretar
        // "campo ausente no PATCH" como "gravar null".
        const patch = Object.fromEntries(
            Object.entries(data).filter(([, value]) => value !== undefined),
        );

        try {
            const row = await prisma.sensor.update({ where: { id }, data: patch });
            return toDomain(row);
        } catch (err) {
            // Só P2025 ("registro não encontrado") vira null → 404. Engolir
            // todo erro aqui transformava dado inválido (ex.: proxy_id
            // inexistente) num 404 enganoso, escondendo a causa real.
            if ((err as { code?: string })?.code === "P2025") return null;
            translatePrismaError(err);
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            await prisma.sensor.delete({ where: { id } });
            return true;
        } catch {
            return false;
        }
    }

    async touchLastSeen(id: string): Promise<void> {
        await prisma.sensor.update({
            where: { id },
            data: { lastSeen: new Date() },
        });
    }
}
