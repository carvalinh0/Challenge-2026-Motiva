// Gera histórico de medições plausível para os sensores já cadastrados.
//
// Existe porque a fila de roçada e o roteiro do dia dependem de HISTÓRICO: a
// prioridade de um trecho é quantos dias seguidos ele vem reportando acima do
// limite (ver consecutiveHighDays). Com um banco que só tem leituras de hoje,
// toda prioridade dá zero e não há o que priorizar nem o que roteirizar.
//
//   bun run db:seed              -> 21 dias, mantém o que já existe
//   bun run db:seed -- --days=45 -> outro horizonte
//   bun run db:seed -- --reset   -> apaga as medições antes de gerar
//
// NÃO é para produção: escreve dados sintéticos direto na tabela.

import { prisma } from "../src/infrastructure/database/prisma";
import { MEASUREMENT_VALUE } from "../src/domain/entities/Measurement";

/** Mesmo ciclo do firmware (DEEP_SLEEP_INTERVAL_US em apps/sensor/config.h). */
const READING_INTERVAL_MINUTES = 30;

/** Fração das leituras que sai como "sem leitura confiável". */
const UNRELIABLE_RATE = 0.06;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function arg(name: string): string | undefined {
    return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

/**
 * Gerador determinístico: rodar o seed duas vezes com os mesmos parâmetros
 * produz o mesmo histórico. Sem isso, comparar um roteiro antes e depois de
 * uma mudança no algoritmo seria impossível.
 */
function makeRandom(seed: number): () => number {
    // mulberry32. Um congruente linear simples não serve aqui: com sementes
    // pequenas e consecutivas (1, 2, 3...) ele devolve praticamente o mesmo
    // primeiro valor, e todos os sensores sairiam com a mesma data de corte.
    let state = Math.imul(seed, 0x9e3779b1) >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

async function main() {
    const days = Number(arg("days") ?? 21);
    const reset = process.argv.includes("--reset");

    const sensors = await prisma.sensor.findMany({
        where: { type: "sensor" },
        orderBy: { id: "asc" },
    });

    if (sensors.length === 0) {
        console.log("Nenhum sensor cadastrado — cadastre os nós antes de gerar histórico.");
        return;
    }

    if (reset) {
        const { count } = await prisma.measurement.deleteMany({});
        console.log(`Apagadas ${count} medição(ões).`);
    }

    const now = Date.now();
    const rows: { sensorId: number; value: number; timestamp: Date }[] = [];

    sensors.forEach((sensor, index) => {
        const random = makeRandom(index + 1);

        // Cada sensor recebe um "último corte" diferente, espalhado pelo
        // horizonte. É isso que faz os trechos chegarem ao roteiro com
        // urgências distintas em vez de todos empatados.
        const daysSinceMowing = Math.floor(random() * days);
        const mowedAt = now - daysSinceMowing * MS_PER_DAY;

        for (let minutes = days * 24 * 60; minutes >= 0; minutes -= READING_INTERVAL_MINUTES) {
            const timestamp = now - minutes * 60 * 1000;

            const value =
                random() < UNRELIABLE_RATE
                    ? MEASUREMENT_VALUE.UNRELIABLE
                    : timestamp >= mowedAt
                      ? MEASUREMENT_VALUE.ABOVE_LIMIT
                      : MEASUREMENT_VALUE.BELOW_LIMIT;

            rows.push({ sensorId: sensor.id, value, timestamp: new Date(timestamp) });
        }

        console.log(
            `${sensor.id}: cortado há ${daysSinceMowing} dia(s) -> deve aparecer com ~${daysSinceMowing} dia(s) em alto.`,
        );
    });

    await prisma.measurement.createMany({ data: rows });
    console.log(`\n${rows.length} medição(ões) gravadas para ${sensors.length} sensor(es).`);
}

await main();
await prisma.$disconnect();
