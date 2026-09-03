// Porta (contrato) para a mesh LoRa, que a API alcança via MQTT. Fica aqui
// junto dos repositórios porque, para as camadas de dentro, é a mesma coisa:
// uma dependência externa descrita só por interface, cuja implementação real
// (MqttProvider) vive em infrastructure e pode ser trocada/mockada.

export type MeshAction = "CALIBRATE" | "MEASURE" | "HEALTHCHECK";

export interface MeshResult {
    sourceNode: number;
    action: MeshAction;
    result: number;
}

export interface MeshGateway {
    /** Aciona UM nó e espera a resposta correlacionada; rejeita no timeout. */
    requestFromNode(
        targetNode: number,
        action: MeshAction,
        timeoutMs?: number,
    ): Promise<MeshResult>;
    /** Aciona a mesh inteira e junta tudo que chegar dentro da janela. */
    broadcast(action: MeshAction, windowMs?: number): Promise<MeshResult[]>;
    /** Toda resposta que aparecer na mesh, inclusive as que ninguém pediu. Retorna o unsubscribe. */
    subscribe(listener: (result: MeshResult) => void): () => void;
    isConnected(): boolean;
}
