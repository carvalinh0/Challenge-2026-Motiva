#pragma once

// =============================================================================
// PAPEL DESTE NÓ
// =============================================================================
// true  -> nó proxy: nunca dorme, fala com o broker MQTT e faz de gateway da mesh.
// false -> sensor comum: acorda, mede/repassa, volta a dormir.
#define IS_PROXY true

// ID único deste nó dentro da mesh. Cada placa física precisa de um valor
// diferente. O(s) proxy(s) DEVEM usar NODE_ID = 0 (mesmo valor de
// MESH_PROXY_NODE_ID, lá embaixo) — sensores comuns usam 1, 2, 3...
// TODO: definir um valor diferente em cada placa antes de gravar.
#define NODE_ID 0

// =============================================================================
// LoRa (SX1262 via RadioLib)
// =============================================================================
// Prefixados com LORA_ de propósito: nomes "soltos" como SCK/MISO/MOSI/BUSY já
// são usados internamente pelo core do ESP32 (pins_arduino.h, ets_sys.h etc) —
// ver o erro de compilação que isso causou quando o projeto virou multi-arquivo.
#define LORA_SCK  18
#define LORA_MISO 19
#define LORA_MOSI 23
#define LORA_NSS  5
#define LORA_NRST 13
#define LORA_DIO1 35
#define LORA_BUSY 14
#define LORA_RXEN 15
#define LORA_TXEN 2
#define RADIO_FREQUENCY 915.0 // 915MHz

// =============================================================================
// VL53L1X-TOF400C
// =============================================================================
// VL53L1X::Long   | Claro: 73cm  | Escuro: 360cm
// VL53L1X::Medium | Claro: 76cm  | Escuro: 290cm
// VL53L1X::Short  | Claro: 135cm | Escuro: 136cm
#define MEASUREMENT_DISTANCE_MODE VL53L1X::Short

// Orçamentos válidos p/ VL53L1X ficam em torno de 20/33/50/100/140/200ms.
// 140ms é o mais conservador (máxima precisão/estabilidade).
#define TIMING_BUDGET_MS 140

#define TOF_SDA 21
#define TOF_SCL 22

// Alcance máximo confiável para o modo escolhido acima (ver tabela).
// Leituras iguais ou acima disso são tratadas como "fora de alcance".
#define MAX_SENSOR_RANGE_MM 1350

// Limite mínimo de sinal confiável (MCPS)
#define MIN_SIGNAL_RATE 0.25f

// Desvio-padrão máximo (mm) que o próprio chip estima para a leitura
// (RESULT__SIGMA_SD0). É o melhor indicador de "essa distância é confiável?":
// quando o alvo está ALÉM do alcance, o VL53L1X ainda devolve um número curto
// qualquer (o eco volta ambíguo/dobrado), mas o sigma explode. Comparar a
// distância com MAX_SENSOR_RANGE_MM NÃO pega esse caso, porque o número
// aliasado é PEQUENO — é exatamente por isso que apontar pro teto "devolvia
// 50mm" em vez de "fora de alcance".
#define MAX_SIGMA_MM 20.0f

// =============================================================================
// ULN2003 / 28BYJ-48
// =============================================================================
#define MOTOR_PIN1 26
#define MOTOR_PIN2 25
#define MOTOR_PIN3 33
#define MOTOR_PIN4 32
#define STEP_POWER_PIN 27

// --- Calibração ---
#define CALIBRATION_STEP_INCREMENT 4       // passos por leitura durante a busca de borda
#define CALIBRATION_JUMP_THRESHOLD_MM 200  // salto mínimo (mm) entre leituras consecutivas VÁLIDAS p/ considerar "borda" (reforço; na prática a aproximação real nunca deu salto)
#define CALIBRATION_WALL_SIGNAL_THRESHOLD_MCPS 12.0f // piso mínimo de sinal absoluto — evita disparar em ruído bem baixo mesmo com pouco ambiente. AJUSTAR com dados reais.
#define CALIBRATION_WALL_SIGNAL_TO_AMBIENT_RATIO 2.0f // sinal precisa ser pelo menos isso vezes maior que o ambiente no MESMO instante — o que realmente separa "reflexo de verdade" de "muito IR ambiente" (sol), já que os dois escalam juntos sob sol forte. AJUSTAR com dados reais, inclusive testando sob sol direto.
#define CALIBRATION_WALL_STREAK_LIMIT 4    // leituras SEGUIDAS passando nos dois critérios acima pra confirmar borda
#define CALIBRATION_WALL_MAX_DISTANCE_MM 250 // parede só conta como borda se estiver PERTO. Sem isso, sinal forte vindo de longe (ou de fora de alcance, com distância aliasada) passava por parede.

// Antes de poder declarar uma borda, a busca precisa ver este tanto de
// leituras SEGUIDAS sem parede — ou seja, precisa comprovadamente SAIR de
// cima da parede anterior. Sem isso, a busca da borda direita começa colada
// na borda esquerda recém-encontrada e "acha" a direita nos primeiros passos,
// produzindo uma janela de ~16 passos.
#define CALIBRATION_OPEN_STREAK_TO_ARM 3

