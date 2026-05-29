# Firmware NodeMCU ESP8266 — Design Spec
**Data:** 2026-05-29  
**Projeto:** Casa Inteligente TCC  
**Status:** Aprovado

---

## Visão Geral

Firmware único para NodeMCU ESP8266 que sincroniza estado de dispositivos com o backend a cada 2 segundos via HTTP POST. Toda configuração fica em um bloco no topo do arquivo `.ino` para facilitar edição sem precisar entender o resto do código.

---

## Seção 1 — Arquitetura

Arquivo único `.ino` dividido em blocos bem delimitados:

```
[ CONFIGURAÇÕES ]          ← único lugar que o usuário precisa editar
[ BIBLIOTECAS + GLOBAIS ]
[ setup() ]                ← conecta WiFi, inicializa pinos e sensores
[ loop() ]                 ← ciclo de 2s: lê sensores → monta JSON → POST → aplica comandos
[ connectWiFi() ]
[ readSensors() ]
[ syncWithBackend() ]
[ applyCommand() ]
```

**Bibliotecas:**
- `ESP8266WiFi`
- `ESP8266HTTPClient`
- `ArduinoJson`
- `DHT sensor library` (Adafruit)

---

## Seção 2 — Mapeamento de Pinos e Bloco de Configuração

### Pinos

| Pino NodeMCU | GPIO | Dispositivo        |
|---|---|---|
| D1 | GPIO 5  | DHT11 (temperatura) |
| D2 | GPIO 4  | PIR (presença)      |
| D5 | GPIO 14 | Relé → Luz          |
| D6 | GPIO 12 | Relé → Ventilador   |
| D7 | GPIO 13 | Relé → Portão       |
| D8 | GPIO 15 | Relé → Alarme       |

**Evitados:** D0, D3, D4 — comportamentos especiais no boot.

### Bloco de Configuração (topo do .ino)

```cpp
// ─── EDITE AQUI ────────────────────────────────────────────
const char* WIFI_SSID     = "NomeDoWiFi";
const char* WIFI_PASSWORD = "SenhaDaRede";
const char* BACKEND_URL   = "https://casa-inteligente-tcc-production.up.railway.app/arduino/sync";
const char* UID           = "uid-do-usuario-firebase";
const char* TOKEN         = "seu-arduino-secret";

const int   SYNC_INTERVAL         = 2000;  // ms entre cada sync
const int   WIFI_TIMEOUT_ATTEMPTS = 20;    // tentativas no boot (~10s)
const unsigned long PIR_COOLDOWN_MS = 10000; // ms entre eventos de presença
const int   DEFAULT_TEMP_THRESHOLD = 30;   // °C (substituído pelo backend)

#define RELAY_ON  LOW   // mude para HIGH se seu módulo for ativo em HIGH
#define RELAY_OFF HIGH

// Mapa de dispositivos: nome (string) → pino
// Para adicionar/remover um dispositivo, edite apenas aqui
const int PIN_RELE_LUZ        = 14;
const int PIN_RELE_VENTILADOR = 12;
const int PIN_RELE_PORTAO     = 13;
const int PIN_RELE_ALARME     = 15;
const int PIN_PIR             =  4;
const int PIN_DHT             =  5;
// ────────────────────────────────────────────────────────────
```

---

## Seção 3 — WiFi: Conexão e Reconexão

### Boot (`setup()`)

`connectWiFi()` tenta conectar e aguarda até `WIFI_TIMEOUT_ATTEMPTS` × 500ms (~10s). Se não conseguir, parte sem WiFi — os relés mantêm o último estado conhecido.

```
connectWiFi():
  WiFi.begin(SSID, PASSWORD)
  tentativas = 0
  enquanto WiFi != CONNECTED e tentativas < WIFI_TIMEOUT_ATTEMPTS:
    delay(500)
    tentativas++
  loga resultado (conectado ou offline)
```

### Runtime (`loop()`)

Verificação leve a cada ciclo, sem bloquear:

```
se WiFi.status() != CONNECTED:
  WiFi.reconnect()
  delay(500)
  retorna  ← pula o sync desse ciclo, tenta no próximo
```

Quando o WiFi voltar, o sync retoma automaticamente.

---

## Seção 4 — Leitura de Sensores e Debouncing

### DHT11 (temperatura)

