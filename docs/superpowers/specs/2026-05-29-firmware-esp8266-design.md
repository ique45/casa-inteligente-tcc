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

### DHT11 (temperatura) — edge-triggered com histerese

```
readSensors():
  float temp = dht.readTemperature()
  se !isnan(temp):
    currentTemp = temp

  se currentTemp > tempThreshold:
    se !tempAcimaLimite:
      tempAcimaLimite = true
      adiciona "temperatura" em events[]   (se ainda não pendente)
  senão se currentTemp < tempThreshold - TEMP_HISTERESE:
    tempAcimaLimite = false
```

O evento dispara apenas na **transição** de abaixo para acima do limite
(edge-triggered), não em todo ciclo em que a temperatura está acima dele.
Sem isso, uma automação de "Alternar" ligada a esse gatilho ligaria e
desligaria o relé a cada 2s enquanto a temperatura permanecesse alta.

O re-armamento (`tempAcimaLimite = false`) só ocorre quando a temperatura
cai abaixo de `tempThreshold - TEMP_HISTERESE`, não simplesmente abaixo de
`tempThreshold`. Isso evita "flapping" do evento quando a leitura oscila
poucos décimos de grau em torno do limite. `tempThreshold` pode ser
alterado em tempo real pelo backend; a lógica usa sempre o valor atual, de
modo que um novo limite passa a valer no ciclo seguinte sem estado extra.

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

```cpp
String events[4];
int eventCount = 0;
```

`eventCount` **não** é zerado no início de `readSensors()`. Ele só é
zerado dentro de `syncWithBackend()`, e somente depois de uma confirmação
real do backend (HTTP 200 e corpo JSON parseado sem erro). Isso garante
que um evento gerado num ciclo, mas perdido por falha de rede ou erro
HTTP, permaneça no buffer e seja reenviado no próximo ciclo em vez de
simplesmente desaparecer.

Antes de inserir um novo evento no buffer, `readSensors()` verifica se
aquele mesmo tipo já está pendente (função `eventoJaPendente`) — isso
evita duplicar o mesmo evento enquanto um sync anterior ainda não foi
confirmado, e mantém a escrita sempre dentro dos limites do array.

---

## Seção 5 — Sync HTTP e Aplicação de Comandos

### `syncWithBackend()`

```
usa o WiFiClientSecure global (secureClient), configurado com
setInsecure() uma única vez em setup() — não recriado a cada ciclo
http.begin(secureClient, BACKEND_URL)
http.setReuse(true)   ← mantém a conexão TLS/TCP viva entre ciclos

monta JsonDocument:
  uid, token, online=true, temperature=currentTemp
  devices: { luz, ventilador, portao, alarme } → estados locais
  events: array events[]

POST BACKEND_URL com Content-Type: application/json

se status == 200:
  parse response
  se parse OK:
    tempThreshold = doc["tempThreshold"] | DEFAULT_TEMP_THRESHOLD
    para cada command em doc["commands"]:
      applyCommand(command["device"], command["state"])
    zera events[]        ← só aqui, sync confirmado com sucesso
  senão:
    mantém events[] (resposta corrompida, não há confirmação)
senão:
  mantém events[] (erro HTTP, tenta de novo no próximo ciclo)
```

`secureClient` é uma instância global de `WiFiClientSecure`, criada uma
única vez, não uma variável local recriada a cada chamada. Um handshake
BearSSL completo custa ~20-30KB de RAM de pico e 1-4s no ESP8266;
recriando o cliente a cada 2s essa cadência de sync seria inviável na
prática. `setBufferSizes()` **não** é usado para reduzir esse consumo —
isso arriscaria quebrar o handshake com servidores que enviam registros
TLS grandes, e não há hardware disponível para validar esse cenário.

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