// Segunda trava contra o mesmo problema: nenhuma borda é aceita antes de
// andar pelo menos isto. Em HALF4WIRE o 28BYJ-48 dá 4096 passos por volta,
// então 4 passos ≈ 0,35° — um streak de 4 leituras cobre ~1,4°, ou seja,
// praticamente o mesmo ponto físico. 64 passos ≈ 5,6°.
#define CALIBRATION_MIN_EDGE_SEPARATION_STEPS 64

// Recuo aplicado às duas bordas para formar a janela ÚTIL de medição. A
// varredura não deve começar nem terminar encostada na parede: ali o alvo
// fica abaixo do alcance mínimo do VL53L1X (~40mm) e a leitura vira 0/1mm.
#define CALIBRATION_EDGE_MARGIN_STEPS 24

#define CALIBRATION_SAFETY_MAX_STEPS 4096  // teto de giro p/ busca à DIREITA (mais folga de cabo)
#define CALIBRATION_LEFT_SAFETY_MAX_STEPS 1800 // teto de giro p/ busca à ESQUERDA. AJUSTE conforme a folga real do seu cabo.
#define CALIBRATION_SETTLE_DELAY_MS 5

// Janela útil menor que isso é tratada como calibração inválida — sinal de
// que as duas "bordas" encontradas são, na verdade, a mesma parede.
#define CALIBRATION_MIN_WINDOW_STEPS 128

// Imprime CADA leitura da calibração no Serial (passo, distância, sinal,
// ambiente, status bruto do VL53L1X, se foi considerada borda). Deixa
// ligado (1) enquanto estiver ajustando os limiares acima; desliga (0) depois.
#define DEBUG_CALIBRATION 1

// O mesmo, na varredura de medição. Sem isso não dá pra saber POR QUE cada
// amostra foi aceita ou descartada.
#define DEBUG_MEASUREMENT 1

// --- Medição ---
#define MEASUREMENT_STEP_INCREMENT 4
#define MEASUREMENT_SETTLE_DELAY_MS 5      // mesmo settle da calibração: ler logo depois de parar o motor pega vibração
#define VARIANCE_THRESHOLD 400.0f          // AJUSTAR EMPIRICAMENTE
#define MIN_VALID_SAMPLE_RATIO 0.5f
#define MAX_SAMPLES_PER_WINDOW 256

// =============================================================================
// Núcleos da ESP32
// =============================================================================
// A ESP32 só tem 2 núcleos de verdade: 0 e 1. "Núcleo 1" e "núcleo 2" do pedido
// original viram, em código, CORE_LORA e CORE_MAIN abaixo — deixo nomeado em
// vez de número pra não haver ambiguidade.
#define CORE_LORA 1  // LoRa: RX contínuo, decide relay, nunca deve travar
#define CORE_MAIN 0  // tudo mais: sensor, motor, MQTT, portal WiFi

// =============================================================================
// Protocolo de mesh (feito na mão, sem TTL — ver mesh_protocol.h)
// =============================================================================
#define MESH_BROADCAST_ADDR 0xFFFF
#define MESH_PROXY_NODE_ID 0
#define MESH_DEDUP_CACHE_SIZE 32   // quantos messageId recentes cada nó lembra (ring buffer)
#define MESH_MAX_PAYLOAD_BYTES 8

// =============================================================================
// Deep sleep (sensores comuns)
// =============================================================================
#define DEEP_SLEEP_INTERVAL_US (30ULL * 60ULL * 1000000ULL) // acorda a cada 30min p/ medir (ajustar)

// =============================================================================
// MQTT (somente proxy) — Mosquitto no Railway
// =============================================================================
// TODO: preencher com o host:porta reais do TCP Proxy do Railway
// (Settings -> Networking -> TCP Proxy no serviço do Mosquitto).
// O domínio "*.up.railway.app" NÃO serve pra isso — só HTTP/HTTPS.
#define MQTT_HOST "hayabusa.proxy.rlwy.net"
#define MQTT_PORT 43419 // TODO: porta do TCP Proxy (ex.: 15140)

// allow_anonymous = true confirmado -> sem usuário/senha
#define MQTT_USE_AUTH false
#define MQTT_USER ""
#define MQTT_PASSWORD ""

#define MQTT_TOPIC_COMMAND "grama/comando"   // broker -> proxy
#define MQTT_TOPIC_RESULT  "grama/resultado" // proxy -> broker

// =============================================================================
// WiFi (somente proxy)
// =============================================================================
#define WIFI_CONNECT_TIMEOUT_MS 15000
#define WIFI_PORTAL_SSID "SensorGrama-Config"
#define WIFI_PORTAL_PASSWORD "configure123" // mínimo 8 caracteres p/ WPA2
