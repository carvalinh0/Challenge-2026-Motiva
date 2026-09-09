import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Loader2,
  RadioTower,
  RefreshCw,
  Ruler,
  Signal,
  Wifi,
} from "lucide-react";
import { Alert } from "@/components/Alert";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { ApiError } from "@/lib/httpClient";
import { useAuth } from "@/features/auth";
import {
  MeshLiveFeed,
  NextAction,
  PrioritySensors,
  SensorMap,
  StatusDonut,
  dashboardApi,
  useDashboard,
} from "@/features/dashboard";
import type { FeedbackMessage } from "@/features/sensors";

type BroadcastKind = "health" | "measure";

export function DashboardPage() {
  const { logout } = useAuth();
  const { sensors, loading, error, events, stats, reload } = useDashboard();

  const [broadcast, setBroadcast] = useState<BroadcastKind | null>(null);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

  async function runBroadcast(kind: BroadcastKind) {
    setBroadcast(kind);
    setFeedback(null);
    try {
      if (kind === "health") {
        const result = await dashboardApi.healthBroadcast();
        const alive = (result?.status ?? []).filter((node) => node.alive).length;
        setFeedback({
          tone: "success",
          text: `${alive} de ${result?.status?.length ?? 0} nó(s) responderam ao healthcheck.`,
        });
      } else {
        const result = await dashboardApi.measurementBroadcast();
        const nodes = result?.measurements ?? [];
        const answered = nodes.filter((node) => node.value !== null).length;
        const busy = nodes.filter((node) => node.busy).length;

        setFeedback({
          tone: "success",
          text:
            `${answered} de ${nodes.length} nó(s) devolveram medição.` +
            // Nó ocupado não é nó mudo: ele respondeu recusando porque já
            // estava varrendo. Sem essa distinção o operador acharia que o nó
            // caiu e iria até lá à toa.
            (busy > 0 ? ` ${busy} estava(m) ocupado(s) com outra varredura.` : ""),
        });
      }
      await reload();
    } catch (err) {
      if (err instanceof ApiError && err.isAuthError) logout();
      else {
        setFeedback({
          tone: "error",
          text: err instanceof Error ? err.message : "Erro inesperado",
        });
      }
    } finally {
      setBroadcast(null);
    }
  }

  return (
    <main className="flex-1 overflow-x-hidden">
      <PageHeader title="Dashboard">
        <button
          onClick={() => runBroadcast("health")}
          disabled={Boolean(broadcast)}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-600"
        >
          {broadcast === "health" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Activity size={16} />
          )}
          Checar todos
        </button>
        <button
          onClick={() => runBroadcast("measure")}
          disabled={Boolean(broadcast)}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#6126F1] px-3 py-1.5 text-sm text-white hover:bg-[#4107d4] disabled:opacity-50"
        >
          {broadcast === "measure" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Ruler size={16} />
          )}
          Medir todos
        </button>
      </PageHeader>

      {feedback && (
        <Alert tone={feedback.tone === "success" ? "success" : "error"}>
          {feedback.text}
        </Alert>
      )}

      {broadcast && (
        <Alert tone="info">
          Comando enviado para a mesh. A janela de resposta é de ~30s
          {broadcast === "measure" ? " (medição pode passar de 1min)" : ""} — os nós
          respondem conforme acordam.
        </Alert>
      )}

      {error && <Alert tone="error">Não foi possível carregar os sensores: {error}</Alert>}

      <div className="grid grid-cols-2 gap-4 p-4 lg:grid-cols-5">
        <Card
          title="Sensores"
          info={loading ? "…" : stats.sensorNodes.length}
          icon={RadioTower}
          titleClassName="text-black dark:text-white"
          infoClassName="text-black dark:text-white"
        />
        <Card
          title="Proxys"
          info={loading ? "…" : stats.proxies.length}
          icon={Wifi}
          titleClassName="text-[#5e22f3] dark:text-[#8f61ff]"
          infoClassName="text-[#5e22f3] dark:text-[#8f61ff]"
        />
        <Card
          title="Altos"
          info={loading ? "…" : stats.altos}
          hint="Acima do limite"
          icon={AlertTriangle}
          titleClassName="text-red-700 dark:text-red-400"
          infoClassName="text-red-700 dark:text-red-400"
        />
        <Card
          title="Baixos"
          info={loading ? "…" : stats.baixos}
          hint="Abaixo do limite"
          icon={Signal}
          titleClassName="text-green-700 dark:text-green-500"
          infoClassName="text-green-700 dark:text-green-500"
        />
        <Card
          title="Perdidos"
          info={loading ? "…" : stats.perdidos}
          hint="Sem notícia há 48h"
          icon={RefreshCw}
          titleClassName="text-amber-600 dark:text-amber-400"
          infoClassName="text-amber-600 dark:text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 pt-0 lg:grid-cols-2">
        <Panel title="Posição dos sensores">
          <SensorMap sensors={sensors} />
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel
            title="Distribuição dos sensores"
            description="Estado da última leitura de cada sensor."
          >
            <StatusDonut sensors={sensors} />
          </Panel>

          <Panel
            title="Próxima ação"
            description="Altura estimada a partir de há quanto tempo o nó detecta vegetação."
          >
            <NextAction sensors={sensors} />
          </Panel>
        </div>
      </div>

      <div className="p-4 pt-0">
        <Panel
          title="Trechos por prioridade"
          description="Sensores que estão detectando vegetação, do mais urgente ao menos."
        >
          <PrioritySensors sensors={sensors} />
        </Panel>
      </div>

      <div className="p-4 pt-0">
        <Panel
          title="Mesh ao vivo"
          description="Respostas chegando por SSE, inclusive as que ninguém pediu."
          actions={
            <span className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
              escutando
            </span>
          }
        >
          <MeshLiveFeed events={events} />
        </Panel>
      </div>
    </main>
  );
}
