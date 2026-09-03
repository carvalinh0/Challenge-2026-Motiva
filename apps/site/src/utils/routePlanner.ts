// Montagem do roteiro de roçada do dia.
//
// O problema não é caixeiro-viajante: é escolher QUEM entra e só depois em que
// ordem. Na literatura isso é um problema de orientação (orienteering / TSP com
// prêmio e orçamento de tempo): maximizar prioridade coletada respeitando
// `deslocamento + roçada <= jornada`, saindo e voltando da base.
//
// Tudo aqui é puro e determinístico — mesma entrada, mesma rota. Importa para
// uma equipe que vai imprimir o roteiro e segui-lo em campo.

/** Índice da base na matriz de tempos. Os candidatos vêm depois dela. */
const BASE = 0;

/**
 * Até quantas paradas vale rodar a ordenação exata (Held-Karp). O custo é
 * 2^n · n²: em 12 paradas são ~600 mil operações, instantâneo. Acima disso a
 * heurística assume.
 */
const EXACT_ORDER_MAX_STOPS = 12;

export interface RouteCandidate {
  id: string;
  /** Prioridade de roçada. Quanto maior, mais urgente. */
  score: number;
}

export interface RoutePlanInput {
  /**
   * durations[i][j] = segundos de i para j. O índice 0 é a base; o candidato
   * `candidates[k]` está em `k + 1`.
   */
  durations: number[][];
  candidates: RouteCandidate[];
  /** Quantas paradas a equipe quer fazer. É alvo, não teto. */
  targetStops: number;
  /** Jornada disponível, em segundos. */
  workdaySeconds: number;
  /** Tempo de roçada em cada parada, em segundos. */
  serviceSeconds: number;
}

export interface RouteStop extends RouteCandidate {
  /** Segundos desde a saída da base. */
  arrivalSeconds: number;
  departureSeconds: number;
}

export interface RoutePlan {
  stops: RouteStop[];
  travelSeconds: number;
  serviceSeconds: number;
  totalSeconds: number;
  /** Quanto a jornada estourou. 0 significa que coube. */
  overtimeSeconds: number;
  /** Candidatos que não entraram, do mais urgente para o menos. */
  leftOut: RouteCandidate[];
}

function at(candidateIndex: number): number {
  return candidateIndex + 1;
}

/** Acesso à matriz. Existe só para não espalhar `!` por toda a aritmética. */
function leg(durations: number[][], from: number, to: number): number {
  return durations[from]?.[to] ?? 0;
}

/** Tempo de base -> paradas -> base, para uma ordem já definida. */
function travelTimeOf(durations: number[][], order: number[]): number {
  if (order.length === 0) return 0;

  let total = leg(durations, BASE, at(order[0] as number));
  for (let i = 1; i < order.length; i++) {
    total += leg(durations, at(order[i - 1] as number), at(order[i] as number));
  }
  return total + leg(durations, at(order[order.length - 1] as number), BASE);
}

/** Quanto a rota cresce ao encaixar `candidate` na posição `position`. */
function insertionCost(
  durations: number[][],
  order: number[],
  candidate: number,
  position: number,
): number {
  const before = position === 0 ? BASE : at(order[position - 1] as number);
  const after = position === order.length ? BASE : at(order[position] as number);

  return (
    leg(durations, before, at(candidate)) +
    leg(durations, at(candidate), after) -
    leg(durations, before, after)
  );
}

/**
 * Escolhe as paradas por densidade de valor: a cada rodada entra o candidato
 * com a melhor razão `prioridade / minutos extras`, na melhor posição.
 *
 * Ordenar por prioridade pura escolheria pontos espalhados que consomem a
 * jornada em estrada; ordenar por proximidade pura ignoraria a urgência. A
 * densidade é o que equilibra os dois.
 */
function selectWithinBudget(input: RoutePlanInput, target: number): number[] {
  const { durations, candidates, workdaySeconds, serviceSeconds } = input;

  const order: number[] = [];
  const remaining = new Set(candidates.map((_, index) => index));

  while (order.length < target && remaining.size > 0) {
    let best: { candidate: number; position: number; density: number } | null = null;

    for (const candidate of remaining) {
      for (let position = 0; position <= order.length; position++) {
        const extra = insertionCost(durations, order, candidate, position);
        const total =
          travelTimeOf(durations, order) +
          extra +
          serviceSeconds * (order.length + 1);
        if (total > workdaySeconds) continue;

        // O piso de 1s evita divisão por zero em duas paradas no mesmo ponto.
        const density =
          (candidates[candidate] as RouteCandidate).score /
          Math.max(extra + serviceSeconds, 1);

        if (!best || density > best.density) {
          best = { candidate, position, density };
        }
      }
    }

    if (!best) break; // nada mais cabe na jornada
    order.splice(best.position, 0, best.candidate);
    remaining.delete(best.candidate);
  }

  return order;
}

