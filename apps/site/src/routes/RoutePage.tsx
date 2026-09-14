import { useEffect, useMemo, useState } from "react";
import { Clock, ExternalLink, MapPinned, Route } from "lucide-react";
import { Alert } from "@/components/Alert";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { useDashboard } from "@/features/dashboard";
import { sensorsApi } from "@/features/sensors";
import {
  RouteItinerary,
  RouteMap,
  RouteSettingsForm,
  routeApi,
  useRoutePlan,
} from "@/features/route";
import type { DefinedRoute } from "@/features/route";
import { formatDuration } from "@/utils/format";
import { getNivel, nivelFromValue } from "@/utils/sensorStatus";

const EMPTY_ROUTE_SENSOR_IDS: readonly number[] = [];

export function RoutePage() {
  const [definedRoute, setDefinedRoute] = useState<DefinedRoute | null>(null);
  const [manualOrder, setManualOrder] = useState<number[] | null>(null);
  const [leftOutPage, setLeftOutPage] = useState(0);
  const [routeActionError, setRouteActionError] = useState<string | null>(null);

  const {
    sensors,
    loading: loadingSensors,
    error: sensorsError,
    reload: reloadSensors,
  } = useDashboard();
  const {
    settings,
    update,
    candidates,
    plan,
    geometry,
    matrixSource,
    loading,
    error,
  } = useRoutePlan(
    sensors,
    definedRoute?.sensorIds ?? EMPTY_ROUTE_SENSOR_IDS,
    definedRoute?.sensorIds ?? manualOrder ?? undefined,
  );

  useEffect(() => {
    void routeApi
      .active()
      .then((route) => {
        setDefinedRoute(route);
        setManualOrder(route?.sensorIds ?? null);
        if (route) update({ base: route.base });
      })
      .catch(() => setDefinedRoute(null));
  }, [update]);

  async function deferSensor(sensorId: number) {
    await sensorsApi.defer(sensorId);
    await reloadSensors();
    setManualOrder(
      (current) => current?.filter((id) => id !== sensorId) ?? null,
    );
  }

  function includeSensor(sensorId: number) {
    setManualOrder((current) => [
      ...(current ?? plan?.stops.map((stop) => stop.id) ?? []),
      sensorId,
    ]);
    setLeftOutPage(0);
  }

  function moveStop(from: number, to: number) {
    if (!plan || to < 0 || to >= plan.stops.length) return;
    const order = plan.stops.map((stop) => stop.id);
    const [moved] = order.splice(from, 1);
    if (moved !== undefined) order.splice(to, 0, moved);
    setManualOrder(order);
  }

  function activateAutomaticCalculation() {
    setManualOrder(null);
  }

  async function defineRoute() {
    if (!plan) return;
    setRouteActionError(null);
    try {
      if (!settings.base) return;
      const route = await routeApi.define(
        plan.stops.map((stop) => stop.id),
        settings.base,
      );
      if (route) setDefinedRoute(route);
    } catch (err) {
      setRouteActionError(
        err instanceof Error ? err.message : "Não foi possível definir a rota.",
      );
    }
  }

  async function completeRoute() {
    if (!definedRoute) return;
    setRouteActionError(null);
    try {
      await routeApi.complete(definedRoute.id);
      setDefinedRoute(null);
      setManualOrder(null);
      await reloadSensors();
    } catch (err) {
      setRouteActionError(
        err instanceof Error
          ? err.message
          : "Não foi possível concluir a rota.",
      );
    }
  }

  function mapsUrl() {
    if (!definedRoute || !settings.base) return "#";
    const points = definedRoute.sensorIds
      .map((id) => candidates.find((candidate) => candidate.id === id)?.point)
      .filter((point): point is { latitude: number; longitude: number } =>
        Boolean(point),
      );
    const destination = points.at(-1) ?? settings.base;
    const waypoints = points
      .slice(0, -1)
      .map((point) => `${point.latitude},${point.longitude}`)
      .join("|");
    const params = new URLSearchParams({
      api: "1",
      origin: `${settings.base.latitude},${settings.base.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      travelmode: "driving",
    });
    if (waypoints) params.set("waypoints", waypoints);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  const pointById = useMemo(
    () =>
      new Map(candidates.map((candidate) => [candidate.id, candidate.point])),
    [candidates],
  );
  const nameById = useMemo(
    () =>
      new Map(candidates.map((candidate) => [candidate.id, candidate.name])),
    [candidates],
  );
  const sensorById = useMemo(
    () => new Map(sensors.map((sensor) => [sensor.id, sensor])),
    [sensors],
  );

  function mapDetails(id: number) {
    const sensor = sensorById.get(id);
    const candidate = candidates.find((item) => item.id === id);
    return {
      status: sensor ? (sensor.active ? "Ativo" : "Offline") : undefined,
      reading: sensor
        ? sensor.type === "proxy"
          ? nivelFromValue(sensor.lastMeasurement?.value)
          : (getNivel(sensor) ?? nivelFromValue(null))
        : undefined,
      daysDetecting: candidate?.daysDetecting,
      estimatedHeight: candidate?.estimatedHeight,
    };
  }

  const mapStops = useMemo(
    () =>
      (plan?.stops ?? []).flatMap((stop) => {
        const point = pointById.get(stop.id);
        return point
          ? [
              {
                id: stop.id,
                name: nameById.get(stop.id),
                point,
                ...mapDetails(stop.id),
              },
            ]
          : [];
      }),
    [plan, pointById, nameById, sensorById, candidates],
  );

  // Sem plano ainda (base não definida), todos os candidatos entram como "fora
  // do roteiro". É o que faz o mapa já abrir enquadrado no trecho da rodovia,
  // em vez de num centro arbitrário, antes de a equipe marcar a base.
  const mapLeftOut = useMemo(
    () =>
      candidates
        .filter(
          (candidate) => !plan?.stops.some((stop) => stop.id === candidate.id),
        )
        .flatMap((item) => {
          const point = pointById.get(item.id);
          return point
            ? [
                {
                  id: item.id,
                  name: nameById.get(item.id),
                  point,
                  ...mapDetails(item.id),
                },
              ]
            : [];
        }),
    [plan, candidates, pointById, nameById, sensorById],
  );

  return (
    <main className="flex-1 overflow-x-hidden">
      <PageHeader title="Roteiro do dia" />

      {sensorsError && (
        <Alert tone="error">
          Não foi possível carregar os sensores: {sensorsError}
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {routeActionError && <Alert tone="error">{routeActionError}</Alert>}

      {matrixSource === "haversine" && (
        <Alert tone="info">
          O serviço de rotas não respondeu. Os tempos abaixo são uma estimativa
          em linha reta a 60 km/h — use como ordem de grandeza, não como
          previsão.
        </Alert>
      )}

      {plan && plan.overtimeSeconds > 0 && (
        <Alert tone="error">
          Este roteiro passa {formatDuration(plan.overtimeSeconds)} da jornada
          de {settings.workdayHours}h. Reduza o número de paradas ou aumente a
          jornada.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 p-4 lg:grid-cols-3">
        <Card
          title="Paradas"
          info={plan ? plan.stops.length : "0"}
          hint={`de ${candidates.length} trecho(s) pedindo roçada`}
          icon={MapPinned}
          titleClassName="text-black dark:text-white"
          infoClassName="text-black dark:text-white"
        />
        <Card
          title="Deslocamento total"
          info={plan ? formatDuration(plan.travelSeconds) : "0km"}
          hint="Tempo total de todo o percurso"
          icon={Route}
          titleClassName="text-[#5e22f3] dark:text-[#8f61ff]"
          infoClassName="text-[#5e22f3] dark:text-[#8f61ff]"
        />
        <Card
          title="Tempo de roçada"
          info={plan ? formatDuration(plan.serviceSeconds) : "0min"}
          hint={`${settings.serviceMinutes} min por ponto`}
          icon={Clock}
          titleClassName="text-green-700 dark:text-green-500"
          infoClassName="text-green-700 dark:text-green-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 pt-0 lg:grid-cols-2">
        <Panel
          title="Percurso"
          description="Clique em qualquer ponto do mapa para definir a base da equipe."
        >
          <RouteMap
            base={settings.base}
            geometry={geometry}
            stops={mapStops}
            leftOut={mapLeftOut}
            onPickBase={
              definedRoute
                ? undefined
                : (latitude, longitude) =>
                    update({ base: { latitude, longitude } })
            }
          />
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Parâmetros">
            <RouteSettingsForm
              settings={settings}
              onChange={update}
              locked={Boolean(definedRoute)}
            />
          </Panel>

          <Panel
            title="Ordem de visita"
            description={
              definedRoute
                ? "Rota definida e reservada para esta equipe."
                : manualOrder
                  ? "Ordem ajustada manualmente."
                  : "Escolhida automaticamente por proximidade, prioridade e tempo de deslocamento."
            }
            actions={
              loading || loadingSensors ? (
                <span className="text-xs text-gray-500 dark:text-gray-300">
                  calculando…
                </span>
              ) : definedRoute ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <a
                    href={mapsUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="flex cursor-pointer items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-600"
                  >
                    <ExternalLink size={15} />
                    Abrir no Maps
                  </a>
                  <button
                    type="button"
                    onClick={completeRoute}
                    className="cursor-pointer rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Marcar como concluída
                  </button>
                </div>
              ) : plan ? (
                <div className="flex flex-wrap justify-end gap-2">
                  {manualOrder && (
                    <button
                      type="button"
                      onClick={activateAutomaticCalculation}
                      className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-600"
                    >
                      Ativar cálculo automático
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={defineRoute}
                    className="cursor-pointer rounded-lg bg-[#6126F1] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#4107d4]"
                  >
                    Definir rota
                  </button>
                </div>
              ) : undefined
            }
          >
            {!settings.base ? (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-300">
                Defina a base no mapa para montar o roteiro.
              </p>
            ) : candidates.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-300">
                Nenhum trecho com vegetação detectada e coordenada cadastrada.
              </p>
            ) : plan ? (
              <RouteItinerary
                plan={plan}
                candidates={candidates}
                departure={settings.departure}
                onDefer={deferSensor}
                allowDefer={!definedRoute}
                onMove={!definedRoute ? moveStop : undefined}
              />
            ) : (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-300">
                Calculando os tempos de deslocamento…
              </p>
            )}
          </Panel>
        </div>
      </div>

      {plan && plan.leftOut.length > 0 && (
        <div className="p-4 pt-0">
          <Panel
            title="Ficaram para outro dia"
            description="Trechos pedindo roçada que não entraram neste roteiro, do mais urgente ao menos."
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {plan.leftOut
                .slice(leftOutPage * 20, leftOutPage * 20 + 20)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-gray-100 p-3 dark:bg-gray-600"
                  >
                    <span className="truncate font-medium text-gray-800 dark:text-white">
                      {nameById.get(item.id) || item.id}
                    </span>
                    <span className="text-xs whitespace-nowrap text-gray-500 dark:text-gray-300">
                      {item.score - 1} dia(s)
                    </span>
                    {!definedRoute && (
                      <button
                        type="button"
                        onClick={() => includeSensor(item.id)}
                        className="cursor-pointer rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-white dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        Incluir
                      </button>
                    )}
                  </div>
                ))}
            </div>
            {plan.leftOut.length > 20 && (
              <div className="mt-4 flex items-center justify-end gap-2 text-sm">
                <button
                  type="button"
                  onClick={() =>
                    setLeftOutPage((page) => Math.max(0, page - 1))
                  }
                  disabled={leftOutPage === 0}
                  className="rounded border px-2 py-1 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-gray-500">
                  Página {leftOutPage + 1} de{" "}
                  {Math.ceil(plan.leftOut.length / 20)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setLeftOutPage((page) =>
                      Math.min(
                        Math.ceil(plan.leftOut.length / 20) - 1,
                        page + 1,
                      ),
                    )
                  }
                  disabled={
                    leftOutPage === Math.ceil(plan.leftOut.length / 20) - 1
                  }
                  className="rounded border px-2 py-1 disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            )}
          </Panel>
        </div>
      )}
    </main>
  );
}
