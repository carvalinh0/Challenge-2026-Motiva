import { useMemo } from "react";
import { Clock, MapPinned, Route, TriangleAlert } from "lucide-react";
import { Alert } from "@/components/Alert";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { useDashboard } from "@/features/dashboard";
import { RouteItinerary, RouteMap, RouteSettingsForm, useRoutePlan } from "@/features/route";
import { addMinutesToClock, formatDuration } from "@/utils/format";

export function RoutePage() {
  const { sensors, loading: loadingSensors, error: sensorsError } = useDashboard();
  const { settings, update, candidates, plan, matrixSource, loading, error } =
    useRoutePlan(sensors);

  const pointById = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.id, candidate.point])),
    [candidates],
  );

  const mapStops = useMemo(
    () =>
      (plan?.stops ?? []).flatMap((stop) => {
        const point = pointById.get(stop.id);
        return point ? [{ id: stop.id, point }] : [];
      }),
    [plan, pointById],
  );

  // Sem plano ainda (base não definida), todos os candidatos entram como "fora
  // do roteiro". É o que faz o mapa já abrir enquadrado no trecho da rodovia,
  // em vez de num centro arbitrário, antes de a equipe marcar a base.
  const mapLeftOut = useMemo(
    () =>
      (plan?.leftOut ?? candidates).flatMap((item) => {
        const point = pointById.get(item.id);
        return point ? [{ id: item.id, point }] : [];
      }),
    [plan, candidates, pointById],
  );

  const slackSeconds = plan
    ? settings.workdayHours * 3600 - plan.totalSeconds
    : 0;

  return (
    <main className="flex-1 overflow-x-hidden">
      <PageHeader title="Roteiro do dia" />

      {sensorsError && (
        <Alert tone="error">Não foi possível carregar os sensores: {sensorsError}</Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      {matrixSource === "haversine" && (
        <Alert tone="info">
          O serviço de rotas não respondeu. Os tempos abaixo são uma estimativa em linha
          reta a 60 km/h — use como ordem de grandeza, não como previsão.
        </Alert>
      )}

      {plan && plan.overtimeSeconds > 0 && (
        <Alert tone="error">
          Este roteiro passa {formatDuration(plan.overtimeSeconds)} da jornada de{" "}
          {settings.workdayHours}h. Reduza o número de paradas ou aumente a jornada.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 p-4 lg:grid-cols-4">
        <Card
          title="Paradas"
          info={plan ? plan.stops.length : "—"}
          hint={`de ${candidates.length} trecho(s) pedindo roçada`}
          icon={MapPinned}
          titleClassName="text-black dark:text-white"
          infoClassName="text-black dark:text-white"
        />
        <Card
          title="Deslocamento"
          info={plan ? formatDuration(plan.travelSeconds) : "—"}
          hint="ida, entre pontos e volta"
          icon={Route}
          titleClassName="text-[#5e22f3] dark:text-[#8f61ff]"
          infoClassName="text-[#5e22f3] dark:text-[#8f61ff]"
        />
        <Card
          title="Roçada"
          info={plan ? formatDuration(plan.serviceSeconds) : "—"}
          hint={`${settings.serviceMinutes} min por ponto`}
          icon={Clock}
          titleClassName="text-green-700 dark:text-green-500"
          infoClassName="text-green-700 dark:text-green-500"
        />
        <Card
          title={slackSeconds < 0 ? "Hora extra" : "Folga"}
          info={plan ? formatDuration(Math.abs(slackSeconds)) : "—"}
          hint={
            plan ? `volta à base ${addMinutesToClock(settings.departure, plan.totalSeconds / 60)}` : "—"
          }
          icon={TriangleAlert}
          titleClassName={
            slackSeconds < 0
              ? "text-red-700 dark:text-red-400"
              : "text-amber-600 dark:text-amber-400"
          }
          infoClassName={
            slackSeconds < 0
              ? "text-red-700 dark:text-red-400"
              : "text-amber-600 dark:text-amber-400"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 pt-0 lg:grid-cols-2">
        <Panel
          title="Percurso"
          description="Clique em qualquer ponto do mapa para definir a base da equipe."
        >
          <RouteMap
            base={settings.base}
            stops={mapStops}
            leftOut={mapLeftOut}
            onPickBase={(latitude, longitude) => update({ base: { latitude, longitude } })}
          />
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Parâmetros" description="Salvos neste navegador.">
            <RouteSettingsForm settings={settings} onChange={update} />
          </Panel>

          <Panel
            title="Ordem de visita"
            description="Escolhida por prioridade e tempo de deslocamento."
            actions={
              loading || loadingSensors ? (
                <span className="text-xs text-gray-500 dark:text-gray-300">calculando…</span>
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
              {plan.leftOut.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-gray-100 p-3 dark:bg-gray-600"
                >
                  <span className="truncate font-medium text-gray-800 dark:text-white">
                    {item.id}
                  </span>
                  <span className="text-xs whitespace-nowrap text-gray-500 dark:text-gray-300">
                    {item.score - 1} dia(s)
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </main>
  );
}
