// Recria o banco local com uma rede sintética para desenvolvimento.
// Os pontos são aproximados e ficam ao longo de corredores operados pela CCR
// Motiva: Dutra, Fernão Dias, Régis Bittencourt, Castello Branco e Raposo Tavares.

import { prisma } from "../src/infrastructure/database/prisma";

const SENSOR_COUNT = 200;
const PROXY_IDS = [9000, 9001, 9002];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type Coordinate = { latitude: number; longitude: number };
type Corridor = { name: string; points: Coordinate[] };

const corridors: Corridor[] = [
  {
    name: "Dutra BR-116",
    points: [
      { latitude: -23.5505, longitude: -46.6333 },
      { latitude: -23.3137, longitude: -45.9658 },
      { latitude: -22.9239, longitude: -45.4617 },
      { latitude: -22.4335, longitude: -45.4491 },
      { latitude: -22.2456, longitude: -45.0005 },
      { latitude: -21.7856, longitude: -45.9656 },
      { latitude: -21.1358, longitude: -44.2613 },
      { latitude: -20.8197, longitude: -41.1332 },
      { latitude: -22.9068, longitude: -43.1729 },
    ],
  },
  {
    name: "Fernão Dias BR-381",
    points: [
      { latitude: -23.5505, longitude: -46.6333 },
      { latitude: -23.2226, longitude: -46.8742 },
      { latitude: -22.9292, longitude: -46.5425 },
      { latitude: -22.5228, longitude: -46.1883 },
      { latitude: -22.2567, longitude: -45.9369 },
      { latitude: -21.6786, longitude: -45.2539 },
      { latitude: -20.7022, longitude: -44.8271 },
      { latitude: -19.9167, longitude: -43.9345 },
    ],
  },
  {
    name: "Régis Bittencourt BR-116",
    points: [
      { latitude: -23.5505, longitude: -46.6333 },
      { latitude: -23.7167, longitude: -46.8499 },
      { latitude: -23.7997, longitude: -47.0081 },
      { latitude: -24.0058, longitude: -47.5081 },
      { latitude: -24.4949, longitude: -47.8442 },
      { latitude: -24.7911, longitude: -49.9458 },
      { latitude: -25.4284, longitude: -49.2733 },
    ],
  },
  {
    name: "Castello Branco SP-280",
    points: [
      { latitude: -23.5505, longitude: -46.6333 },
      { latitude: -23.5235, longitude: -46.8355 },
      { latitude: -23.5042, longitude: -47.1353 },
      { latitude: -23.5088, longitude: -47.6138 },
      { latitude: -23.5015, longitude: -47.4581 },
      { latitude: -23.215, longitude: -47.523 },
    ],
  },
  {
    name: "Raposo Tavares SP-270",
    points: [
      { latitude: -23.5505, longitude: -46.6333 },
      { latitude: -23.5947, longitude: -46.835 },
      { latitude: -23.6218, longitude: -47.2289 },
      { latitude: -23.5486, longitude: -47.4477 },
      { latitude: -23.5292, longitude: -47.9167 },
      { latitude: -23.5037, longitude: -48.3205 },
    ],
  },
];

function pointOnCorridor(corridor: Corridor, position: number): Coordinate {
  const segment = Math.min(
    Math.floor(position * (corridor.points.length - 1)),
    corridor.points.length - 2,
  );
  const local = position * (corridor.points.length - 1) - segment;
  const start = corridor.points[segment]!;
  const end = corridor.points[segment + 1]!;
  return {
    latitude: start.latitude + (end.latitude - start.latitude) * local,
    longitude: start.longitude + (end.longitude - start.longitude) * local,
  };
}

function measurementValue(index: number, reading: number): number {
  if (reading % 17 === 0) return 2;
  if ((index + Math.floor(reading / 4)) % 5 < 2) return 1;
  return 0;
}

async function main() {
  const now = Date.now();
  await prisma.measurement.deleteMany();
  await prisma.sensor.deleteMany();

  await prisma.sensor.createMany({
    data: PROXY_IDS.map((id, index) => ({
      id,
      name: `Proxy Motiva ${index + 1}`,
      latitude: -23.55 + index * 0.18,
      longitude: -46.63 - index * 0.15,
      type: "proxy",
      createdAt: new Date(now - (index + 10) * MS_PER_DAY),
      lastSeen: new Date(now - index * 10 * 60 * 1000),
    })),
  });

  const sensorRows = Array.from({ length: SENSOR_COUNT }, (_, index) => {
    const corridor = corridors[index % corridors.length]!;
    const point = pointOnCorridor(corridor, ((index * 37) % 997) / 996);
    const proxyId = PROXY_IDS[index % PROXY_IDS.length]!;
    return {
      id: index + 1,
      name: `Sensor ${String(index + 1).padStart(3, "0")} · ${corridor.name}`,
      latitude: point.latitude,
      longitude: point.longitude,
      type: "sensor",
      proxyId,
      createdAt: new Date(now - (30 + (index % 150)) * MS_PER_DAY),
      lastSeen:
        index % 13 === 0
          ? new Date(now - 3 * MS_PER_DAY)
          : new Date(now - (index % 8) * 60 * 60 * 1000),
    };
  });

  await prisma.sensor.createMany({ data: sensorRows });

  const measurements = sensorRows.flatMap((sensor, sensorIndex) =>
    Array.from({ length: 28 }, (_, reading) => ({
      sensorId: sensor.id,
      value: measurementValue(sensorIndex, reading),
      timestamp: new Date(now - (27 - reading) * 12 * 60 * 60 * 1000),
    })),
  );
  await prisma.measurement.createMany({ data: measurements });

  console.log(
    `Banco mock criado: ${PROXY_IDS.length} proxies, ${sensorRows.length} sensores.`,
  );
  console.log(`${measurements.length} medições sintéticas gravadas.`);
}

await main();
await prisma.$disconnect();
