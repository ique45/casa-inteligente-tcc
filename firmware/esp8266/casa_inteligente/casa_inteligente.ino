/*
 * ============================================================
 *  CASA INTELIGENTE - Firmware NodeMCU ESP8266
 *  TCC - 3 AMS Desenvolvimento de Sistemas
 * ============================================================
 *
 *  O que este programa faz, a cada 2 segundos:
 *    1. Le o push button, a presenca (sensor PIR) e a luminosidade (LDR)
 *    2. Envia esses eventos e o estado atual das luzes para o backend
 *    3. Recebe do backend a lista de comandos a executar
 *    4. Liga ou desliga a luz interna, a luz externa e o alarme
 *
 *  Mesmas pecas da maquete do projeto do Uno (Projeto_Casa_Inteligente_v3):
 *    - 4 LEDs internos: por um canal do modulo de rele, que liga os LEDs nos
 *      5 V. Quatro LEDs passam do que um pino do ESP8266 consegue fornecer.
 *    - 2 LEDs externos: direto num pino.
 *    - LED do alarme e buzzer: direto, cada um no seu pino.
 *
 *  Backend: https://casa-inteligente-tcc-production.up.railway.app
 *
 *  Bibliotecas necessarias (Gerenciador de Bibliotecas da IDE Arduino):
 *    - ArduinoJson           (Benoit Blanchon)   v7.x
 *  As bibliotecas ESP8266WiFi, ESP8266HTTPClient e WiFiClientSecure
 *  ja vem com o pacote de placas ESP8266.
 * ============================================================
 */

#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>

// ─── EDITE AQUI ──────────────────────────────────────────────
const char* WIFI_SSID     = "NomeDaSuaRede";
const char* WIFI_PASSWORD = "SenhaDaSuaRede";
const char* BACKEND_URL   = "https://casa-inteligente-tcc-production.up.railway.app/arduino/sync";
const char* UID           = "cole-aqui-o-uid-do-firebase";
const char* TOKEN         = "cole-aqui-o-mesmo-valor-de-ARDUINO_SECRET";
// ─────────────────────────────────────────────────────────────

// Pinos (numeracao GPIO, nao a numeracao "D" impressa na placa)
// D3, D4 e D8 ficam vazios de proposito: o ESP8266 le esses tres pinos no
// boot para decidir como iniciar, e um LED, rele ou sensor ligado neles pode
// impedir a placa de ligar.
//
// Push button (pino 7 no Uno): um terminal no D1 e o outro no GND. O pull-up
// e o interno do ESP8266 (INPUT_PULLUP): solto = HIGH, apertado = LOW.
#define PIN_BOTAO            5   // D1
// Sensor de presenca PIR HC-SR501 (no lugar do sensor IR que ficava no pino
// 12 do Uno). Alimentado em 5 V, mas a saida dele e de 3,3 V: vai direto no
// pino. HIGH = movimento detectado.
#define PIN_PIR              4   // D2
// Sensor de luminosidade (LDR, A0 no Uno) na unica entrada analogica da
// placa. O NodeMCU tem um divisor interno que aceita de 0 a 3,3 V nesse pino.
#define PIN_LDR             A0
// IN1 do modulo de rele, que liga os 4 LEDs internos (pino 13 no Uno).
#define PIN_RELE_INTERNA    13   // D7
// Os 2 LEDs externos (pino 8 no Uno).
#define PIN_LED_EXTERNA     12   // D6
// LED do alarme e buzzer (os dois no pino 11 no Uno). Aqui ficam em pinos
// separados: somadas, as duas correntes passariam do limite de um pino.
// O LED fica no D0 porque esse pino vai a HIGH por um instante no boot: no
// LED isso e uma piscada invisivel, no buzzer seria um bip a cada reset.
#define PIN_LED_ALARME      16   // D0
#define PIN_BUZZER          14   // D5

