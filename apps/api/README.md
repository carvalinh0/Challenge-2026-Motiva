# API de Sensores

Bun + [Hono](https://hono.dev) + [Zod](https://zod.dev) + [Prisma](https://prisma.io) (PostgreSQL).

## Como rodar

```bash
bun install
cp .env.example .env   # preencher JWT_SECRET, ADMIN_USER, ADMIN_PASSWORD, TOKEN, MQTT_URL
bun run db:migrate     # cria o banco e aplica as migrations
bun run dev
```

Scripts: `db:generate` (regera o client do Prisma), `db:migrate` (migration de desenvolvimento), `db:deploy` (aplica migrations em produção), `db:studio` (UI do banco), `typecheck`.

> O adapter do Prisma é o **pg**, usando a conexão PostgreSQL definida em `DATABASE_URL`.

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
| `DATABASE_URL` | ex.: `postgresql://usuario:senha@localhost:5432/motiva?schema=public` |
| `TOKEN` | opcional; sem ele os devices não conseguem enviar medição por HTTP |
| `MQTT_URL` | opcional; sem ele só as rotas de mesh falham |
| `PORT` | injetada pelo Railway; o servidor a respeita e escuta em `0.0.0.0` |

### Se o processo sobe mas a plataforma devolve 502

Sintoma: os logs mostram `Servidor escutando em [::]:8080` e nada mais — **nenhuma linha de requisição** (o middleware registra todas, inclusive 404). Se o tráfego não aparece no log, ele não está chegando ao processo. Duas causas comuns:

- **Bind IPv4-puro.** A rede interna do Railway é IPv6. O servidor usa `hostname: "::"`, que no Linux aceita IPv6 **e** IPv4 — `0.0.0.0` cobriria só IPv4 e ficaria invisível para o proxy. Não troque por `0.0.0.0`.
- **Health check apontando para uma rota que devolve 404.** A plataforma marca o deploy como não saudável e para de rotear, enquanto o processo segue vivo. Por isso `GET /` responde 200 sem autenticação e sem tocar o banco. Se houver um *Healthcheck Path* configurado no serviço, use `/` ou `/api/status`.

> No Railway, configure `DATABASE_URL` com a URL do serviço PostgreSQL. Em uma base PostgreSQL nova, aplique as migrations antes de iniciar a API.

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

Regras que valem para todas as rotas: `latitude` entre -90 e 90, `longitude` entre -180 e 180, `id` de nó inteiro de 0 a 65535, `value` de medição só aceita `0`, `1` ou `2`.

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

O **`id` de um nó É o NODE_ID dele na mesh LoRa** (o `#define NODE_ID` em `apps/sensor/config.h`): inteiro, de 0 a 65535.

Antes existiam dois campos — `id` (texto, escolhido no cadastro) e `node_id` (número, vindo do rádio). Na prática todo mundo mantinha os dois iguais, mas nada obrigava: bastava um cadastro desatento para o nó existir na API com um número e no rádio com outro, e o sintoma disso (comandos que nunca chegam, medições que nunca aparecem) não aponta para a causa. Agora são a mesma coisa e não há como divergirem.

Consequências práticas:

- `node_id` **não existe mais** em nenhum body nem em nenhuma resposta.
- O id **não é editável** por `PATCH`: é o endereço de rádio gravado na placa. Para mudar o endereço de um nó, regrave o firmware e cadastre o novo id.
- O proxy só pode ter o id `0` (`MESH_PROXY_NODE_ID` no firmware).
- Não existe mais "sensor sem node_id": todo sensor cadastrado é um nó endereçável pela mesh.

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
        "id": number,
        "latitude": number,
        "longitude": number,
        "type": "proxy" | "sensor",
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
}
```

Resposta 200: 
```ts
{
    "status": "success",
    "data": {
        "id": number,
        "latitude": number,
        "longitude": number,
        "type": "proxy" | "sensor",
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

Requer o broker MQTT acessível — sem isso essa rota não tem como funcionar. A medição real varre a janela calibrada inteira e pode demorar até ~90s no pior caso antes de responder.

Resposta 200:
```ts
{
    "status": "success",
    "data": number
}
```

Resposta 409 — já há um comando em voo para este nó, ou o próprio nó recusou por estar varrendo (ver "Um comando por nó de cada vez"). Não é falha de comunicação: a mesh está saudável, é só aguardar ou tentar de novo em instantes.
```json
{
    "status": "error",
    "message": "já existe um MEASURE em andamento neste nó; aguarde o resultado ou tente de novo em instantes"
}
```

Resposta 404:
```json
{
    "status": "error",
    "message": "Sensor não encontrado"
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
            "id": number,
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
            "id": number,
            "latitude": number,
            "longitude": number,
            "type": "proxy" | "sensor",
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
        "id": number,
        "latitude": number,
        "longitude": number,
        "type": "proxy",
        "lastMeasurements": [
            {
                "timestamp": number,
                "value": number
            },
            ...
        ],
        "sensors": [
            {
                "id": number,
                "latitude": number,
                "longitude": number,
                "type": "sensor",
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
- O sensor alvo estar cadastrado (o id dele é o `NODE_ID` do `config.h` do firmware).

**A API fica sempre conectada e escutando `grama/resultado`**, não só quando alguém chama uma dessas rotas — qualquer resultado que aparecer nesse tópico é persistido automaticamente (medição vai pro banco, `last_seen` do sensor é atualizado), inclusive medições que um sensor manda por conta própria no ciclo autônomo (acordou pelo timer, sem ninguém ter pedido nada pela API). Esse listener é o `IngestMeshResultUseCase`, assinado no gateway em `src/main.ts`.

### Cadastro automático de nós

Um nó que aparece na mesh sem estar na lista de sensores **é cadastrado sozinho**. O gatilho normal é o healthcheck que todo sensor manda ao INICIALIZAR (`sendEarlyHealthcheck` no firmware — só no boot, não a cada wake): basta energizar a placa com o `NODE_ID` certo pra ela aparecer em `GET /api/sensors`.

O cadastro é deliberadamente incompleto:

| campo | valor |
|---|---|
| `id` | o NODE_ID que veio no pacote |
| `name` | `"Nó <id> (cadastro automático)"` |
| `type` | `"proxy"` se o id for 0, senão `"sensor"` |
| `latitude`/`longitude` | `null` |

**Sem coordenadas de propósito** — a mesh não carrega essa informação e inventá-la seria pior que não ter. O nó entra na listagem e passa a acumular histórico na hora, mas só aparece no mapa e no roteiro de roçada depois que alguém informar onde ele está (`PATCH /api/sensors/:id`).

Vale saber que a mesh não é autenticada: qualquer transmissor no alcance pode criar linhas na tabela de sensores. Isso não amplia o que já era possível (forjar medições de nós existentes já era), mas a lista de sensores deixou de ser só o que um humano cadastrou.

### Um comando por nó de cada vez

**A API serializa comandos de mesh por nó.** Enquanto um `MEASURE`/`HEALTHCHECK`/`CALIBRATE` está em voo para o nó N, um segundo pedido para N é recusado com **409 imediatamente, sem chegar ao rádio**. Quem pediu primeiro continua esperando e recebe o dado dele; quem chegou no meio recebe o aviso.

Isso é feito na API, e não só no firmware, porque o proxy correlaciona respostas por nó + comando. **Dois pedidos do mesmo comando para o mesmo nó são indistinguíveis na volta** — sem a trava, qual dos dois receberia a leitura de verdade e qual receberia a recusa viraria sorteio, e os dois navegadores acabavam vendo a mesma mensagem.

```json
{
    "status": "error",
    "message": "já existe um MEASURE em andamento neste nó; aguarde o resultado ou tente de novo em instantes"
}
```

A trava é liberada quando o resultado chega **ou quando o timeout estoura** — um nó que sumiu no meio de uma medição não fica bloqueado para sempre.

> O registro vive na memória do processo. Com mais de uma instância da API contra o mesmo broker, cada uma enxerga só os próprios comandos e a serialização deixa de valer; aí ele precisa sair para algo compartilhado (Redis, ou uma tabela com lock).

### Recusa do próprio nó (rede de segurança)

Um sensor tem um motor só. Se um `MEASURE` ou `CALIBRATE` chegar ao nó enquanto ele já está varrendo — o que agora só acontece para comandos que **não** passaram por esta API (outra instância, ou um publish manual no broker) — o firmware **recusa na hora** com `MESH_RESULT_BUSY` (3) em vez de enfileirar. Enfileirar significaria responder muito depois do timeout de quem pediu, gastando uma segunda varredura de bateria para produzir um resultado que ninguém está mais esperando.

Isso nunca vira medição no banco: 3 está fora da faixa 0/1/2 e o listener descarta explicitamente. Nas rotas síncronas vira 409, e no broadcast vira o campo `busy`.

Healthcheck é exceção no firmware — esse é respondido mesmo durante uma varredura, pela própria task de LoRa. Durante esse intervalo, "vivo" prova que o rádio e a mesh estão de pé, não que o núcleo principal está.

---

### GET /api/sensors/:id/healthcheck
Aciona um healthcheck via mesh só pra este sensor. Nunca dá erro HTTP por timeout — `alive: false` cobre esse caso.

Resposta 200:
```ts
{
    "status": "success",
    "data": { "id": number, "alive": boolean }
}
```

---

### POST /api/sensors/:id/calibrate
Aciona uma recalibração remota via mesh. Timeout bem maior que os outros comandos (~240s) porque a calibração varre o range inteiro em duas direções.

Resposta 200:
```ts
{
    "status": "success",
    "data": { "id": number, "ok": boolean }
}
```

Resposta 409 — já há um comando em voo para este nó, ou o nó recusou por estar varrendo. Diferente de `ok: false`, que significa "tentou calibrar e não conseguiu": aqui nada chegou a ser tentado.

---

### POST /api/health
Healthcheck em **broadcast** — pede pra mesh inteira responder de uma vez (sem `targetNode`, ver `sensor_grama/mqtt_client.cpp`), junta as respostas por alguns segundos e devolve o status de cada sensor cadastrado.

Resposta 200:
```ts
{
    "status": "success",
    "data": {
        "status": [
            { "id": number, "alive": boolean }
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
            {
                "id": number,
                "value": number | null,
                "busy": boolean
            }
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
