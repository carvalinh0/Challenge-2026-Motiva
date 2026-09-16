import mqtt, { type MqttClient } from "mqtt";
import type {
    MeshAction,
    MeshGateway,
    MeshResult,
} from "../../domain/repositories/MeshGateway";
import { log } from "./logger";

// Mesma mesh/broker do firmware do proxy (ver apps/sensor/config.h e
// mqtt_client.cpp): "grama/comando" leva pedidos pro proxy, "grama/resultado"
// é onde as respostas (locais ou vindas da mesh via LoRa) aparecem.
const TOPIC_COMMAND = "grama/comando";
const TOPIC_RESULT = "grama/resultado";

type Waiter = {
    resolve: (result: MeshResult) => void;
    targetNode?: number;
    action: MeshAction;
    broadcast: boolean;
    collected: MeshResult[];
    timer: ReturnType<typeof setTimeout>;
};

// Espelha timeoutForCommand() do firmware: HEALTHCHECK não move nada e responde
// rápido, mas MEASURE/CALIBRATE fazem varredura física antes de responder.
function defaultTimeoutForAction(action: MeshAction): number {
    switch (action) {
        case "MEASURE":
            return 90_000;
        case "CALIBRATE":
            return 240_000;
        default:
            return 15_000;
    }
}

export class MqttProvider implements MeshGateway {
    private client: MqttClient | null = null;
    private readonly waiters = new Set<Waiter>();
    private readonly subscribers = new Set<(result: MeshResult) => void>();

    /**
     * Conexão é opcional: sem MQTT_URL/MQTT_HOST a API continua servindo tudo
     * que não depende da mesh, e só as rotas de mesh falham.
     */
    connect(): void {
        if (this.client) return;

        const url =
            process.env.MQTT_URL ||
            (process.env.MQTT_HOST
                ? `mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`
                : null);

        if (!url) {
            log.warn(
                "mqtt",
                "MQTT_URL/MQTT_HOST nao configurado — rotas que dependem da mesh vao falhar.",
            );
            return;
        }

        log.info("mqtt", `Conectando em ${url}...`);
        this.client = mqtt.connect(url, {
            username: process.env.MQTT_USER || undefined,
            password: process.env.MQTT_PASSWORD || undefined,
            reconnectPeriod: 2000,
        });

        this.client.on("connect", () => {
            log.info("mqtt", `Conectado, assinando ${TOPIC_RESULT}`);
            this.client!.subscribe(TOPIC_RESULT, (err) => {
                if (err) log.error("mqtt", `Falha ao assinar ${TOPIC_RESULT}`, err);
            });
        });

        this.client.on("reconnect", () => log.warn("mqtt", "Reconectando..."));
        this.client.on("close", () => log.warn("mqtt", "Conexao fechada"));
        this.client.on("offline", () => log.warn("mqtt", "Broker offline / sem conexao"));
        this.client.on("error", (err) =>
            log.error("mqtt", "Erro de conexao", err.message),
        );

        this.client.on("message", (topic, payload) =>
            this.handleMessage(topic, payload.toString()),
        );
    }

    private handleMessage(topic: string, raw: string): void {
        if (topic !== TOPIC_RESULT) return;

        let message: MeshResult;
        try {
            message = JSON.parse(raw);
        } catch {
            log.warn("mqtt", `Payload invalido em ${TOPIC_RESULT} (JSON malformado): ${raw}`);
            return;
        }

        if (
            typeof message.sourceNode !== "number" ||
            typeof message.action !== "string" ||
            typeof message.result !== "number"
        ) {
            log.warn("mqtt", `Payload com formato inesperado em ${TOPIC_RESULT}: ${raw}`);
            return;
        }

        log.info(
            "mqtt",
            `<- resultado sourceNode=${message.sourceNode} action=${message.action} result=${message.result}`,
        );

        for (const subscriber of this.subscribers) subscriber(message);

        let matched = false;
        for (const waiter of [...this.waiters]) {
            if (waiter.action !== message.action) continue;

            if (waiter.broadcast) {
                waiter.collected.push(message);
                matched = true;
                continue; // fica aberto até o timeout, coletando várias respostas
            }

            if (waiter.targetNode !== message.sourceNode) continue;
            matched = true;
            clearTimeout(waiter.timer);
            this.waiters.delete(waiter);
            waiter.resolve(message);
        }

        if (!matched) {
            log.debug(
                "mqtt",
                `resultado de sourceNode=${message.sourceNode} action=${message.action} nao correlacionado a nenhum pedido pendente (provavelmente ciclo autonomo do sensor)`,
            );
        }
    }