// Modulo de rele "ativo em LOW", o mais comum: o rele LIGA quando o pino vai
// para LOW. Se o seu funcionar ao contrario, inverta estes dois valores.
#define RELE_LIGADO    LOW
#define RELE_DESLIGADO HIGH

// Constantes de comportamento
const unsigned long SYNC_INTERVAL          = 2000;   // ms entre cada sync
const int           WIFI_TIMEOUT_ATTEMPTS  = 20;     // 20 x 500ms = ~10s
const unsigned long PRESENCA_COOLDOWN_MS   = 10000;  // 10s entre eventos de presenca
const unsigned long BOTAO_DEBOUNCE_MS      = 200;    // ignora o "quique" do contato

// Luminosidade. analogRead(A0) vai de 0 a 1023. Com o LDR ligado como no
// projeto do Uno (LDR no 3V3, resistor de 10k para o GND, ponto do meio no
// A0) a leitura CAI quando escurece, por isso LDR_ESCURO_E_MAIOR = false.
// Se usar um modulo de LDR cuja leitura SOBE no escuro, troque para true.
// Para calibrar, abra o Monitor Serial: a leitura aparece a cada ciclo
// ("Luminosidade: ..."). 650 e o valor que o grupo usava no Uno.
const bool          LDR_ESCURO_E_MAIOR     = false;
const int           LDR_LIMITE_ESCURO      = 650;    // a partir daqui conta como escuro
// Histerese: o gatilho so re-arma depois que a leitura volta LDR_HISTERESE
// pontos para o lado claro. Sem isso, uma leitura oscilando em torno do
// limite dispararia o evento (e a automacao de "Alternar") a cada 2s.
const int           LDR_HISTERESE          = 50;

// ─── Estado global ───────────────────────────────────────────
bool estadoLuzInterna = false;
bool estadoLuzExterna = false;
bool estadoAlarme     = false;

bool estaEscuro = false;  // estado do gatilho de luminosidade (edge-trigger, ve readSensors)

// O sync bloqueia o loop por varios segundos (handshake TLS), entao ler o
// botao so dentro de readSensors() perderia quase todo aperto. A interrupcao
// registra o aperto na hora; readSensors() so transforma isso em evento.
volatile bool          botaoApertado = false;
volatile unsigned long ultimoAperto  = 0;

unsigned long ultimaPresenca = 0;
bool          pirAtivo       = false;  // leitura anterior do PIR (detecta a subida)
unsigned long ultimoSync     = 0;

String events[4];
int    eventCount = 0;

// Cliente TLS unico e de longa duracao (fora de qualquer funcao), para nao
// realocar o objeto a cada ciclo.
//
// ATENCAO: nao tente manter a conexao TLS aberta entre ciclos com
// http.setReuse(true). Isso foi testado em simulacao (2026-08-18) e falhou:
// o servidor fecha a conexao ociosa, o POST seguinte trava ate estourar o
// timeout e volta "HTTP -1", e so o ciclo seguinte reconecta. O resultado
// era um sync bem-sucedido a cada ~10s em vez de 2s, com metade das
// tentativas falhando. Cada ciclo abre e fecha sua propria conexao.
WiFiClientSecure secureClient;

// Tabela que liga o nome vindo do backend aos pinos e a variavel de estado.
// Para adicionar um dispositivo novo, basta acrescentar uma linha aqui.
// pin2 e um segundo pino que liga e desliga junto (-1 = nenhum).
// rele = true quando o pino comanda o modulo de rele (logica invertida).
struct DevicePin {
  const char* name;
  int         pin;
  int         pin2;
  bool        rele;
  bool*       stateVar;
};

DevicePin devicePins[] = {
  { "luz",         PIN_RELE_INTERNA, -1,         true,  &estadoLuzInterna },
  { "luz_externa", PIN_LED_EXTERNA,  -1,         false, &estadoLuzExterna },
  { "alarme",      PIN_LED_ALARME,   PIN_BUZZER, false, &estadoAlarme     },
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
    Serial.println("Sem WiFi. Os LEDs mantem o ultimo estado e o ESP segue tentando reconectar.");
  }
}

