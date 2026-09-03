// Composition root: o único lugar que conhece todas as camadas ao mesmo tempo.
// Instancia as implementações concretas, injeta nos use cases e sobe o servidor.
// Nenhuma camada de dentro importa daqui.

import { createApp } from "./http/app";
import { PrismaSensorRepository } from "./infrastructure/database/PrismaSensorRepository";
import { PrismaMeasurementRepository } from "./infrastructure/database/PrismaMeasurementRepository";
import { MqttProvider } from "./infrastructure/providers/MqttProvider";
import { JwtProvider } from "./infrastructure/providers/JwtProvider";
import { OsrmRouteMatrixProvider } from "./infrastructure/providers/OsrmRouteMatrixProvider";
import { log } from "./infrastructure/providers/logger";

import { RegisterSensorUseCase } from "./application/use-cases/sensor/RegisterSensorUseCase";
import { GetSensorUseCase } from "./application/use-cases/sensor/GetSensorUseCase";
import { UpdateSensorUseCase } from "./application/use-cases/sensor/UpdateSensorUseCase";
import { DeleteSensorUseCase } from "./application/use-cases/sensor/DeleteSensorUseCase";
import { ListSensorsUseCase } from "./application/use-cases/sensor/ListSensorsUseCase";
import { ResetSensorUseCase } from "./application/use-cases/sensor/ResetSensorUseCase";
import { RegisterProxyUseCase } from "./application/use-cases/proxy/RegisterProxyUseCase";
import { GetProxyUseCase } from "./application/use-cases/proxy/GetProxyUseCase";
import { DeleteProxyUseCase } from "./application/use-cases/proxy/DeleteProxyUseCase";
import { ResetProxyUseCase } from "./application/use-cases/proxy/ResetProxyUseCase";
import { AddMeasurementUseCase } from "./application/use-cases/measurement/AddMeasurementUseCase";
import { AddBulkMeasurementsUseCase } from "./application/use-cases/measurement/AddBulkMeasurementsUseCase";
import { IngestMeshResultUseCase } from "./application/use-cases/measurement/IngestMeshResultUseCase";
import { RequestNodeMeasurementUseCase } from "./application/use-cases/mesh/RequestNodeMeasurementUseCase";
import { RequestNodeHealthcheckUseCase } from "./application/use-cases/mesh/RequestNodeHealthcheckUseCase";
import { RequestNodeCalibrationUseCase } from "./application/use-cases/mesh/RequestNodeCalibrationUseCase";
import { BroadcastHealthcheckUseCase } from "./application/use-cases/mesh/BroadcastHealthcheckUseCase";
import { BroadcastMeasurementUseCase } from "./application/use-cases/mesh/BroadcastMeasurementUseCase";
import { LoginUseCase } from "./application/use-cases/auth/LoginUseCase";
import { GetRouteMatrixUseCase } from "./application/use-cases/route/GetRouteMatrixUseCase";

import { SensorController } from "./http/controllers/SensorController";
import { MeasurementController } from "./http/controllers/MeasurementController";
import { ProxyController } from "./http/controllers/ProxyController";
import { MeshController } from "./http/controllers/MeshController";
import { AuthController } from "./http/controllers/AuthController";
import { StatusController } from "./http/controllers/StatusController";
import { RouteController } from "./http/controllers/RouteController";

const PORT = Number(process.env.PORT ?? 3000);

// Folga em cima do ciclo de deep sleep do firmware, não um número "correto".
const ACTIVE_WINDOW_MS = Number(
    process.env.SENSOR_ACTIVE_WINDOW_MS ?? 1000 * 60 * 60 * 48,
);

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DEVICE_TOKEN = process.env.TOKEN;

// Configuração faltando NÃO derruba mais o processo.
//
// Encerrar aqui parecia o certo ("falhar cedo"), mas em produção vira o pior
// dos mundos: o container morre, o Railway devolve 502, e o navegador ainda
// reporta isso como erro de CORS (a página de erro do Railway não tem os
// cabeçalhos) — três sintomas enganosos para uma variável de ambiente
// esquecida. Subir e dizer o que falta é muito mais fácil de diagnosticar.
//
// Não há risco de servir uma API insegura: sem segredo nenhum token é
// emitido ou aceito; as rotas de auth respondem 503 explicando o motivo.
const configErrors: string[] = [];
if (!JWT_SECRET) {
    configErrors.push("JWT_SECRET não configurado — impossível emitir ou validar tokens.");
}
if (!ADMIN_USER || !ADMIN_PASSWORD) {
    configErrors.push(
        "ADMIN_USER/ADMIN_PASSWORD não configurados — ninguém consegue fazer login.",
    );
}
for (const problem of configErrors) {
    log.error("startup", `CONFIGURAÇÃO INCOMPLETA: ${problem}`);
}
if (configErrors.length > 0) {
    log.error(
        "startup",
        "A API vai subir mesmo assim para poder ser diagnosticada: GET /api/status lista os problemas.",
    );
}

if (!DEVICE_TOKEN) {
    log.warn(
        "startup",
        "TOKEN nao configurado (.env) — devices nao vao conseguir enviar medicao por HTTP (rotas de push exigem JWT).",
    );
}