/**
 * Completa até o alvo de paradas mesmo que a jornada estoure — a equipe pediu
 * um número exato de pontos e decide sozinha sobre hora extra. O quanto passou
 * volta em `overtimeSeconds`.
 */
function fillToTarget(input: RoutePlanInput, order: number[], target: number): number[] {
  const { durations, candidates } = input;
  const chosen = new Set(order);

  const byScore = candidates
    .map((candidate, index) => ({ index, score: candidate.score }))
    .filter((item) => !chosen.has(item.index))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const filled = [...order];

  for (const item of byScore) {
    if (filled.length >= target) break;

    let bestPosition = filled.length;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let position = 0; position <= filled.length; position++) {
      const cost = insertionCost(durations, filled, item.index, position);
      if (cost < bestCost) {
        bestCost = cost;
        bestPosition = position;
      }
    }

    filled.splice(bestPosition, 0, item.index);
  }

  return filled;
}

/** Ordem exata que minimiza o tempo total, para conjuntos pequenos. */
function heldKarp(durations: number[][], stops: number[]): number[] {
  const n = stops.length;
  const size = 1 << n;

  const cost: number[][] = Array.from({ length: size }, () =>
    new Array<number>(n).fill(Number.POSITIVE_INFINITY),
  );
  const previous: number[][] = Array.from({ length: size }, () =>
    new Array<number>(n).fill(-1),
  );

  for (let i = 0; i < n; i++) {
    (cost[1 << i] as number[])[i] = leg(durations, BASE, at(stops[i] as number));
  }

  for (let mask = 1; mask < size; mask++) {
    for (let last = 0; last < n; last++) {
      if ((mask & (1 << last)) === 0) continue;
      const reached = (cost[mask] as number[])[last] as number;
      if (!Number.isFinite(reached)) continue;

      for (let next = 0; next < n; next++) {
        if ((mask & (1 << next)) !== 0) continue;
        const nextMask = mask | (1 << next);
        const value =
          reached + leg(durations, at(stops[last] as number), at(stops[next] as number));

        if (value < ((cost[nextMask] as number[])[next] as number)) {
          (cost[nextMask] as number[])[next] = value;
          (previous[nextMask] as number[])[next] = last;
        }
      }
    }
  }

  const full = size - 1;
  let bestLast = 0;
  let bestTotal = Number.POSITIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    const total =
      ((cost[full] as number[])[i] as number) +
      leg(durations, at(stops[i] as number), BASE);
    if (total < bestTotal) {
      bestTotal = total;
      bestLast = i;
    }
  }

  const result: number[] = [];
  let mask = full;
  let last = bestLast;
  while (last !== -1) {
    result.unshift(stops[last] as number);
    const step = (previous[mask] as number[])[last] as number;
    mask ^= 1 << last;
    last = step;
  }

  return result;
}

/** Desembaraça cruzamentos invertendo trechos enquanto houver ganho. */
function twoOpt(durations: number[][], order: number[]): number[] {
  const route = [...order];
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const candidate = [
          ...route.slice(0, i),
          ...route.slice(i, j + 1).reverse(),
          ...route.slice(j + 1),
        ];
        if (travelTimeOf(durations, candidate) < travelTimeOf(durations, route) - 1) {
          route.splice(0, route.length, ...candidate);
          improved = true;
        }
      }
    }
  }

  return route;
}

function bestOrder(durations: number[][], stops: number[]): number[] {
  if (stops.length <= 2) return stops;
  if (stops.length <= EXACT_ORDER_MAX_STOPS) return heldKarp(durations, stops);
  return twoOpt(durations, stops);
}

export function planMowingRoute(input: RoutePlanInput): RoutePlan {
  const { durations, candidates, workdaySeconds, serviceSeconds } = input;

  const target = Math.max(0, Math.min(input.targetStops, candidates.length));

  const withinBudget = selectWithinBudget(input, target);
  const selected = bestOrder(
    durations,
    fillToTarget(input, withinBudget, target),
  );

  const stops: RouteStop[] = [];
  let clock = 0;

  selected.forEach((candidateIndex, position) => {
    const from = position === 0 ? BASE : at(selected[position - 1] as number);
    clock += leg(durations, from, at(candidateIndex));

    const candidate = candidates[candidateIndex] as RouteCandidate;
    stops.push({
      ...candidate,
      arrivalSeconds: clock,
      departureSeconds: clock + serviceSeconds,
    });
    clock += serviceSeconds;
  });

  const travelSeconds = travelTimeOf(durations, selected);
  const totalService = serviceSeconds * selected.length;
  const totalSeconds = travelSeconds + totalService;

  const chosen = new Set(selected);

  return {
    stops,
    travelSeconds,
    serviceSeconds: totalService,
    totalSeconds,
    overtimeSeconds: Math.max(0, totalSeconds - workdaySeconds),
    leftOut: candidates
      .filter((_, index) => !chosen.has(index))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)),
  };
}