// ─── Sensores ────────────────────────────────────────────────

// Roda dentro da interrupcao do botao: precisa ser curta e ficar na RAM.
void IRAM_ATTR aoApertarBotao() {
  unsigned long agora = millis();
  if (agora - ultimoAperto > BOTAO_DEBOUNCE_MS) {
    botaoApertado = true;
    ultimoAperto  = agora;
  }
}

// Verifica se um evento desse tipo ja esta no buffer aguardando envio.
// Usado para nunca duplicar o mesmo evento enquanto um sync anterior
// ainda nao foi confirmado (ve syncWithBackend) e para nunca escrever
// alem dos limites do array events[].
bool eventoJaPendente(const String& nome) {
  for (int i = 0; i < eventCount; i++) {
    if (events[i] == nome) return true;
  }
  return false;
}

void readSensors() {
  // IMPORTANTE: eventCount NAO e zerado aqui. Ele so e zerado em
  // syncWithBackend() depois de uma confirmacao real do backend (HTTP 200
  // com JSON valido). Se zerassemos aqui, um evento gerado neste ciclo mas
  // perdido por falha de rede seria descartado sem nunca ter sido
  // entregue (ve Secao 3 do spec / achado 3 da revisao).

  // Botao. A flag e ligada pela interrupcao; aqui ela so vira evento. Com o
  // buffer cheio a flag fica ligada e o evento sai no proximo ciclo.
  if (botaoApertado && eventCount < 4) {
    if (!eventoJaPendente("botao_fisico")) {
      events[eventCount++] = "botao_fisico";
    }
    botaoApertado = false;
  }

  // Presenca. O PIR fica em HIGH enquanto ha movimento, por varios segundos
  // seguidos. O evento sai so na subida (LOW -> HIGH): sem isso, uma pessoa
  // andando na frente do sensor alternaria o alarme a cada ciclo. O cooldown
  // segura subidas muito proximas, quando o PIR oscila.
  bool pirAgora = digitalRead(PIN_PIR) == HIGH;
  if (pirAgora && !pirAtivo) {
    unsigned long agora = millis();
    if (agora - ultimaPresenca > PRESENCA_COOLDOWN_MS &&
        !eventoJaPendente("presenca") && eventCount < 4) {
      events[eventCount++] = "presenca";
      ultimaPresenca = agora;
    }
  }
  pirAtivo = pirAgora;

  // Luminosidade. O evento "luminosidade" e edge-triggered: dispara so na
  // passagem de claro para escuro, com histerese para re-armar. Isso evita
  // gerar o evento a cada ciclo de 2s enquanto continua escuro, o que faria
  // uma automacao de "Alternar" ligar/desligar a luz sem parar.
  int leitura = analogRead(PIN_LDR);
  Serial.print("Luminosidade: ");
  Serial.println(leitura);

  bool escuroAgora = LDR_ESCURO_E_MAIOR ? (leitura >= LDR_LIMITE_ESCURO)
                                        : (leitura <= LDR_LIMITE_ESCURO);
  bool claroDeNovo = LDR_ESCURO_E_MAIOR ? (leitura < LDR_LIMITE_ESCURO - LDR_HISTERESE)
                                        : (leitura > LDR_LIMITE_ESCURO + LDR_HISTERESE);
  if (escuroAgora) {
    if (!estaEscuro) {
      estaEscuro = true;
      if (!eventoJaPendente("luminosidade") && eventCount < 4) {
        events[eventCount++] = "luminosidade";
      }
    }
  } else if (claroDeNovo) {
    estaEscuro = false;
  }
}

// ─── Aplicacao de comandos ───────────────────────────────────

// LED e buzzer: HIGH liga, LOW desliga. Rele: o contrario (ve RELE_LIGADO).
void escreverDispositivo(const DevicePin& d, bool state) {
  int nivel = d.rele ? (state ? RELE_LIGADO : RELE_DESLIGADO)
                     : (state ? HIGH : LOW);
  digitalWrite(d.pin, nivel);
  if (d.pin2 >= 0) digitalWrite(d.pin2, nivel);
}

