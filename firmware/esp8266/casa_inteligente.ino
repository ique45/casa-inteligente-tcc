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