O firmware envia `temperature` em todo sync. O backend grava esse valor em
`arduino_status/{uid}` (mesmo caminho do RTDB onde já grava `online` e
`lastSeen`), junto com o update existente — não cria um caminho novo nem
um documento novo no Firestore. Só grava o campo se o valor recebido for
um número finito (`typeof === 'number' && Number.isFinite(...)`); se
estiver ausente ou inválido, o campo `temperature` simplesmente não é
escrito naquele update (nunca grava `null` nem `0` como se fosse uma
leitura real).

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
| `TEMP_HISTERESE` | 1.0°C | Faixa de re-armamento do evento de temperatura (ve Seção 4) |
| `RELAY_ON` / `RELAY_OFF` | LOW / HIGH | Polaridade do módulo de relé |

---

## Funcionalidades fora do escopo desta versão

- **Gatilho por horário (`horario`):** O frontend permite criar automações de horário e o backend aceita o trigger, mas nenhuma parte do sistema gera esse evento automaticamente. Não há scheduler no backend nem lógica de horário no firmware. Automações de horário criadas no site não dispararão nesta versão.

---

## Dependências Externas

- Backend Railway já deployado: `https://casa-inteligente-tcc-production.up.railway.app`
- Variável `ARDUINO_SECRET` já configurada no Railway
- Hardware ainda não comprado — firmware escrito antes para validar a lógica

---

## Correções pós-revisão (2026-08-12)

Um code review sobre a implementação da Task 3 encontrou quatro defeitos
de **design** (não de transcrição). Os quatro foram corrigidos:

1. **`temperature` era enviado mas nunca persistido.** O backend agora
   grava `temperature` em `arduino_status/{uid}` (reaproveitando o update
   já existente ali), validando que o valor é um número finito antes de
   escrever. Ausente ou inválido → campo não é escrito. Ver Seção 6.

2. **Evento `"temperatura"` era level-triggered, causando chattering no
   relé.** Automações de "Alternar" ligadas a esse gatilho ligavam e
   desligavam o relé a cada 2s enquanto a temperatura ficasse acima do
   limite. Agora o evento é edge-triggered com histerese
   (`TEMP_HISTERESE = 1.0°C`): dispara só na transição de abaixo para
   acima do limite, e só re-arma quando a temperatura cai abaixo de
   `tempThreshold - TEMP_HISTERESE`. Ver Seção 4.

3. **Syncs com falha descartavam eventos silenciosamente, e a presença
   ainda consumia o cooldown.** `eventCount` era zerado no início de todo
   ciclo, então um evento gerado mas não confirmado pelo backend era
   perdido. Agora `eventCount` só é zerado dentro de `syncWithBackend()`,
   e somente após uma confirmação real (HTTP 200 + JSON válido). Um guard
   (`eventoJaPendente`) evita duplicar o mesmo tipo de evento no buffer.
   Ver Seções 4 e 5.

4. **`WiFiClientSecure` era recriado a cada ciclo de 2s**, forçando um
   handshake TLS completo (~20-30KB de RAM de pico, 1-4s) a cada sync —
   inviabilizando a cadência pretendida. Agora `secureClient` é uma
   instância global de longa duração, com `setInsecure()` chamado uma
   única vez em `setup()` e `http.setReuse(true)` para manter a conexão
   viva entre ciclos. `setBufferSizes()` deliberadamente não é usado. Ver
   Seção 5.

5. **`currentTemp` era inicializado em `0.0` e enviado em todo sync, mesmo
   sem uma leitura válida do DHT11.** Um sensor ausente, mal conectado ou
   que ainda não tivesse produzido uma leitura válida fazia o firmware
   postar `temperature: 0`, e o backend gravava isso como se fosse uma
   leitura real — contradizendo a garantia de `backend/routes/arduino.js`
   de nunca persistir 0/null como leitura de sensor. Agora existe uma flag
   global `tempValida` (inicia `false`), que só vira `true` junto com
   `currentTemp` quando `dht.readTemperature()` retorna um valor não-NaN;
   o campo `"temperature"` só é adicionado ao JSON do sync quando
   `tempValida` é `true`. Ver Seção 5.
