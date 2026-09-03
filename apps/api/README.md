# API de Sensores

Bun + [Hono](https://hono.dev) + [Zod](https://zod.dev) + [Prisma](https://prisma.io) (SQLite).

## Como rodar

```bash
bun install
cp .env.example .env   # preencher JWT_SECRET, ADMIN_USER, ADMIN_PASSWORD, TOKEN, MQTT_URL
bun run db:migrate     # cria o banco e aplica as migrations
bun run dev
```

Scripts: `db:generate` (regera o client do Prisma), `db:migrate` (migration de desenvolvimento), `db:deploy` (aplica migrations em produção), `db:studio` (UI do banco), `typecheck`.

> O adapter do Prisma é o **libSQL**, não o `better-sqlite3` da documentação oficial: o binding nativo do `better-sqlite3` não carrega sob Bun (`ERR_DLOPEN_FAILED`). O arquivo `.db` é o mesmo SQLite de sempre.

## Deploy (Railway)

O `start` é autossuficiente — gera o client do Prisma, aplica as migrations e só então sobe o servidor:

```bash
prisma generate && prisma migrate deploy && bun src/main.ts
```

Os dois primeiros passos são obrigatórios em produção: `generated/` **não é versionado** (é código gerado), então sem o `prisma generate` o processo morre com `Cannot find module '../../../generated/prisma/client'` antes de abrir a porta — e o Railway responde `502 Application failed to respond` sem nada aparecer no seu terminal local.

### Diagnóstico: `GET /api/status`

Rota **sem autenticação** que responde o que está de pé. É o primeiro lugar a olhar quando algo não funciona:

```bash
curl https://SUA-API.up.railway.app/api/status
```

```json
{
    "status": "success",
    "data": {
        "server": "ok",
        "database": { "ok": true, "latencyMs": 0.7 },
        "mqtt": { "connected": true },
        "uptimeSeconds": 132
    }
}
```

Como ler o resultado:

| Sintoma | O que significa |
|---|---|
| Não responde nada / 502 | O processo não está no ar — ver logs do deploy (falta env var? build?) |
| `database.ok: false` | **Login funciona, mas tudo que lê ou grava dados falha.** O login é a única rota que não toca o banco, então esse é exatamente o par de sintomas. A mensagem em `database.error` diz o porquê |
| `mqtt.connected: false` | Só as rotas de mesh falham; o resto funciona |

O log de subida também avisa: `Banco acessível — N nó(s) cadastrado(s)` ou `BANCO INACESSÍVEL`.

**Variáveis obrigatórias** (sem elas o processo encerra na subida, o que também vira 502):

| Variável | Observação |
|---|---|
| `JWT_SECRET` | sem ele não há como assinar/verificar token |
| `ADMIN_USER` / `ADMIN_PASSWORD` | sem eles ninguém consegue logar |
| `DATABASE_URL` | ex.: `file:./dev.db` |
| `TOKEN` | opcional; sem ele os devices não conseguem enviar medição por HTTP |
| `MQTT_URL` | opcional; sem ele só as rotas de mesh falham |
| `PORT` | injetada pelo Railway; o servidor a respeita e escuta em `0.0.0.0` |

### Se o processo sobe mas a plataforma devolve 502

Sintoma: os logs mostram `Servidor escutando em [::]:8080` e nada mais — **nenhuma linha de requisição** (o middleware registra todas, inclusive 404). Se o tráfego não aparece no log, ele não está chegando ao processo. Duas causas comuns:

- **Bind IPv4-puro.** A rede interna do Railway é IPv6. O servidor usa `hostname: "::"`, que no Linux aceita IPv6 **e** IPv4 — `0.0.0.0` cobriria só IPv4 e ficaria invisível para o proxy. Não troque por `0.0.0.0`.
- **Health check apontando para uma rota que devolve 404.** A plataforma marca o deploy como não saudável e para de rotear, enquanto o processo segue vivo. Por isso `GET /` responde 200 sem autenticação e sem tocar o banco. Se houver um *Healthcheck Path* configurado no serviço, use `/` ou `/api/status`.

> ⚠️ **SQLite no Railway é efêmero.** O disco do container é recriado a cada deploy, então sensores e medições somem a cada publicação. Para manter os dados, monte um **Volume** e aponte o `DATABASE_URL` para dentro dele (ex.: `file:/data/prod.db`), ou migre para Postgres trocando o `provider` no `schema.prisma` e o adapter em `src/infrastructure/database/prisma.ts`.

## Arquitetura

```
src/
├── domain/           # regras e contratos puros, sem dependência externa
├── application/      # use cases + DTOs (Zod) + erros de aplicação
├── infrastructure/   # Prisma, MQTT, JWT, logger
└── http/             # controllers, middlewares, rotas (Hono)
```

As dependências apontam sempre para dentro: `http` → `application` → `domain`. Quem conhece todas as camadas ao mesmo tempo é só `src/main.ts` (composition root), que instancia as implementações concretas e injeta nos use cases.

Erros de negócio são lançados como tipos (`NotFoundError`, `ConflictError`, ...) e traduzidos para status HTTP num único lugar (`http/middlewares/errorHandler.ts`) — os use cases não conhecem HTTP.

---

# Autenticação

Existem **dois esquemas**, e a rota decide qual aceita:

| Quem | Credencial | Onde usa |
|---|---|---|
| Usuários do site | **JWT** obtido em `POST /api/auth/login` | todas as rotas de gestão, leitura e mesh |
| Sensores/proxies | **token estático** (`TOKEN` do `.env`) | só `POST /api/sensors/:id/measurement` e `POST /api/sensors/measurements` |

O hardware em campo não tem como fazer login nem renovar token, por isso o segredo fixo continua valendo — mas só nas duas rotas de ingestão de medição. O token de device recebe **403** em qualquer outra rota. Um JWT válido é aceito em todas.

Em ambos os casos o header é o mesmo:

```
Authorization: Bearer <jwt-ou-token>
```

Sem header nenhum → **401**; header presente mas inválido/expirado → **403**:

```ts
{ "status": "error", "message": "Não autenticado" }
```
```ts
{ "status": "error", "message": "Não autorizado" }
```

### POST /api/auth/login
Única rota pública. Valida contra `ADMIN_USER`/`ADMIN_PASSWORD` do `.env` (não há tabela de usuários) e devolve o JWT.

Request Body
```ts
{
    "username": string,
    "password": string
}
```

Resposta 200:
```ts
{
    "status": "success",
    "data": {
        "token": string,
        "expiresAt": number,
        "username": string
    }
}
```

Resposta 403 (usuário ou senha inválidos):
```ts
{
    "status": "error",
    "message": "Usuário ou senha inválidos"
}
```

---

### GET /api/auth/me
Confirma que o token ainda vale e de quem ele é.

Resposta 200:
```ts
{
    "status": "success",
    "data": { "username": string }
}
```

---

# Validação

Todo corpo e query string passa por Zod. Entrada malformada devolve **400** com o campo e o motivo:

```ts
{
    "status": "error",
    "message": "Dados inválidos — latitude: Too big: expected number to be <=90"
}
```

Regras que valem para todas as rotas: `latitude` entre -90 e 90, `longitude` entre -180 e 180, `node_id` inteiro de 0 a 65535, `value` de medição só aceita `0`, `1` ou `2`.

---

# Rate limit

600 requisições por minuto, por IP (configurável em `RATE_LIMIT_PER_MINUTE`). Preflights de CORS (`OPTIONS`) não entram na conta.

Ao estourar, **todas** as rotas passam a responder 429 até a janela virar — inclusive `POST /api/auth/login`, o que na prática parece "a API parou de responder". A resposta traz o header `Retry-After` com os segundos restantes:

```json
{
    "status": "error",
    "message": "Muitas requisições. Tente novamente em 42s."
}
```

---

# Endpoints

Todos os sensores guardam a informação de quem é o proxy responsável por eles (no banco de dados apenas), e esse id pode mudar caso o proxy mude ou o sensor seja movido para outro local.

`value` nas medições é sempre **number**: `0` = abaixo do limite de altura, `1` = acima do limite, `2` = sem leitura confiável (ver `sensor_grama/command_dispatcher.h` no firmware — é o mesmo código que sai do sensor via LoRa/MQTT, a API não reinterpreta).

`node_id` é o NODE_ID numérico do sensor na mesh LoRa (ver `sensor_grama/config.h`). É opcional nos bodies de criação/atualização, mas **obrigatório** para qualquer rota que aciona a mesh (seção "Mesh" mais abaixo) — sem ele a API não sabe pra qual nó mandar o comando nem de qual nó aceitar respostas.

---

## Sensores

### POST /api/sensors/:id
Registra um novo sensor

Request Body
```ts
{
    "name"?: string,
    "latitude": number,
    "longitude": number,
    "proxy_id"?: string,
    "node_id"?: number
}
```

Resposta 201: 
```ts
{
    "status": "success",
    "message": "Sensor criado com sucesso"
}
```

Resposta 409: 
```ts
{
    "status": "error",
    "message": "O sensor já existe"
}
```

---

### GET /api/sensors/:id
Obtem dados do sensor

Request Params
```
measurements: number (opcional, padrão 90)
```

Resposta 200: 
```ts
{
    "status": "success",
    "data": {
        "id": string,
        "latitude": number,
        "longitude": number,
        "type": "proxy" | "sensor",
        "node_id": number | null,
        "lastMeasurements": [
            {
                "timestamp": number,
                "value": number
            }
            ...
        ]
    }
}
```

Resposta 404:
```json
{
    "status": "error",
    "message": "Sensor não encontrado"
}
```

---

### PATCH /api/sensors/:id
Atualiza dados do sensor (informações do sensor apenas não dados de medição)

Request Body
```ts
{
    "name"?: string,
    "latitude"?: number,
    "longitude"?: number,
    "type"?: "proxy" | "sensor",
    "proxy_id"?: string,
    "node_id"?: number
}
```

Resposta 200: 
```ts
{
    "status": "success",
    "data": {
        "id": string,
        "latitude": number,
        "longitude": number,
        "type": "proxy" | "sensor",
        "node_id": number | null
    }
}
```

Resposta 404:
```json
{
    "status": "error",
    "message": "Sensor não encontrado"
}
```

---

### POST /api/sensors/:id/measurement
Adiciona uma nova medição ao sensor diretamente (push feito pelo próprio device por HTTP, sem passar pela mesh LoRa/MQTT)

> Aceita o **token estático de device** (`TOKEN` do `.env`) além do JWT — ver seção "Autenticação".

> Nota: Ao receber um 404 o sensor deve enviar uma requisição POST para `/api/sensors/:id` com os dados do sensor para cadastrar e depois enviar a medição novamente.

Request Body
```ts
{
    "value": number
}
```

Resposta 204: Nada (sucesso)

Resposta 404:
```json
{
    "status": "error",
    "message": "Sensor não encontrado"
}
```

---

### GET /api/sensors/:id/measurement
Aciona uma medição de verdade **via mesh** (API publica em MQTT `grama/comando` → proxy repassa por LoRa → sensor mede e responde em `grama/resultado`) e devolve o valor assim que a resposta chegar.

Requer que o sensor tenha `node_id` configurado (ver POST/PATCH `/api/sensors/:id`) e o broker MQTT acessível — sem isso essa rota não tem como funcionar. A medição real varre a janela calibrada inteira e pode demorar até ~90s no pior caso antes de responder.

Resposta 200:
```ts
{
    "status": "success",
    "data": number
}
```

Resposta 404:
```json
{
    "status": "error",
    "message": "Sensor não encontrado"
}
```

Resposta 422 (sensor sem `node_id`):
```json
{
    "status": "error",
    "message": "sensor sem node_id configurado, nao e possivel acionar via mesh"
}
```

Resposta 504 (sensor não respondeu a tempo — ver seção "Mesh" mais abaixo):
```json
{
    "status": "error",
    "message": "timeout esperando resposta da mesh"
}
```

---

### POST /api/sensors/measurements
Adiciona uma nova medição aos sensores

> Aceita o **token estático de device** (`TOKEN` do `.env`) além do JWT — ver seção "Autenticação".

> Nota: Ao receber um 203 o sensor/proxy deve enviar uma requisição POST para `/api/sensors/:id` com os dados do sensor para cadastrar e depois enviar a medição novamente mas dessa vez apenas dos sensores não encontrados.

Request Body
```ts
{
    "data": [
        {
            "id": string,
            "value": number
        }
        ...
    ]
}
```

Resposta 204: Nada (sucesso)

Resposta 203:
```ts
{
    "status": "success",
    "message": "As medições foram adicionadas com sucesso, mas alguns sensores não foram encontrados. Envie-os novamente com o status 204.",
    "data": {
        "failed": [string, ...] <- ids dos sensores não encontrados
    }
}
```


Resposta 404:
```json
{
    "status": "error",
    "message": "Sensor não encontrado"
}
```

---

### DELETE /api/sensors/:id
Deleta o sensor

Resposta 200:
```json
{
    "status": "success"
}
```

Resposta 404:
```json
{
    "status": "error",
    "message": "Sensor não encontrado"
}
```

---

### POST /api/sensors/:id/reset
Reseta o sensor (deleta e recria, tanto no banco de dados quanto o sensor em si caso precise de configuração inicial)

Resposta 200:
```json
{
    "status": "success"
}
```

Resposta 404:
```json
{
    "status": "error",
    "message": "Sensor não encontrado"
}
```

---

### GET /api/sensors

Request Params
```
closeTo: string (opcional, formato: "latitude,longitude", filtra por raio a partir dessa localização)
radius: number (opcional, em km, padrão 10, só tem efeito junto com closeTo)
proxy: id (opcional, id do proxy em que o sensor está conectado)
active: boolean (opcional, padrão false, retorna só sensores com last_seen dentro da janela de atividade)
lost: boolean (opcional, padrão false, retorna só sensores FORA da janela de atividade — inclusive os que nunca reportaram nada)
```

"Ativo"/"perdido" são baseados em `last_seen` (atualizado toda vez que o sensor responde qualquer coisa pela mesh — medição, healthcheck ou calibração — ver seção "Mesh"). A janela é `SENSOR_ACTIVE_WINDOW_MS` (env var, padrão 48h) — não é um conceito rígido, é só uma folga em cima do ciclo de deep sleep do firmware.

Cada item já vem com `last_seen` e `active`, então **não é preciso uma segunda chamada com `?active=true` só para separar ativos de perdidos** — os filtros existem para quando você quer só um dos grupos.

Resposta 200: 
```ts
{
    "status": "success",
    "data": [
        {
            "id": string,
            "latitude": number,
            "longitude": number,
            "type": "proxy" | "sensor",
            "node_id": number | null,
            "last_seen": number | null,   // epoch ms; null = nunca reportou
            "active": boolean,            // last_seen dentro da janela
            "lastMeasurement": {
                "timestamp": number,
                "value": number
            } | null,
            "consecutiveHighDays": number // dias seguidos reportando acima do limite
        }
        ...
    ]
}
```

`consecutiveHighDays` é a prioridade de roçada: conta, de hoje para trás, quantos dias seguidos o nó reportou acima do limite. Um dia com qualquer leitura ABAIXO encerra a contagem; leituras "sem leitura confiável" (valor 2) e dias sem nenhuma leitura não contam nem encerram — mas mais de dois dias seguidos em silêncio encerram, para um nó que sumiu não acumular prioridade em cima de leitura velha.

---

## Proxy

### POST /api/proxy/:id
Cria um novo proxy com o id especificado

Request Body:
```ts
{
    "name"?: string,
    "latitude": number,
    "longitude": number,
    "node_id"?: number <- NODE_ID do proxy na mesh; DEVE ser 0 (MESH_PROXY_NODE_ID no firmware) se for informado. Se omitido, assume 0.
}
```

Resposta 201:
```json
{
    "status": "success",
    "message": "Proxy criado com sucesso"
}
```

Resposta 409: 
```json
{
    "status": "error",
    "message": "O proxy já existe"
}
```

---

### GET /api/proxy/:id
Aciona e retorna os sensores conectados a um proxy (incluindo o proxy em si)

>Nota: O proxy também é um sensor, então é esperado que ele também apareça na resposta da lista de sensores.

Resposta 200:
```ts
{
    "status": "success",
    "data": {
        "id": string,
        "latitude": number,
        "longitude": number,
        "type": "proxy",
        "node_id": number | null,
        "lastMeasurements": [
            {
                "timestamp": number,
                "value": number
            },
            ...
        ],
        "sensors": [
            {
                "id": string,
                "latitude": number,
                "longitude": number,
                "type": "sensor",
                "node_id": number | null,
                "lastMeasurement": {
                    "timestamp": number,
                    "value": number
                } | null
            }
            ...
        ]
    }
}
```

Resposta 404:
```json
{
    "status": "error",
    "message": "Proxy não encontrado"
}
```

---

### DELETE /api/proxy/:id
Deleta o sensor

Resposta 200:
```json
{
    "status": "success"
}
```

Resposta 404:
```json
{
    "status": "error",
    "message": "Proxy não encontrado"
}
```

---

### POST /api/proxy/:id/reset
Reseta o proxy (deleta e recria, tanto no banco de dados quanto o sensor em si caso precise de configuração inicial)

Resposta 200:
```json
{
    "status": "success"
}
```

Resposta 404:
```json
{
    "status": "error",
    "message": "Proxy não encontrado"
}
```

---

## Mesh (LoRa via MQTT)

Essas rotas não fazem parte do fluxo "device envia HTTP" acima — elas acionam a mesh de verdade (API → MQTT `grama/comando` → proxy → LoRa → sensor → LoRa → proxy → MQTT `grama/resultado` → API), pro site poder disparar comandos e ver o resultado sem precisar mexer no broker MQTT diretamente. Ver `sensor_grama/mqtt_client.cpp` no firmware pro protocolo completo.

Precisam de:
- **JWT** (o token estático de device não vale aqui).
- `MQTT_URL` (ou `MQTT_HOST`/`MQTT_PORT`) configurado no `.env` — mesmo broker do proxy.
- O sensor alvo ter `node_id` cadastrado (bate com `NODE_ID` do `config.h` do firmware).

**A API fica sempre conectada e escutando `grama/resultado`**, não só quando alguém chama uma dessas rotas — qualquer resultado que aparecer nesse tópico é persistido automaticamente (medição vai pro banco, `last_seen` do sensor é atualizado), inclusive medições que um sensor manda por conta própria no ciclo autônomo (acordou pelo timer, sem ninguém ter pedido nada pela API). Esse listener é o `IngestMeshResultUseCase`, assinado no gateway em `src/main.ts`.

---

### GET /api/sensors/:id/healthcheck
Aciona um healthcheck via mesh só pra este sensor. Nunca dá erro HTTP por timeout — `alive: false` cobre esse caso.

Resposta 200:
```ts
{
    "status": "success",
    "data": { "id": string, "alive": boolean }
}
```

---

### POST /api/sensors/:id/calibrate
Aciona uma recalibração remota via mesh. Timeout bem maior que os outros comandos (~240s) porque a calibração varre o range inteiro em duas direções.

Resposta 200:
```ts
{
    "status": "success",
    "data": { "id": string, "ok": boolean }
}
```

---

### POST /api/health
Healthcheck em **broadcast** — pede pra mesh inteira responder de uma vez (sem `targetNode`, ver `sensor_grama/mqtt_client.cpp`), junta as respostas por alguns segundos e devolve o status de cada sensor cadastrado com `node_id`.

Resposta 200:
```ts
{
    "status": "success",
    "data": {
        "status": [
            { "id": string, "node_id": number, "alive": boolean }
            ...
        ]
    }
}
```

Resposta 503 (MQTT não conectado):
```ts
{
    "status": "error",
    "message": "MQTT nao conectado"
}
```

---

### POST /api/measurements/broadcast
Igual ao `/api/health`, mas pede uma medição (`MEASURE`) pra mesh inteira de uma vez em vez de um healthcheck.

Resposta 200:
```ts
{
    "status": "success",
    "data": {
        "measurements": [
            { "id": string, "node_id": number, "value": number | null }
            ...
        ]
    }
}
```

---

### GET /api/events
Server-Sent Events — fica aberto recebendo, em tempo real, todo resultado que chegar em `grama/resultado` (mesmo os que ninguém pediu pela API). Pra usar com `EventSource` no navegador (que não manda header `Authorization`), o token pode ir por query string: `/api/events?token=...`.

Cada evento tem o formato:
```ts
{ "sourceNode": number, "action": "MEASURE" | "HEALTHCHECK" | "CALIBRATE", "result": number }
```
---

## Roteiro

### POST /api/route/matrix
Tempos de deslocamento entre pontos, para montar o roteiro de roçada do dia.

A API só devolve a matriz — a escolha das paradas e da ordem é do cliente. A divisão é proposital: a matriz depende de rede e muda pouco, enquanto a otimização precisa rodar de novo a cada ajuste de jornada, número de paradas ou tempo de roçada.

Os tempos vêm do serviço `/table` do OSRM público. Se ele não responder, a API cai para uma estimativa geométrica (linha reta a 60 km/h) e sinaliza isso em `source` — o cliente decide o quanto confiar.

Request Body
```ts
{
    "points": [
        { "latitude": number, "longitude": number }
        // de 2 a 50 pontos; por convenção o primeiro é a base da equipe
    ]
}
```

Resposta 200:
```ts
{
    "status": "success",
    "data": {
        "durations": number[][], // durations[i][j] em segundos, na ordem enviada
        "source": "osrm" | "haversine"
    }
}
```