// --- Infraestrutura ---
const sensorRepository = new PrismaSensorRepository();
const measurementRepository = new PrismaMeasurementRepository();
const mesh = new MqttProvider();
// Segredo aleatório quando não há um configurado: garante que nenhum token
// emitido por engano seja válido em outro boot, e que tokens antigos não
// passem. Na prática as rotas de auth já barram antes disso (503).
const jwt = new JwtProvider(
    JWT_SECRET ?? crypto.randomUUID(),
    process.env.JWT_EXPIRES_IN ? Number(process.env.JWT_EXPIRES_IN) : undefined,
);

// --- Aplicação ---
const ingestMeshResult = new IngestMeshResultUseCase(
    sensorRepository,
    measurementRepository,
    log,
);

const controllers = {
    status: new StatusController(sensorRepository, mesh, configErrors),
    auth: new AuthController(
        new LoginUseCase(
            { username: ADMIN_USER ?? "", password: ADMIN_PASSWORD ?? "" },
            jwt,
        ),
    ),
    sensor: new SensorController(
        new RegisterSensorUseCase(sensorRepository),
        new GetSensorUseCase(sensorRepository, measurementRepository),
        new UpdateSensorUseCase(sensorRepository),
        new DeleteSensorUseCase(sensorRepository),
        new ListSensorsUseCase(sensorRepository, measurementRepository, ACTIVE_WINDOW_MS),
        new ResetSensorUseCase(sensorRepository, measurementRepository),
    ),
    measurement: new MeasurementController(
        new AddMeasurementUseCase(sensorRepository, measurementRepository),
        new AddBulkMeasurementsUseCase(sensorRepository, measurementRepository),
    ),
    route: new RouteController(new GetRouteMatrixUseCase(new OsrmRouteMatrixProvider())),
    proxy: new ProxyController(
        new RegisterProxyUseCase(sensorRepository),
        new GetProxyUseCase(sensorRepository, measurementRepository, ACTIVE_WINDOW_MS),
        new DeleteProxyUseCase(sensorRepository),
        new ResetProxyUseCase(sensorRepository, measurementRepository),
    ),
    mesh: new MeshController(
        new RequestNodeMeasurementUseCase(sensorRepository, mesh),
        new RequestNodeHealthcheckUseCase(sensorRepository, mesh),
        new RequestNodeCalibrationUseCase(sensorRepository, mesh),
        new BroadcastHealthcheckUseCase(sensorRepository, mesh),
        new BroadcastMeasurementUseCase(sensorRepository, mesh),
        mesh,
    ),
};

// A API fica SEMPRE escutando a mesh, não só quando ela mesma pede algo: um
// sensor comum reporta sozinho ao acordar pelo timer, e sem este listener essas
// medições nunca seriam gravadas.
mesh.connect();
mesh.subscribe((result) => {
    void ingestMeshResult.execute(result).catch((err) => {
        log.error("mesh", "falha ao persistir resultado recebido da mesh", err);
    });
});

log.info("startup", `Admin configurado: ${ADMIN_USER}`);
log.info("startup", `Janela de atividade dos sensores: ${ACTIVE_WINDOW_MS}ms`);
log.info("startup", `DATABASE_URL: ${process.env.DATABASE_URL ?? "(nao configurado)"}`);

// Sem isso, um banco inacessível só aparecia na primeira rota que o usasse —
// o login continuava funcionando (é a única rota que não toca o banco) e o
// sintoma virava "criar sensor não responde", sem pista nenhuma na subida.
void sensorRepository
    .findAll()
    .then((sensores) =>
        log.info("startup", `Banco acessível — ${sensores.length} nó(s) cadastrado(s).`),
    )
    .catch((err) =>
        log.error(
            "startup",
            "BANCO INACESSÍVEL — o login vai funcionar, mas toda rota que lê ou grava dados vai falhar. Verifique DATABASE_URL e se o diretório é gravável.",
            err,
        ),
    );

const app = createApp({ controllers, jwt, deviceToken: DEVICE_TOKEN, configErrors });

export default {
    port: PORT,
    // "::" (IPv6 any) e NÃO "0.0.0.0".
    //
    // A rede interna do Railway é IPv6; um socket IPv4-puro é invisível para o
    // proxy deles, e o sintoma é exatamente "o processo subiu, os logs estão
    // limpos, e a borda devolve 502". Em Linux, "::" aceita IPv6 e também IPv4
    // (endereços v4-mapeados), então isto cobre os dois — enquanto "0.0.0.0"
    // cobriria só IPv4. Verificado com `ss`: "::" abre `*:PORT` (dual-stack),
    // "0.0.0.0" abre `0.0.0.0:PORT` e recusa conexão IPv6.
    hostname: "::",
    fetch: app.fetch,
    // Default do Bun mata conexão ociosa em 10s, bem antes dos timeouts reais
    // da mesh (CALIBRATE espera até 240s). 255 é o teto aceito pelo Bun.
    idleTimeout: 250,
};

log.info("startup", `Servidor escutando em [::]:${PORT} (IPv6 + IPv4)`);
