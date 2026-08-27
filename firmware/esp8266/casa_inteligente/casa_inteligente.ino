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
// O alarme ficava no GPIO15 (D8) e foi movido para o GPIO2 (D4) em 2026-08-27.
// Motivo: o GPIO15 precisa estar em LOW no momento do reset para o ESP8266 dar
// boot, e os pinos IN dos modulos de rele sao puxados para cima por resistor.
// Com o modulo ligado, o D8 fica em HIGH no reset e a placa nao inicia.
// O GPIO2 tem a regra inversa (precisa estar em HIGH no reset), e como
// RELAY_OFF = HIGH o pull-up do modulo joga a favor: no boot o rele ja nasce
// desligado. Efeito colateral inofensivo: o GPIO2 tambem comanda o LED azul
// embutido no modulo ESP-12E, entao ele acende junto com o rele do alarme.
#define PIN_RELE_ALARME      2   // D4

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
// Histerese do evento de temperatura: o gatilho so re-arma quando a
// temperatura cai abaixo de (tempThreshold - TEMP_HISTERESE). Sem isso,
// uma leitura oscilando 1 decimo de grau em torno do limite dispararia
// o evento (e a automacao de "Alternar" nos reles) a cada 2s.
const float         TEMP_HISTERESE         = 1.0;    // °C

// ─── Estado global ───────────────────────────────────────────
DHT dht(PIN_DHT, DHT11);

bool estadoLuz        = false;
bool estadoVentilador = false;
bool estadoPortao     = false;
bool estadoAlarme     = false;

float currentTemp    = 0.0;
// So fica true depois da primeira leitura valida (nao-NaN) do DHT11. Enquanto
// for false, o campo "temperature" nem entra no JSON do sync — sem isso, um
// sensor ausente ou mal conectado faria o firmware enviar 0.0 como se fosse
// uma leitura real, e o backend gravaria esse 0 no Realtime Database (o guard
// em backend/routes/arduino.js so filtra valor ausente/invalido, nao um 0
// "de verdade" vindo do firmware).
bool  tempValida     = false;
float tempThreshold  = DEFAULT_TEMP_THRESHOLD;  // atualizado pelo backend
bool  tempAcimaLimite = false;  // estado do gatilho de temperatura (edge-trigger, ve Secao 4)

unsigned long ultimaPresenca = 0;
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

  // Temperatura. O DHT11 as vezes devolve NaN numa leitura isolada;
  // nesse caso mantemos o ultimo valor valido.
  float temp = dht.readTemperature();
  if (!isnan(temp)) {
    currentTemp = temp;
    tempValida  = true;
  }

  // Evento "temperatura" e edge-triggered (dispara so na transicao de
  // abaixo para acima do limite), com histerese para re-armar. Isso evita
  // que o evento seja gerado a cada ciclo de 2s enquanto a temperatura
  // fica acima do limite, o que faria uma automacao de "Alternar" o rele
  // ligar/desligar sem parar (ve achado 2 da revisao). tempThreshold pode
  // mudar em tempo real (o backend devolve um novo valor a cada sync); a
  // logica abaixo usa sempre o valor atual, entao um ajuste de limite se
  // reflete no proximo ciclo sem precisar de estado adicional.
  if (currentTemp > tempThreshold) {
    if (!tempAcimaLimite) {
      tempAcimaLimite = true;
      if (!eventoJaPendente("temperatura") && eventCount < 4) {
        events[eventCount++] = "temperatura";
      }
    }
  } else if (currentTemp < tempThreshold - TEMP_HISTERESE) {
    tempAcimaLimite = false;
  }

  // Presenca. O PIR oscila enquanto ha movimento, entao aplicamos um
  // cooldown para nao enviar dezenas de eventos por minuto.
  if (digitalRead(PIN_PIR) == HIGH) {
    unsigned long agora = millis();
    if (agora - ultimaPresenca > PIR_COOLDOWN_MS) {
      if (!eventoJaPendente("presenca") && eventCount < 4) {
        events[eventCount++] = "presenca";
        ultimaPresenca = agora;
      }
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
  doc["uid"]         = UID;
  doc["token"]       = TOKEN;
  doc["online"]      = true;
  // So envia "temperature" depois de uma leitura valida do DHT11 (ve
  // declaracao de tempValida). Sem essa checagem, um sensor ausente ou
  // mal conectado mandaria 0.0 como se fosse uma leitura real.
  if (tempValida) {
    doc["temperature"] = currentTemp;
  }

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
      // Nao zera eventCount aqui: o corpo veio corrompido, entao nao ha
      // garantia de que o backend processou os eventos. Mantem no buffer
      // para tentar de novo no proximo ciclo.
    } else {
      // Atualiza o limite de temperatura devolvido pelo backend a cada sync
      // (users/{uid}.tempThreshold, se o documento existir); se o campo nao
      // vier na resposta, usa o padrao local (DEFAULT_TEMP_THRESHOLD). Hoje
      // nenhuma tela do site escreve esse campo, entao na pratica o default
      // sempre se aplica (ve js/automation.js: "O limite e definido no codigo").
      tempThreshold = resposta["tempThreshold"] | DEFAULT_TEMP_THRESHOLD;

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

  // O ESP8266 nao guarda os certificados raiz do Railway. Para o escopo
  // deste TCC aceitamos o certificado sem validar. Em producao real,
  // o correto seria fixar a impressao digital do certificado.
  // Chamado uma unica vez aqui (nao a cada sync) porque secureClient
  // agora e uma instancia global de longa duracao (ve declaracao acima).
  secureClient.setInsecure();
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