    private publishCommand(targetNode: number | undefined, action: MeshAction): void {
        if (!this.client) throw new Error("MQTT nao conectado");
        const payload: Record<string, unknown> = { action };
        if (targetNode !== undefined) payload.targetNode = targetNode;
        log.info(
            "mqtt",
            `-> comando ${action} para ${targetNode !== undefined ? `node ${targetNode}` : "BROADCAST (mesh inteira)"}`,
        );
        this.client.publish(TOPIC_COMMAND, JSON.stringify(payload));
    }

    requestFromNode(
        targetNode: number,
        action: MeshAction,
        timeoutMs = defaultTimeoutForAction(action),
    ): Promise<MeshResult> {
        if (!this.client) return Promise.reject(new Error("MQTT nao conectado"));

        const startedAt = performance.now();
        return new Promise((resolve, reject) => {
            const waiter: Waiter = {
                targetNode,
                action,
                broadcast: false,
                collected: [],
                resolve: (result) => {
                    log.info(
                        "mqtt",
                        `<- ${action} sensor ${targetNode} respondeu em ${(performance.now() - startedAt).toFixed(0)}ms (result=${result.result})`,
                    );
                    resolve(result);
                },
                timer: setTimeout(() => {
                    this.waiters.delete(waiter);
                    log.warn(
                        "mqtt",
                        `timeout esperando ${action} do sensor ${targetNode} (${timeoutMs}ms sem resposta)`,
                    );
                    reject(new Error("timeout esperando resposta da rede"));
                }, timeoutMs),
            };

            this.waiters.add(waiter);
            try {
                this.publishCommand(targetNode, action);
            } catch (err) {
                clearTimeout(waiter.timer);
                this.waiters.delete(waiter);
                reject(err);
            }
        });
    }

    /**
     * Comando sem targetNode = broadcast pra mesh inteira. A proteção contra
     * loop já é garantida pelo dedup de messageId no rádio; aqui só se junta
     * tudo que chegar dentro da janela.
     */
    broadcast(
        action: MeshAction,
        // +15s de folga sobre o timeout individual: no broadcast vários nós
        // respondem, e cada resposta pode precisar de mais saltos de relay.
        windowMs = defaultTimeoutForAction(action) + 15_000,
    ): Promise<MeshResult[]> {
        if (!this.client) return Promise.reject(new Error("MQTT nao conectado"));

        return new Promise((resolve, reject) => {
            const waiter: Waiter = {
                action,
                broadcast: true,
                collected: [],
                resolve: () => {},
                timer: setTimeout(() => {
                    this.waiters.delete(waiter);
                    log.info(
                        "mqtt",
                        `broadcast ${action}: janela de ${windowMs}ms fechada, ${waiter.collected.length} resposta(s) coletada(s)`,
                    );
                    resolve(waiter.collected);
                }, windowMs),
            };

            this.waiters.add(waiter);
            try {
                this.publishCommand(undefined, action);
            } catch (err) {
                clearTimeout(waiter.timer);
                this.waiters.delete(waiter);
                reject(err);
            }
        });
    }

    subscribe(listener: (result: MeshResult) => void): () => void {
        this.subscribers.add(listener);
        return () => this.subscribers.delete(listener);
    }

    isConnected(): boolean {
        return this.client?.connected ?? false;
    }
}