```
readSensors():
  float temp = dht.readTemperature()
  se !isnan(temp):
    currentTemp = temp
  se currentTemp > tempThreshold:
    adiciona "temperatura" em events[]
```

Sem debounce necessário — temperatura muda lentamente.

### PIR (presença) — com cooldown

O PIR oscila enquanto detecta movimento. Sem cooldown geraria dezenas de eventos por minuto.

```
se digitalRead(PIN_PIR) == HIGH:
  agora = millis()
  se agora - ultimaPresenca > PIR_COOLDOWN_MS:
    adiciona "presenca" em events[]
    ultimaPresenca = agora
```

`PIR_COOLDOWN_MS` é configurável no bloco do topo.

### Array `events[]`

Montado a cada ciclo, enviado no POST, zerado após o sync:

```cpp
String events[4];
int eventCount = 0;
```

---

## Seção 5 — Sync HTTP e Aplicação de Comandos

### `syncWithBackend()`

```
monta JsonDocument:
  uid, token, online=true, temperature=currentTemp
  devices: { luz, ventilador, portao, alarme } → estados locais
  events: array events[]

POST BACKEND_URL com Content-Type: application/json

parse response:
  tempThreshold = doc["tempThreshold"] | DEFAULT_TEMP_THRESHOLD
  para cada command em doc["commands"]:
    applyCommand(command["device"], command["state"])

zera events[]
```

### `applyCommand(device, state)`

Usa mapa de strings para pinos — adicionar dispositivo é uma linha:

```cpp
struct DevicePin { const char* name; int pin; bool* stateVar; };

DevicePin devices[] = {
  { "luz",        PIN_RELE_LUZ,        &estadoLuz        },
  { "ventilador", PIN_RELE_VENTILADOR, &estadoVentilador },
  { "portao",     PIN_RELE_PORTAO,     &estadoPortao     },
  { "alarme",     PIN_RELE_ALARME,     &estadoAlarme     },
};

para cada d em devices:
  se d.name == device:
    digitalWrite(d.pin, state ? RELAY_ON : RELAY_OFF)
    *d.stateVar = state
    break
```

---

## Seção 6 — Ajuste no Backend

### O que muda

`POST /arduino/sync` passa a retornar `tempThreshold` no response:

```js
// antes
return { commands: [...] }

// depois
return { commands: [...], tempThreshold: threshold }
```

### De onde vem o valor

Firestore: documento `users/{uid}` → campo `tempThreshold`.  
Usa o mesmo documento de usuário já existente — sem criar subcoleção nova.  
Se o campo não existir → usa `DEFAULT_TEMP_THRESHOLD = 30` (°C).

```js
const DEFAULT_TEMP_THRESHOLD = 30;

const userDoc = await db.collection('users').doc(uid).get();
const threshold = userDoc.exists
  ? (userDoc.data().tempThreshold ?? DEFAULT_TEMP_THRESHOLD)
  : DEFAULT_TEMP_THRESHOLD;
```

**Arquivo a editar:** `backend/services/arduino.js` (ou handler da rota `/arduino/sync`).

---

## Resumo de Constantes Configuráveis

| Constante | Default | Descrição |
|---|---|---|
| `WIFI_SSID` / `WIFI_PASSWORD` | — | Credenciais da rede |
| `BACKEND_URL` | URL Railway | Endpoint de sync |
| `UID` / `TOKEN` | — | Autenticação |
| `SYNC_INTERVAL` | 2000ms | Frequência de sync |
| `WIFI_TIMEOUT_ATTEMPTS` | 20 | Tentativas no boot |
| `PIR_COOLDOWN_MS` | 10000ms | Intervalo entre eventos de presença |
| `DEFAULT_TEMP_THRESHOLD` | 30°C | Limite de temperatura (fallback) |
| `RELAY_ON` / `RELAY_OFF` | LOW / HIGH | Polaridade do módulo de relé |

---

## Funcionalidades fora do escopo desta versão

- **Gatilho por horário (`horario`):** O frontend permite criar automações de horário e o backend aceita o trigger, mas nenhuma parte do sistema gera esse evento automaticamente. Não há scheduler no backend nem lógica de horário no firmware. Automações de horário criadas no site não dispararão nesta versão.

---

## Dependências Externas

- Backend Railway já deployado: `https://casa-inteligente-tcc-production.up.railway.app`
- Variável `ARDUINO_SECRET` já configurada no Railway
- Hardware ainda não comprado — firmware escrito antes para validar a lógica
