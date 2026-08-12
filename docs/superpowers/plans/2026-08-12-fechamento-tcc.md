# Fechamento do TCC para Apresentação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o projeto Casa Inteligente seguro, documentado e apresentável para avaliação presencial por um professor, sem hardware disponível.

**Architecture:** Seis tarefas independentes sobre um projeto já funcional. Nenhuma altera a lógica de negócio: são higiene de repositório, um firmware novo (não executável nesta etapa), um ajuste de copy/CSS no dashboard, um link entre o site institucional e o app, e um README. O backend não é tocado.

**Tech Stack:** HTML/CSS/JS puro (frontend), Node.js + Express (backend, já deployado no Railway), Firebase (Auth + Firestore + RTDB), C++/Arduino (firmware ESP8266).

## Global Constraints

- **Idioma:** todo texto voltado ao usuário, comentário de código e mensagem de commit em português do Brasil.
- **Não alterar `backend/`.** Está deployado e com 15 testes passando. A Seção 6 do spec do firmware (retornar `tempThreshold`) **já foi implementada** no commit `9d07b87` — ver `backend/routes/arduino.js:85`. Não reimplementar.
- **Não alterar a lógica do frontend.** Nenhum arquivo em `js/` é modificado. As únicas mudanças permitidas em arquivos existentes são: a copy e o CSS do aviso de offline em `dashboard.html` (Task 4), e os links novos em `index.html` mais a classe `.nav-cta` em `styles.css` (Task 5).
- **Não remover `firmware/arduino/`.** Decisão explícita do usuário.
- **Acessibilidade:** o público-alvo são idosos e pessoas com baixa visão. Todo texto novo mantém alto contraste sobre o fundo `--bg` (#050510).
- **Backend em produção:** `https://casa-inteligente-tcc-production.up.railway.app`
- **Nunca commitar** `backend/.env` nem qualquer arquivo `*firebase-adminsdk*.json`.
- Ao final de cada task: commit. Mensagens sem acentos (o terminal Windows do usuário corrompe acentuação em `git commit -m`).

## Estrutura de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `.gitignore` | Bloquear credenciais, artefatos e screenshots da raiz | 1 |
| `docs/screenshots/` | Destino dos 24 PNGs da raiz | 1 |
| `server.js` (raiz) | Servidor estático local para a demo (Firebase Auth não roda em `file://`) | 2 |
| `firmware/esp8266/casa_inteligente.ino` | Firmware do NodeMCU: sensores, sync HTTP, relés | 3 |
| `dashboard.html` | Copy + CSS do aviso de hardware ausente | 4 |
| `index.html` | Links do site institucional para o app | 5 |
| `styles.css` | Estilo do botão de acesso na navbar | 5 |
| `README.md` | Porta de entrada do repositório | 6 |

---

### Task 1: Segurança e higiene do repositório

**Files:**
- Modify: `.gitignore`
- Create: `docs/screenshots/` (move de 24 PNGs da raiz)
- Commit (já existem, não versionados): `backend/package-lock.json`, `docs/superpowers/plans/2026-05-27-backend-railway.md`

**Interfaces:**
- Consumes: nada
- Produces: repositório limpo. Task 6 referencia `docs/screenshots/` no README.

- [ ] **Step 1: Confirmar que a credencial nunca foi commitada**

```bash
git log --all --oneline --name-only | grep -i "adminsdk\|serviceaccount"
```

Esperado: nenhuma saída. Se **houver** saída, PARE e avise o usuário — a chave vazou no histórico e precisa ser rotacionada no console do Firebase antes de qualquer outra coisa.

- [ ] **Step 2: Atualizar o `.gitignore`**

Conteúdo final completo do arquivo:

```gitignore
node_modules/
backend/.env
.superpowers/
*.docx
*.pdf

# Credenciais — nunca versionar
*firebase-adminsdk*.json
serviceAccountKey.json

# Artefatos de ferramentas
.playwright-mcp/

# Screenshots soltos na raiz (os versionados ficam em docs/screenshots/)
/*.png
```

- [ ] **Step 3: Verificar que a credencial passou a ser ignorada**

```bash
git check-ignore -v casa-inteligente-tcc-firebase-adminsdk-fbsvc-497f47e765.json
```

Esperado: uma linha citando `.gitignore` e o padrão `*firebase-adminsdk*.json`. Se sair vazio, a regra não pegou.

- [ ] **Step 4: Mover os screenshots para `docs/screenshots/`**

```bash
mkdir -p docs/screenshots
mv screenshot-*.png mobile-*.png verify-topbar-loading.png docs/screenshots/
```

- [ ] **Step 5: Confirmar que a raiz ficou limpa e que os PNGs movidos são rastreáveis**

```bash
ls *.png 2>/dev/null || echo "raiz limpa"
git status --short docs/screenshots/ | head -5
```

Esperado: "raiz limpa", e os arquivos em `docs/screenshots/` aparecendo como `??` (não ignorados — a regra `/*.png` vale só para a raiz).

- [ ] **Step 6: Commit**

```bash
git add .gitignore docs/screenshots/ backend/package-lock.json docs/superpowers/plans/2026-05-27-backend-railway.md
git commit -m "chore: protege credenciais e organiza arquivos da raiz

Ignora chaves do Firebase Admin SDK e artefatos de ferramentas.
Move 24 screenshots para docs/screenshots/.
Versiona package-lock.json e o plano do backend Railway."
```

- [ ] **Step 7: Confirmar que nenhuma credencial ficou rastreada**

```bash
git ls-files | grep -i "adminsdk\|\.env$" || echo "nenhuma credencial rastreada"
```

Esperado: "nenhuma credencial rastreada".

---

### Task 2: Versionar o servidor de demo

**Files:**
- Modify: `server.js` (raiz — existe, não versionado)

**Interfaces:**
- Consumes: nada
- Produces: comando `node server.js` servindo em `http://127.0.0.1:8080`. Task 6 documenta isso no README.

**Contexto:** o Firebase Auth não funciona sob o protocolo `file://` — abrir `login.html` com duplo clique quebra o login. Este servidor é o que torna a demo possível. Ele já contém um modo de preview (`?preview=1`) que mocka o Firebase, usado em testes visuais; isso não atrapalha o uso normal.

- [ ] **Step 1: Subir o servidor**

```bash
node server.js
```

Esperado: `Serving at http://127.0.0.1:8080`

- [ ] **Step 2: Verificar que as páginas são servidas**

Em outro terminal:

```bash
curl -s -o /dev/null -w "%{http_code} " http://127.0.0.1:8080/index.html http://127.0.0.1:8080/login.html http://127.0.0.1:8080/css/app.css
```

Esperado: `200 200 200`

- [ ] **Step 3: Verificar o login no navegador**

Abrir `http://127.0.0.1:8080/login.html`, abrir o console do navegador (F12) e confirmar que **não** há erro de inicialização do Firebase. Fazer login com uma conta real e confirmar o redirecionamento para `profile.html` ou `dashboard.html`.

Se o login falhar, verificar em `js/firebase-config.js` se o domínio `127.0.0.1` está autorizado no console do Firebase (Authentication → Settings → Authorized domains). `localhost` costuma vir liberado por padrão; se `127.0.0.1` não estiver, usar `http://localhost:8080` na demo.

- [ ] **Step 4: Parar o servidor e commitar**

```bash
git add server.js
git commit -m "chore: versiona servidor estatico local para a demo

Firebase Auth nao funciona em file://, entao a apresentacao
precisa deste servidor. Sobe em http://127.0.0.1:8080."
```

---

### Task 3: Firmware ESP8266

**Files:**
- Create: `firmware/esp8266/casa_inteligente.ino`

**Interfaces:**
- Consumes: contrato do endpoint `POST /arduino/sync` (`backend/routes/arduino.js:13-91`)
- Produces: nada consumido por outras tasks. Task 6 referencia o caminho no README.

**Contexto:** implementa o spec `docs/superpowers/specs/2026-05-29-firmware-esp8266-design.md`, seções 1 a 5. A Seção 6 já está feita no backend. Não há hardware para testar — o critério é conformidade com o spec e clareza de leitura, porque este código será **lido** pelo professor, não executado.

**Detalhe não coberto pelo spec:** o `BACKEND_URL` é HTTPS. O `ESP8266HTTPClient` não aceita uma URL `https://` sem um `WiFiClientSecure`. Como o ESP8266 não tem os certificados raiz do Railway armazenados, usa-se `client.setInsecure()` — aceitável para um TCC, e comentado como tal no código.

- [ ] **Step 1: Criar o arquivo do firmware**

Criar `firmware/esp8266/casa_inteligente.ino` com exatamente este conteúdo:

```cpp
/*
 * ============================================================
 *  CASA INTELIGENTE - Firmware NodeMCU ESP8266
 *  TCC - 3 AMS Desenvolvimento de Sistemas
 * ============================================================
 *
 *  O que este programa faz, a cada 2 segundos:
 *    1. Le a temperatura (DHT11) e a presenca (sensor PIR)
 *    2. Envia esses dados e o estado atual dos reles para o backend
 *    3. Recebe do backend a lista de comandos a executar
 *    4. Liga ou desliga os reles conforme os comandos
 *
 *  Backend: https://casa-inteligente-tcc-production.up.railway.app
 *
 *  Bibliotecas necessarias (Gerenciador de Bibliotecas da IDE Arduino):
 *    - ArduinoJson           (Benoit Blanchon)   v7.x
 *    - DHT sensor library    (Adafruit)
 *    - Adafruit Unified Sensor  (dependencia da anterior)
 *  As bibliotecas ESP8266WiFi, ESP8266HTTPClient e WiFiClientSecure
 *  ja vem com o pacote de placas ESP8266.
 * ============================================================
 */

#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ─── EDITE AQUI ──────────────────────────────────────────────
const char* WIFI_SSID     = "NomeDaSuaRede";
const char* WIFI_PASSWORD = "SenhaDaSuaRede";
const char* BACKEND_URL   = "https://casa-inteligente-tcc-production.up.railway.app/arduino/sync";
const char* UID           = "cole-aqui-o-uid-do-firebase";
const char* TOKEN         = "cole-aqui-o-mesmo-valor-de-ARDUINO_SECRET";
// ─────────────────────────────────────────────────────────────

// Pinos (numeracao GPIO, nao a numeracao "D" impressa na placa)
#define PIN_DHT              5   // D1
#define PIN_PIR              4   // D2
#define PIN_RELE_LUZ        14   // D5
#define PIN_RELE_VENTILADOR 12   // D6
#define PIN_RELE_PORTAO     13   // D7
#define PIN_RELE_ALARME     15   // D8

// Polaridade do modulo de rele.
// A maioria dos modulos vendidos no Brasil e "ativo em LOW":
// o rele LIGA quando o pino vai para LOW. Se o seu funcionar
// ao contrario, basta inverter estes dois valores.
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// Constantes de comportamento
const unsigned long SYNC_INTERVAL          = 2000;   // ms entre cada sync
const int           WIFI_TIMEOUT_ATTEMPTS  = 20;     // 20 x 500ms = ~10s
const unsigned long PIR_COOLDOWN_MS        = 10000;  // 10s entre eventos de presenca
const float         DEFAULT_TEMP_THRESHOLD = 30.0;   // °C

// ─── Estado global ───────────────────────────────────────────
DHT dht(PIN_DHT, DHT11);

bool estadoLuz        = false;
bool estadoVentilador = false;
bool estadoPortao     = false;
bool estadoAlarme     = false;

float currentTemp    = 0.0;
float tempThreshold  = DEFAULT_TEMP_THRESHOLD;  // atualizado pelo backend

unsigned long ultimaPresenca = 0;
unsigned long ultimoSync     = 0;

String events[4];
int    eventCount = 0;

// Tabela que liga o nome vindo do backend ao pino e a variavel de estado.
// Para adicionar um dispositivo novo, basta acrescentar uma linha aqui.
struct DevicePin {
  const char* name;
  int         pin;
  bool*       stateVar;
};

DevicePin devicePins[] = {
  { "luz",        PIN_RELE_LUZ,        &estadoLuz        },
  { "ventilador", PIN_RELE_VENTILADOR, &estadoVentilador },
  { "portao",     PIN_RELE_PORTAO,     &estadoPortao     },
  { "alarme",     PIN_RELE_ALARME,     &estadoAlarme     },
};
const int DEVICE_COUNT = sizeof(devicePins) / sizeof(devicePins[0]);

// ─── WiFi ────────────────────────────────────────────────────

void connectWiFi() {
  Serial.print("Conectando ao WiFi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < WIFI_TIMEOUT_ATTEMPTS) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("Conectado. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("Sem WiFi. Os reles mantem o ultimo estado e o ESP segue tentando reconectar.");
  }
}

// ─── Sensores ────────────────────────────────────────────────

void readSensors() {
  eventCount = 0;

  // Temperatura. O DHT11 as vezes devolve NaN numa leitura isolada;
  // nesse caso mantemos o ultimo valor valido.
  float temp = dht.readTemperature();
  if (!isnan(temp)) {
    currentTemp = temp;
  }
  if (currentTemp > tempThreshold && eventCount < 4) {
    events[eventCount++] = "temperatura";
  }

  // Presenca. O PIR oscila enquanto ha movimento, entao aplicamos um
  // cooldown para nao enviar dezenas de eventos por minuto.
  if (digitalRead(PIN_PIR) == HIGH) {
    unsigned long agora = millis();
    if (agora - ultimaPresenca > PIR_COOLDOWN_MS && eventCount < 4) {
      events[eventCount++] = "presenca";
      ultimaPresenca = agora;
    }
  }
}

// ─── Aplicacao de comandos ───────────────────────────────────

void applyCommand(const char* device, bool state) {
  for (int i = 0; i < DEVICE_COUNT; i++) {
    if (strcmp(devicePins[i].name, device) == 0) {
      digitalWrite(devicePins[i].pin, state ? RELAY_ON : RELAY_OFF);
      *(devicePins[i].stateVar) = state;

      Serial.print("Comando aplicado: ");
      Serial.print(device);
      Serial.println(state ? " = LIGADO" : " = DESLIGADO");
      return;
    }
  }
  Serial.print("Comando ignorado, dispositivo desconhecido: ");
  Serial.println(device);
}

// ─── Sync com o backend ──────────────────────────────────────

void syncWithBackend() {
  WiFiClientSecure client;
  // O ESP8266 nao guarda os certificados raiz do Railway. Para o escopo
  // deste TCC aceitamos o certificado sem validar. Em producao real,
  // o correto seria fixar a impressao digital do certificado.
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, BACKEND_URL)) {
    Serial.println("Falha ao iniciar a conexao HTTP");
    return;
  }
  http.addHeader("Content-Type", "application/json");

  // Monta o corpo da requisicao
  JsonDocument doc;
  doc["uid"]         = UID;
  doc["token"]       = TOKEN;
  doc["online"]      = true;
  doc["temperature"] = currentTemp;

  JsonObject devices     = doc["devices"].to<JsonObject>();
  devices["luz"]         = estadoLuz;
  devices["ventilador"]  = estadoVentilador;
  devices["portao"]      = estadoPortao;
  devices["alarme"]      = estadoAlarme;

  JsonArray eventsArray = doc["events"].to<JsonArray>();
  for (int i = 0; i < eventCount; i++) {
    eventsArray.add(events[i]);
  }

  String body;
  serializeJson(doc, body);

  int status = http.POST(body);

  if (status == 200) {
    String payload = http.getString();

    JsonDocument resposta;
    DeserializationError erro = deserializeJson(resposta, payload);

    if (erro) {
      Serial.print("Resposta invalida do backend: ");
      Serial.println(erro.c_str());
    } else {
      // Atualiza o limite de temperatura definido pelo usuario no site
      tempThreshold = resposta["tempThreshold"] | DEFAULT_TEMP_THRESHOLD;

      // Executa os comandos enviados pelo site e pelas automacoes
      for (JsonObject cmd : resposta["commands"].as<JsonArray>()) {
        const char* device = cmd["device"];
        bool        state  = cmd["state"];
        if (device != nullptr) {
          applyCommand(device, state);
        }
      }
    }
  } else {
    Serial.print("Erro no sync. Codigo HTTP: ");
    Serial.println(status);
  }

  http.end();

  // Os eventos ja foram enviados; zera para o proximo ciclo.
  eventCount = 0;
}

// ─── setup / loop ────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("=== Casa Inteligente - iniciando ===");

  // Coloca os reles em estado desligado ANTES de configurar como saida,
  // para o modulo nao dar um pulso indesejado no boot.
  for (int i = 0; i < DEVICE_COUNT; i++) {
    digitalWrite(devicePins[i].pin, RELAY_OFF);
    pinMode(devicePins[i].pin, OUTPUT);
    digitalWrite(devicePins[i].pin, RELAY_OFF);
  }

  pinMode(PIN_PIR, INPUT);
  dht.begin();

  connectWiFi();
}

void loop() {
  // Se o WiFi caiu, tenta reconectar e pula este ciclo.
  // Os reles continuam no ultimo estado conhecido.
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi desconectado, tentando reconectar...");
    WiFi.reconnect();
    delay(500);
    return;
  }

  unsigned long agora = millis();
  if (agora - ultimoSync >= SYNC_INTERVAL) {
    ultimoSync = agora;
    readSensors();
    syncWithBackend();
  }
}
```

- [ ] **Step 2: Conferir o firmware contra o spec**

Reler `docs/superpowers/specs/2026-05-29-firmware-esp8266-design.md` e confirmar item a item:

- Pinos batem com a tabela da Seção 2 (DHT=5, PIR=4, luz=14, ventilador=12, portao=13, alarme=15)
- `connectWiFi()` usa `WIFI_TIMEOUT_ATTEMPTS` × 500ms e não trava se falhar (Seção 3)
- `loop()` detecta queda de WiFi e pula o ciclo sem bloquear (Seção 3)
- `readSensors()` protege contra `isnan` e aplica `PIR_COOLDOWN_MS` (Seção 4)
- O corpo do POST tem `uid`, `token`, `online`, `temperature`, `devices`, `events` (Seção 5)
- `applyCommand()` usa a tabela `DevicePin` e respeita `RELAY_ON`/`RELAY_OFF` (Seção 5)
- Todas as constantes da tabela "Resumo de Constantes Configuráveis" existem no arquivo

- [ ] **Step 3: Conferir o firmware contra o contrato real do backend**

Abrir `backend/routes/arduino.js` e confirmar:

- Os nomes em `VALID_DEVICES` (linha 7) são exatamente `luz`, `ventilador`, `portao`, `alarme` — iguais aos de `devicePins`
- Os nomes em `VALID_TRIGGERS` (linha 8) incluem `presenca` e `temperatura` — iguais aos strings colocados em `events[]`
- A resposta (linha 85) devolve `commands` e `tempThreshold` — os dois campos lidos pelo firmware

- [ ] **Step 4 (opcional): Compilar**

Só se o `arduino-cli` estiver instalado com o core do ESP8266. Não instalar nada só para isto — a task não depende disso.

```bash
arduino-cli compile --fqbn esp8266:esp8266:nodemcuv2 firmware/esp8266/casa_inteligente.ino
```

Se o `arduino-cli` não estiver disponível, pular e registrar no commit que o firmware não foi compilado.

- [ ] **Step 5: Commit**

```bash
git add firmware/esp8266/casa_inteligente.ino
git commit -m "feat: firmware NodeMCU ESP8266

Implementa as secoes 1-5 do spec de 2026-05-29: leitura de DHT11
e PIR com cooldown, sync HTTP a cada 2s com o backend e aplicacao
dos comandos nos reles.

Nao testado em hardware - o NodeMCU ainda nao foi comprado."
```

---

### Task 4: Ajustar o aviso de hardware ausente no dashboard

**Files:**
- Modify: `dashboard.html:28-33` (CSS de `.offline-hint`), `dashboard.html:81-83` (texto)

**Interfaces:**
- Consumes: nada
- Produces: nada

**Contexto:** hoje o aviso aparece em vermelho de erro. Como a demo roda sem hardware, ele fica visível o tempo todo e o professor lê aquilo como um bug do sistema. A informação continua a mesma; muda o tom. O indicador da sidebar continua vermelho — ele reflete um fato real e não deve ser mascarado.

- [ ] **Step 1: Trocar o CSS de `.offline-hint`**

Em `dashboard.html`, substituir o bloco das linhas 28-33:

```css
    .offline-hint {
      display: none; font-size: 13px; color: var(--danger);
      margin-bottom: 12px; padding: 10px 14px;
      background: rgba(239,68,68,0.08); border-radius: 8px;
      border-left: 3px solid var(--danger);
    }
```

por:

```css
    .offline-hint {
      display: none; font-size: 13px; color: var(--purple-light);
      margin-bottom: 12px; padding: 10px 14px;
      background: var(--purple-glow); border-radius: 8px;
      border-left: 3px solid var(--purple);
    }
```

`--purple-light` é `#a78bfa`. Sobre o fundo efetivo (o `--purple-glow` composto sobre `--bg` `#050510`) o contraste medido é ≈6,2:1 — acima do mínimo WCAG AA para texto corrido (4,5:1), abaixo do AAA (7:1). Atende ao requisito de alto contraste do projeto.

- [ ] **Step 2: Trocar o texto do aviso**

Substituir as linhas 81-83:

```html
      <p class="offline-hint" id="offline-hint">
        ⚠️ Arduino offline — o último estado definido aqui será aplicado assim que a conexão for restabelecida.
      </p>
```

por:

```html
      <p class="offline-hint" id="offline-hint">
        Hardware ainda não conectado — os comandos ficam salvos e serão aplicados quando o ESP8266 for integrado.
      </p>
```

- [ ] **Step 3: Verificar visualmente**

```bash
node server.js
```

Abrir `http://127.0.0.1:8080/dashboard.html`, logar e confirmar:
- O aviso aparece em roxo, não em vermelho
- O texto novo está correto e legível
- O status da sidebar continua vermelho (comportamento esperado, não mexer)

- [ ] **Step 4: Confirmar que nenhuma lógica foi tocada**

```bash
git diff --stat dashboard.html
```

Esperado: apenas `dashboard.html` alterado, com poucas linhas. Se `js/dashboard.js` aparecer no diff, algo saiu errado — reverter.

- [ ] **Step 5: Commit**

```bash
git add dashboard.html
git commit -m "style: aviso de hardware ausente em tom informativo

Trocado o vermelho de erro pelo roxo da paleta. A ausencia do
ESP8266 e um estado esperado nesta etapa, nao uma falha."
```

---

### Task 5: Ligar o site institucional ao sistema

**Files:**
- Modify: `index.html:12-26` (navbar), `index.html:47-50` (botões do hero)
- Modify: `styles.css` (nova classe `.nav-cta`; ajuste no media query da linha 741)

**Interfaces:**
- Consumes: nada
- Produces: caminho de navegação `index.html` → `login.html`. Task 6 descreve esse fluxo no README.

**Contexto:** o `index.html` é a página de apresentação do TCC e hoje não tem nenhum link para o sistema. Quem abre a apresentação não chega ao app.

- [ ] **Step 1: Adicionar o botão na navbar**

Em `index.html`, na navbar, inserir o link imediatamente **antes** de `<div class="nav-user">&#9711;</div>`:

```html
    <a href="login.html" class="nav-cta">ACESSAR O SISTEMA</a>
```

- [ ] **Step 2: Adicionar o CTA no hero**

Substituir o bloco `hero-buttons` (linhas 47-50):

```html
      <div class="hero-buttons">
        <a href="#projeto" class="btn-primary">Explorar Projeto</a>
        <a href="#referencia" class="btn-link">Referências</a>
      </div>
```

por:

```html
      <div class="hero-buttons">
        <a href="login.html" class="btn-primary">Acessar o Sistema</a>
        <a href="#projeto" class="btn-link">Explorar Projeto</a>
        <a href="#referencia" class="btn-link">Referências</a>
      </div>
```

Acessar o sistema vira a ação primária; "Explorar Projeto" continua disponível, como ação secundária. Não existem dois `btn-primary` na mesma área — a hierarquia visual continua clara.

- [ ] **Step 3: Estilizar `.nav-cta`**

Em `styles.css`, logo após o bloco `.nav-user:hover` (linha 110), acrescentar:

```css
.nav-cta {
  background: var(--purple);
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  padding: 0.55rem 1.1rem;
  border-radius: 8px;
  margin-right: 1rem;
  white-space: nowrap;
  transition: background 0.2s;
}
.nav-cta:hover { background: var(--purple-dark); }
```

- [ ] **Step 4: Garantir que o botão sobreviva no mobile**

A linha 741 do `styles.css` esconde `.nav-links` em telas pequenas. O `.nav-cta` **não** está nesse seletor, então continua visível — que é o comportamento desejado. Confirmar que o seletor da linha 741 é exatamente `.nav-links { display: none; }` e que não há nenhuma regra que esconda filhos genéricos da navbar. Se houver, acrescentar dentro do mesmo media query:

```css
  .nav-cta { display: inline-block; font-size: 0.7rem; padding: 0.45rem 0.8rem; }
```

- [ ] **Step 5: Verificar no navegador**

```bash
node server.js
```

Abrir `http://127.0.0.1:8080/index.html` e confirmar:
- O botão "ACESSAR O SISTEMA" aparece na navbar e leva para a tela de login
- O botão "Acessar o Sistema" do hero leva para a tela de login
- Reduzindo a janela para largura de celular (~390px), o botão da navbar continua visível e não quebra o layout

- [ ] **Step 6: Commit**

```bash
git add index.html styles.css
git commit -m "feat: liga o site institucional ao sistema

Botao ACESSAR O SISTEMA na navbar e no hero do index.html.
Antes nao havia nenhum caminho da pagina de apresentacao
para a tela de login."
```

---

### Task 6: README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: o estado final de todas as tasks anteriores (caminhos, comandos, estrutura de pastas)
- Produces: documentação de entrada do repositório

**Contexto:** é a última task de propósito — descreve o projeto já arrumado. Critério de sucesso: alguém que nunca viu o projeto entende o que ele faz e consegue rodá-lo sem perguntar nada.

- [ ] **Step 1: Criar o `README.md`**

```markdown
# Casa Inteligente

Sistema de automação residencial voltado à **acessibilidade**, desenvolvido como
Trabalho de Conclusão de Curso da turma 3 AMS de Desenvolvimento de Sistemas.

O objetivo é dar mais autonomia a idosos e pessoas com mobilidade reduzida,
permitindo controlar luz, ventilador, portão e alarme pelo site, por comando de
voz ou automaticamente, a partir de sensores de presença e temperatura.

## Arquitetura

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐     ┌───────────┐
│     Site     │────▶│     Firebase     │◀───▶│    Backend   │◀───▶│  ESP8266  │
│ HTML/CSS/JS  │     │ Auth · Firestore │     │   Express    │     │  NodeMCU  │
│              │     │       RTDB       │     │  (Railway)   │     │  + reles  │
└──────────────┘     └──────────────────┘     └──────────────┘     └───────────┘
```

1. O usuário aciona um dispositivo no site; o comando é gravado no Realtime Database.
2. O ESP8266 consulta o backend a cada 2 segundos, enviando temperatura, presença
   e o estado atual dos relés.
3. O backend responde com os comandos pendentes — do site e das automações — e o
   ESP8266 aciona os relés.
4. Cada ação é registrada no histórico, no Firestore.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML, CSS e JavaScript puros (sem framework) |
| Autenticação | Firebase Authentication (e-mail/senha e Google) |
| Banco de dados | Cloud Firestore (perfis, automações, histórico) |
| Tempo real | Firebase Realtime Database (estado dos dispositivos) |
| Backend | Node.js + Express, hospedado no Railway |
| Firmware | C++ (Arduino) para NodeMCU ESP8266 |
| Voz | Web Speech API (nativa do navegador) |
| Testes | Jest + Supertest (backend) |

## Como executar

**Pré-requisito:** Node.js instalado.

### Site

```bash
node server.js
```

Depois abra <http://127.0.0.1:8080> no navegador.

> O site **precisa** ser aberto por esse servidor. Abrir os arquivos `.html`
> com duplo clique não funciona: o Firebase Authentication não opera sob o
> protocolo `file://`.

### Backend

O backend já está publicado e no ar:
<https://casa-inteligente-tcc-production.up.railway.app>

Para rodar localmente, crie o arquivo `backend/.env` a partir de
`backend/.env.example` e execute:

```bash
cd backend
npm install
npm start
```

Testes:

```bash
cd backend
npm test
```

### Firmware

Abra `firmware/esp8266/casa_inteligente.ino` na IDE do Arduino, preencha o bloco
`EDITE AQUI` no topo (rede WiFi, UID do Firebase e token) e envie para a placa.

Bibliotecas necessárias: ArduinoJson, DHT sensor library (Adafruit) e
Adafruit Unified Sensor.

## Estrutura de pastas

```
├── index.html              Site de apresentação do TCC
├── login.html              Entrada do sistema
├── profile.html            Seleção de perfil de acessibilidade
├── dashboard.html          Controle dos dispositivos
├── automation.html         Criação e edição de automações
├── history.html            Histórico de acionamentos
├── server.js               Servidor local para rodar o site
├── css/app.css             Estilos do sistema
├── styles.css              Estilos do site de apresentação
├── js/                     Lógica do frontend
│   ├── auth.js             Login, cadastro e sessão
│   ├── dashboard.js        Controle dos dispositivos em tempo real
│   ├── automation.js       Editor de automações
│   ├── history.js          Listagem do histórico
│   ├── voice.js            Comandos de voz
│   └── devices.js          Definições compartilhadas de dispositivos
├── backend/                API Express publicada no Railway
│   ├── routes/arduino.js   Endpoint POST /arduino/sync
│   ├── services/           Automações e histórico
│   └── __tests__/          15 testes automatizados
├── firmware/esp8266/       Firmware do NodeMCU
└── docs/                   Specs, planos e capturas de tela
```

## Estado atual

| Etapa | Situação |
|---|---|
| Site de apresentação | Concluído |
| Login e cadastro | Concluído |
| Seleção de perfil | Concluído |
| Dashboard | Concluído |
| Automações | Concluído |
| Histórico | Concluído |
| Comandos de voz | Concluído |
| Backend + deploy | Concluído — 15 testes passando |
| Firmware ESP8266 | Escrito, **não testado em hardware** |
| Montagem física | Pendente — o NodeMCU ainda não foi adquirido |

## Limitações conhecidas

- **Sem hardware.** O NodeMCU ainda não foi comprado, então o firmware nunca foi
  executado. Enquanto não houver uma placa conectada, o dashboard indica que o
  hardware não está conectado e os comandos ficam guardados no Realtime Database,
  aguardando.
- **Automações por horário não disparam.** O site permite criá-las e o backend
  aceita o gatilho, mas nenhuma camada gera esse evento — não existe agendador no
  backend nem relógio no firmware. Apenas os gatilhos de presença e temperatura
  funcionam de ponta a ponta. Documentado em
  `docs/superpowers/specs/2026-05-29-firmware-esp8266-design.md`.

## Roteiro de demonstração

1. **`index.html`** — apresentação do projeto, o problema e a proposta.
2. **"Acessar o Sistema"** — leva à tela de login (e-mail/senha ou Google).
3. **Seleção de perfil** — escolha do perfil de acessibilidade do usuário.
4. **Dashboard** — os quatro dispositivos, o estado do hardware e os comandos de voz.
5. **Automações** — criar uma regra: "quando houver presença, ligar a luz".
6. **Histórico** — todos os acionamentos registrados, com data e origem.

## Documentação técnica

Os documentos de design e os planos de implementação estão em `docs/superpowers/`:

- `specs/2026-05-20-casa-inteligente-design.md` — design geral do sistema
- `specs/2026-05-29-firmware-esp8266-design.md` — design do firmware
- `specs/2026-06-01-redesign-frontend-design.md` — design da interface
- `specs/2026-08-12-fechamento-tcc-design.md` — fechamento para a apresentação

## Equipe

| Integrante | Função |
|---|---|
| Henrique Delalibera | Lead Developer |
| Isabela Scucciato | UI/UX Designer |
| Thiago Pinheiro | Hardware Specialist |
| Rebeca Damasio | Cloud Architect |
| Sofia Lopes | IoT Researcher |
| Lucas Ribeiro | Project Manager |
```

- [ ] **Step 2: Conferir que os caminhos citados existem de verdade**

```bash
ls index.html login.html profile.html dashboard.html automation.html history.html server.js styles.css
ls css/app.css js/auth.js js/dashboard.js js/automation.js js/history.js js/voice.js js/devices.js
ls backend/routes/arduino.js firmware/esp8266/casa_inteligente.ino
ls docs/superpowers/specs/
```

Esperado: nenhum "No such file". Corrigir o README se algum caminho divergir.

- [ ] **Step 3: Confirmar a contagem de testes citada no README**

```bash
cd backend && npm test 2>&1 | grep "Tests:"
```

Esperado: `Tests: 15 passed, 15 total`. Se o número for outro, ajustar o README para o valor real.

- [ ] **Step 4: Verificar os links do roteiro**

Subir `node server.js`, abrir `http://127.0.0.1:8080` e percorrer o roteiro de demonstração da seção correspondente, passo a passo, confirmando que cada tela abre.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: adiciona README do projeto

Explica o que e o sistema, a arquitetura, como executar,
a estrutura de pastas, o estado atual, as limitacoes
conhecidas e o roteiro de demonstracao."
```

---

## Verificação final

Depois da Task 6, rodar tudo de uma vez:

- [ ] `cd backend && npm test` → 15 testes passando
- [ ] `git status --short` → nada de inesperado sem commitar
- [ ] `git ls-files | grep -i "adminsdk\|\.env$"` → sem saída
- [ ] `node server.js` e percorrer: `index.html` → login → perfil → dashboard → automação → histórico
- [ ] O dashboard não exibe nada em vermelho de erro por causa da ausência de hardware
- [ ] `git log --oneline -6` → seis commits, um por task