void applyCommand(const char* device, bool state) {
  for (int i = 0; i < DEVICE_COUNT; i++) {
    if (strcmp(devicePins[i].name, device) == 0) {
      escreverDispositivo(devicePins[i], state);
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
  // secureClient e reaproveitado entre ciclos (declarado global la em cima).
  // NAO chamar secureClient.setBufferSizes() aqui para "economizar RAM":
  // reduzir os buffers do BearSSL pode quebrar o handshake com servidores
  // que mandam registros TLS grandes, e nao ha hardware disponivel para
  // testar esse cenario. Deixe no tamanho padrao.
  // Garante que nao sobrou socket da chamada anterior. Sem isso, uma
  // conexao que o servidor ja fechou seria reutilizada e o POST travaria.
  secureClient.stop();

  HTTPClient http;
  if (!http.begin(secureClient, BACKEND_URL)) {
    Serial.println("Falha ao iniciar a conexao HTTP");
    return;  // eventCount preservado: nada foi enviado, nada se perde
  }
  http.addHeader("Content-Type", "application/json");

  // Monta o corpo da requisicao
  JsonDocument doc;
  doc["uid"]    = UID;
  doc["token"]  = TOKEN;
  doc["online"] = true;

  JsonObject devices = doc["devices"].to<JsonObject>();
  for (int i = 0; i < DEVICE_COUNT; i++) {
    devices[devicePins[i].name] = *(devicePins[i].stateVar);
  }

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
      // Nao zera eventCount aqui: o corpo veio corrompido, entao nao ha
      // garantia de que o backend processou os eventos. Mantem no buffer
      // para tentar de novo no proximo ciclo.
    } else {
      // Executa os comandos enviados pelo site e pelas automacoes
      for (JsonObject cmd : resposta["commands"].as<JsonArray>()) {
        const char* device = cmd["device"];
        bool        state  = cmd["state"];
        if (device != nullptr) {
          applyCommand(device, state);
        }
      }

      // So agora o sync foi de fato confirmado (HTTP 200 + JSON valido):
      // e seguro descartar os eventos deste ciclo. Zerar em qualquer outro
      // ponto arriscaria descartar um evento que o backend nunca recebeu.
      eventCount = 0;
    }
  } else {
    Serial.print("Erro no sync. Codigo HTTP: ");
    Serial.println(status);
    // eventCount preservado para reenviar no proximo ciclo
  }

  http.end();
}

// ─── setup / loop ────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("=== Casa Inteligente - iniciando ===");

  // Tudo comeca desligado. O nivel e escrito ANTES do pinMode para o rele
  // nao dar um clique (pulso de LOW) no instante em que o pino vira saida.
  for (int i = 0; i < DEVICE_COUNT; i++) {
    escreverDispositivo(devicePins[i], false);
    pinMode(devicePins[i].pin, OUTPUT);
    if (devicePins[i].pin2 >= 0) pinMode(devicePins[i].pin2, OUTPUT);
    escreverDispositivo(devicePins[i], false);
  }

  pinMode(PIN_PIR, INPUT);
  pinMode(PIN_BOTAO, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_BOTAO), aoApertarBotao, FALLING);

  connectWiFi();

  // O ESP8266 nao guarda os certificados raiz do Railway. Para o escopo
  // deste TCC aceitamos o certificado sem validar. Em producao real,
  // o correto seria fixar a impressao digital do certificado.
  // Chamado uma unica vez aqui (nao a cada sync) porque secureClient
  // agora e uma instancia global de longa duracao (ve declaracao acima).
  secureClient.setInsecure();
}

void loop() {
  // Se o WiFi caiu, tenta reconectar e pula este ciclo.
  // Os LEDs continuam no ultimo estado conhecido.
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
