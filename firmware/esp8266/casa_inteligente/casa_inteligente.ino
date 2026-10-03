/*
 * ============================================================
 *  CASA INTELIGENTE - Firmware NodeMCU ESP8266
 *  TCC - 3 AMS Desenvolvimento de Sistemas
 * ============================================================
 *
 *  O que este programa faz, a cada 2 segundos:
 *    1. Le o push button, a distancia (ultrassom HC-SR04) e a luminosidade (LDR)
 *    2. Envia esses eventos e o estado atual das luzes para o backend
 *    3. Recebe do backend a lista de comandos a executar
 *    4. Liga ou desliga a luz interna e a luz externa
 *  O alarme (LED + buzzer) e local: objeto a 6 cm ou menos, toca 2 s e espera 1,5 s
 *  antes de ler o sensor de novo, sem depender do backend.
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
#include <Ticker.h>

// ─── EDITE AQUI ──────────────────────────────────────────────
const char* WIFI_SSID     = "NomeDaSuaRede";
const char* WIFI_PASSWORD = "SenhaDaSuaRede";
const char* BACKEND_URL   = "https://casa-inteligente-tcc-production.up.railway.app/arduino/sync";
const char* UID           = "cole-aqui-o-uid-do-firebase";
const char* TOKEN         = "cole-aqui-o-mesmo-valor-de-ARDUINO_SECRET";
// ─────────────────────────────────────────────────────────────

// Pinos (numeracao GPIO, nao a numeracao "D" impressa na placa)
// D4 e D8 ficam vazios de proposito: o ESP8266 le esses pinos (e o D3) no
// boot para decidir como iniciar, e um LED, rele ou sensor ligado neles pode
// impedir a placa de ligar. O D3 e a excecao: precisa estar em HIGH no boot,
// o resistor da propria placa garante isso, e o Trig do HC-SR04 e so uma
// entrada, que nao puxa o pino para baixo.
//
// Push button (pino 7 no Uno): um terminal no D1 e o outro no GND. O pull-up
// e o interno do ESP8266 (INPUT_PULLUP): solto = HIGH, apertado = LOW.
#define PIN_BOTAO            5   // D1
// Sensor ultrassonico HC-SR04 (no lugar do PIR, que disparava com qualquer
// movimento na sala; decisao do grupo em 03/10). Alimentado em 5 V. O Echo
// sai em 5 V e passa por um divisor (1 kOhm do Echo ao D2; 2 kOhm, ou dois
// de 1 kOhm em serie, do D2 ao GND) para chegar ao pino em ~3,3 V.
#define PIN_ECHO             4   // D2
#define PIN_TRIG             0   // D3
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
// O modulo e de 5 V e o NodeMCU, de 3,3 V. Um HIGH de 3,3 V nao basta para
// apagar o LED do optoacoplador (ele fica entre 5 V e o pino) e o rele
// continuava ligado — medido na maquete em 2026-10-02: "desligar" nao
// apagava os LEDs internos. Para desligar, o pino vira entrada (fica solto):
// sem caminho para a corrente, o rele desliga de verdade.
const bool RELE_DESLIGA_SOLTANDO_O_PINO = true;

// Constantes de comportamento
const unsigned long SYNC_INTERVAL          = 1000;   // ms entre cada sync (o envio em si leva ~2 s)
const int           WIFI_TIMEOUT_ATTEMPTS  = 20;     // 20 x 500ms = ~10s
// Botao: lido por timer a cada 10 ms. Um aperto so conta depois de 50 ms
// seguidos em LOW, e o proximo so depois de 50 ms seguidos solto. Sem isso,
// o repique do contato ao SOLTAR contava como outro aperto e a luz ligava
// e desligava em seguida (medido na maquete em 03/10).
const unsigned long BOTAO_TICK_MS          = 10;
const int           BOTAO_LEITURAS_ESTAVEIS = 5;     // 5 x 10 ms = 50 ms

// Alarme (definido pelo grupo em 03/10): um objeto a DISTANCIA_ALARME_CM ou
// menos do sensor, LED e buzzer tocam por ALARME_DURACAO_MS e desligam;
// depois o sensor fica ignorado por ALARME_PAUSA_MS antes de voltar a ser
// lido. Se o objeto ainda estiver la quando a leitura volta, dispara de novo.
// Roda num timer (Ticker), fora do loop: o sync segura o loop por segundos
// (handshake TLS) e o alarme nao pode esperar por ele.
const unsigned long ALARME_DURACAO_MS      = 2000;
const unsigned long ALARME_PAUSA_MS        = 1500;
const unsigned long ALARME_TICK_MS         = 100;    // uma medicao de distancia a cada 100 ms
const float         DISTANCIA_ALARME_CM    = 6.0;    // perto o bastante para disparar
const int           LEITURAS_PERTO         = 2;      // seguidas, para ignorar um eco perdido
// Distancia maxima medida: alem disso o sensor responde "nada". Limita a
// espera pelo eco a ~3 ms, para o timer nao segurar a placa.
const float         DISTANCIA_MAX_CM       = 50.0;
const unsigned long ECO_TIMEOUT_US         = (unsigned long)(DISTANCIA_MAX_CM * 58) + 600;

// Linhas do Monitor Serial que tambem vao para o site (painel "Monitor
// serial"). Ficam guardadas aqui ate um sync confirmado; com o buffer cheio,
// a mais antiga sai.
const int           LOG_MAX                = 12;

// Luminosidade. analogRead(A0) vai de 0 a 1023. Com o LDR ligado como no
// projeto do Uno (LDR no 3V3, resistor de 10k para o GND, ponto do meio no
// A0) a leitura CAI quando escurece, por isso LDR_ESCURO_E_MAIOR = false.
// Se usar um modulo de LDR cuja leitura SOBE no escuro, troque para true.
// Para calibrar, abra o Monitor Serial: a leitura aparece a cada ciclo
// ("Luminosidade: ..."). 650 e o valor que o grupo usava no Uno.
const bool          LDR_ESCURO_E_MAIOR     = false;
const int           LDR_LIMITE_ESCURO      = 800;    // 800 ou menos = escuro (definido pelo grupo em 03/10)
// O LDR e lido por um timer proprio, fora do ciclo de envio: 5 vezes por
// segundo. Assim os LEDs externos reagem quase na hora.
const unsigned long LDR_TICK_MS            = 200;
// Histerese: o gatilho so re-arma depois que a leitura volta LDR_HISTERESE
// pontos para o lado claro. Sem isso, uma leitura oscilando em torno do
// limite dispararia o evento (e a automacao de "Alternar") a cada 2s.
const int           LDR_HISTERESE          = 20;     // apaga com 820 ou mais

// ─── Estado global ───────────────────────────────────────────
bool estadoLuzInterna = false;

// Estado do LDR, mexido pelo timer (lerLuz) e lido pelo loop.
Ticker                 timerLuz;
volatile bool          estaEscuro      = false;  // gatilho por borda, com histerese
volatile int           luzUltima       = 0;
volatile int           luzMin          = 1024;
volatile int           luzMax          = 0;
volatile int           luzAmostras     = 0;
volatile bool          escureceuNovo   = false;
volatile bool          clareouNovo     = false;
volatile int           leituraEscureceu = 0;
volatile int           leituraClareou  = 0;
const unsigned long PINOS_LOG_INTERVALO_MS = 30000;
String        ultimaLinhaDePinos;
unsigned long ultimoLogPinos  = 0;

// Estado do alarme, mexido pelo timer (verificarAlarme) e lido pelo loop.
Ticker                 timerAlarme;
volatile bool          alarmeDisparado = false;
volatile unsigned long fimDaEtapa      = 0;      // fim do disparo ou da pausa
volatile bool          alarmeEmPausa   = false;
volatile bool          disparoNovo     = false;  // o loop registra e avisa o backend
volatile bool          alarmeParou     = false;
// Distancias medidas pelo timer desde a ultima linha do serial.
volatile float         distUltima      = -1;     // -1 = nada ate DISTANCIA_MAX_CM
volatile float         distMin         = 9999;
volatile int           distLeituras    = 0;
volatile float         distDoDisparo   = 0;

String logs[LOG_MAX];
int    logCount = 0;

// O sync bloqueia o loop por varios segundos (handshake TLS), entao ler o
// botao so dentro de readSensors() perderia quase todo aperto. O timer
// (lerBotao) registra o aperto na hora; readSensors() so transforma em evento.
Ticker        timerBotao;
volatile bool botaoApertado = false;

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

// Tabela que liga o nome vindo do backend ao pino e a variavel de estado:
// so os dispositivos que o site comanda. O alarme fica de fora de proposito,
// porque quem decide se ele toca e o sensor de distancia (ve verificarAlarme).
// rele = true quando o pino comanda o modulo de rele (logica invertida).
struct DevicePin {
  const char* name;
  int         pin;
  bool        rele;
  bool*       stateVar;
};

DevicePin devicePins[] = {
  { "luz",         PIN_RELE_INTERNA, true,  &estadoLuzInterna },
};
const int DEVICE_COUNT = sizeof(devicePins) / sizeof(devicePins[0]);

// ─── Log ─────────────────────────────────────────────────────

// Escreve no Monitor Serial e guarda a linha para mandar ao site no proximo
// sync. Nao chamar de dentro dos timers (aloca String).
void logar(const String& msg) {
  Serial.println(msg);
  if (logCount == LOG_MAX) {
    for (int i = 1; i < LOG_MAX; i++) logs[i - 1] = logs[i];
    logCount--;
  }
  logs[logCount++] = msg;
}

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
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    logar("Conectado ao WiFi. IP: " + WiFi.localIP().toString());
  } else {
    logar("Sem WiFi. As luzes mantem o ultimo estado e o ESP segue tentando reconectar.");
  }
}

// ─── Alarme (ultrassom + LED + buzzer) ───────────────────────

void escreverAlarme(bool ligado) {
  digitalWrite(PIN_LED_ALARME, ligado ? HIGH : LOW);
  digitalWrite(PIN_BUZZER,     ligado ? HIGH : LOW);
}

// Uma medicao do HC-SR04, em cm. -1 quando nada responde ate DISTANCIA_MAX_CM.
float medirDistanciaCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  unsigned long us = pulseIn(PIN_ECHO, HIGH, ECO_TIMEOUT_US);
  if (us == 0) return -1;
  return us / 58.0;   // ida e volta do som: 58 us por cm
}

// Chamada pelo timer a cada ALARME_TICK_MS: mede a distancia e cuida das
// tres etapas do alarme.
void verificarAlarme() {
  unsigned long agora = millis();

  float d = medirDistanciaCm();
  distUltima = d;
  distLeituras = distLeituras + 1;
  if (d >= 0 && d < distMin) distMin = d;

  static int seguidasPerto = 0;
  seguidasPerto = (d >= 0 && d <= DISTANCIA_ALARME_CM) ? seguidasPerto + 1 : 0;
  bool objetoPerto = seguidasPerto >= LEITURAS_PERTO;

  // Tres etapas: lendo o sensor -> disparado (2 s) -> pausa sem ler (1,5 s).
  if (alarmeDisparado) {
    if ((long)(agora - fimDaEtapa) >= 0) {
      alarmeDisparado = false;
      escreverAlarme(false);
      alarmeParou = true;
      alarmeEmPausa = true;
      fimDaEtapa = agora + ALARME_PAUSA_MS;
    }
  } else if (alarmeEmPausa) {
    if ((long)(agora - fimDaEtapa) >= 0) alarmeEmPausa = false;
  } else if (objetoPerto) {
    distDoDisparo = d;
    alarmeDisparado = true;
    escreverAlarme(true);
    fimDaEtapa = agora + ALARME_DURACAO_MS;
    disparoNovo = true;
  }
}

// ─── Sensores ────────────────────────────────────────────────

// Chamada pelo timer a cada BOTAO_TICK_MS. Troca o estado "estavel" do botao
// so quando a leitura nova se repete BOTAO_LEITURAS_ESTAVEIS vezes seguidas;
// conta um aperto na passagem de solto para apertado.
void lerBotao() {
  static bool apertadoEstavel = false;
  static int  repeticoes      = 0;
  bool apertadoAgora = digitalRead(PIN_BOTAO) == LOW;
  if (apertadoAgora == apertadoEstavel) {
    repeticoes = 0;
    return;
  }
  if (++repeticoes >= BOTAO_LEITURAS_ESTAVEIS) {
    apertadoEstavel = apertadoAgora;
    repeticoes = 0;
    if (apertadoEstavel) botaoApertado = true;
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

  // Botao. A flag e ligada pelo timer (lerBotao); aqui ela so vira evento. Com o
  // buffer cheio a flag fica ligada e o evento sai no proximo ciclo.
  if (botaoApertado && eventCount < 4) {
    logar("Botao apertado");
    if (!eventoJaPendente("botao_fisico")) {
      events[eventCount++] = "botao_fisico";
    }
    botaoApertado = false;
  }

  // Alarme: o timer ja ligou ou desligou LED e buzzer; aqui so registra e
  // avisa o backend (que pode ter outras automacoes de presenca).
  if (disparoNovo) {
    disparoNovo = false;
    logar("Objeto a " + String(distDoDisparo, 1) + " cm: alarme disparado");
    if (!eventoJaPendente("presenca") && eventCount < 4) {
      events[eventCount++] = "presenca";
    }
  }
  if (alarmeParou) {
    alarmeParou = false;
    logar("Alarme desligado (pausa de 1,5 s)");
  }

  // Distancia: uma linha por ciclo com a ultima medida e a menor do periodo.
  if (distLeituras > 0) {
    float ultima = distUltima, menor = distMin;
    int n = distLeituras;
    distMin = 9999;
    distLeituras = 0;
    if (ultima < 0 && menor > 9000) {
      logar("Distancia: nada ate " + String((int) DISTANCIA_MAX_CM) + " cm (" + String(n) + " leituras)");
    } else {
      logar("Distancia: " + (ultima < 0 ? String("nada") : String(ultima, 1) + " cm") +
            " (menor " + (menor > 9000 ? String("-") : String(menor, 1) + " cm") +
            ", " + String(n) + " leituras)");
    }
  }

  // Luminosidade. O timer (lerLuz) ja ligou ou desligou os LEDs externos
  // na passagem de claro para escuro e de volta; aqui so registra.
  if (escureceuNovo) {
    escureceuNovo = false;
    logar("Escureceu (leitura " + String(leituraEscureceu) + "): LEDs externos ligados");
    // O backend ainda recebe o evento, para outras automacoes de "Escureceu".
    if (!eventoJaPendente("luminosidade") && eventCount < 4) {
      events[eventCount++] = "luminosidade";
    }
  }
  if (clareouNovo) {
    clareouNovo = false;
    logar("Clareou (leitura " + String(leituraClareou) + "): LEDs externos desligados");
  }

  // Uma linha por ciclo com a ultima leitura e a faixa desde a linha anterior
  // (o timer le 5 vezes por segundo; o serial so e escrito entre os envios).
  if (luzAmostras > 0) {
    logar("Luminosidade: " + String(luzUltima) + " (min " + String(luzMin) + ", max " +
          String(luzMax) + ", " + String(luzAmostras) + " leituras)");
    luzMin = 1024;
    luzMax = 0;
    luzAmostras = 0;
  }

  // Nivel dos pinos: sempre que algum muda, e de tempos em tempos.
  String pinos = linhaDePinos();
  if (pinos != ultimaLinhaDePinos || millis() - ultimoLogPinos >= PINOS_LOG_INTERVALO_MS) {
    logar(pinos);
    ultimaLinhaDePinos = pinos;
    ultimoLogPinos     = millis();
  }
}

// Chamada pelo timer a cada LDR_TICK_MS. Como no Uno, os LEDs externos seguem
// o LDR o tempo todo: escuro (800 ou menos) acende, claro (820 ou mais)
// apaga, entre os dois mantem. O site so mostra o estado (decisao do grupo
// em 03/10), por isso o pino e reescrito a cada leitura.
void lerLuz() {
  int leitura = analogRead(PIN_LDR);
  luzUltima = leitura;
  if (leitura < luzMin) luzMin = leitura;
  if (leitura > luzMax) luzMax = leitura;
  luzAmostras = luzAmostras + 1;

  bool escuroAgora = LDR_ESCURO_E_MAIOR ? (leitura >= LDR_LIMITE_ESCURO)
                                        : (leitura <= LDR_LIMITE_ESCURO);
  bool claroDeNovo = LDR_ESCURO_E_MAIOR ? (leitura < LDR_LIMITE_ESCURO - LDR_HISTERESE)
                                        : (leitura > LDR_LIMITE_ESCURO + LDR_HISTERESE);
  if (escuroAgora && !estaEscuro) {
    estaEscuro = true;
    leituraEscureceu = leitura;
    escureceuNovo = true;
  } else if (claroDeNovo && estaEscuro) {
    estaEscuro = false;
    leituraClareou = leitura;
    clareouNovo = true;
  }
  digitalWrite(PIN_LED_EXTERNA, estaEscuro ? HIGH : LOW);
}

// ─── Aplicacao de comandos ───────────────────────────────────

// LED: HIGH liga, LOW desliga. Rele: o contrario (ve RELE_LIGADO), e para
// desligar o pino fica solto (ve RELE_DESLIGA_SOLTANDO_O_PINO).
void escreverDispositivo(const DevicePin& d, bool state) {
  if (d.rele && !state && RELE_DESLIGA_SOLTANDO_O_PINO) {
    pinMode(d.pin, INPUT);
    return;
  }
  int nivel = d.rele ? (state ? RELE_LIGADO : RELE_DESLIGADO)
                     : (state ? HIGH : LOW);
  digitalWrite(d.pin, nivel);   // nivel antes do pinMode: sem pulso no rele
  pinMode(d.pin, OUTPUT);
}

// Nivel de um pino para o log. Pino de rele solto aparece como "solto".
String nivelDoPino(int pin, bool rele) {
  String nivel = digitalRead(pin) == HIGH ? "HIGH" : "LOW";
  if (rele && RELE_DESLIGA_SOLTANDO_O_PINO && !estadoLuzInterna) nivel += " (solto)";
  return nivel;
}

// Uma linha com o nivel de todos os pinos usados, para conferir a fiacao.
String linhaDePinos() {
  return "Pinos: D7 rele=" + nivelDoPino(PIN_RELE_INTERNA, true) +
         " | D6 ext=" + nivelDoPino(PIN_LED_EXTERNA, false) +
         " | D0 led alarme=" + nivelDoPino(PIN_LED_ALARME, false) +
         " | D5 buzzer=" + nivelDoPino(PIN_BUZZER, false) +
         " | D1 botao=" + nivelDoPino(PIN_BOTAO, false) +
         " | D2 echo=" + nivelDoPino(PIN_ECHO, false);
}

void applyCommand(const char* device, bool state) {
  for (int i = 0; i < DEVICE_COUNT; i++) {
    if (strcmp(devicePins[i].name, device) == 0) {
      escreverDispositivo(devicePins[i], state);
      *(devicePins[i].stateVar) = state;
      logar(String("Comando aplicado: ") + device + (state ? " = LIGADO" : " = DESLIGADO") +
            " (pino " + nivelDoPino(devicePins[i].pin, devicePins[i].rele) + ")");
      return;
    }
  }
  if (strcmp(device, "luz_externa") == 0) {
    logar("Comando para a luz externa ignorado: ela e controlada pelo LDR");
    return;
  }
  if (strcmp(device, "alarme") == 0) {
    logar("Comando para o alarme ignorado: ele e controlado pelo sensor de presenca");
    return;
  }
  logar(String("Comando ignorado, dispositivo desconhecido: ") + device);
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
    logar("Falha ao iniciar a conexao HTTP");
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
  devices["alarme"] = (bool) alarmeDisparado;
  devices["luz_externa"] = (bool) estaEscuro;

  JsonArray eventsArray = doc["events"].to<JsonArray>();
  for (int i = 0; i < eventCount; i++) {
    eventsArray.add(events[i]);
  }

  // Linhas do serial guardadas desde o ultimo sync confirmado. Quantas iam
  // neste envio: se novas chegarem durante o POST, ficam para o proximo.
  int logsEnviados = logCount;
  JsonArray logArray = doc["log"].to<JsonArray>();
  for (int i = 0; i < logsEnviados; i++) {
    logArray.add(logs[i]);
  }

  String body;
  serializeJson(doc, body);

  int status = http.POST(body);

  if (status == 200) {
    String payload = http.getString();

    JsonDocument resposta;
    DeserializationError erro = deserializeJson(resposta, payload);

    if (erro) {
      logar(String("Resposta invalida do backend: ") + erro.c_str());
      // Nao zera eventCount aqui: o corpo veio corrompido, entao nao ha
      // garantia de que o backend processou os eventos. Mantem no buffer
      // para tentar de novo no proximo ciclo.
    } else {
      // O backend ja recebeu estas linhas: tira do buffer as que foram.
      for (int i = logsEnviados; i < logCount; i++) logs[i - logsEnviados] = logs[i];
      logCount -= logsEnviados;

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
    logar("Erro no sync. Codigo HTTP: " + String(status));
    // eventCount preservado para reenviar no proximo ciclo
  }

  http.end();
}

// ─── setup / loop ────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println();
  logar("=== Casa Inteligente - iniciando ===");

  // Tudo comeca desligado. O nivel e escrito ANTES do pinMode para o rele
  // nao dar um clique (pulso de LOW) no instante em que o pino vira saida.
  for (int i = 0; i < DEVICE_COUNT; i++) {
    escreverDispositivo(devicePins[i], false);
  }
  digitalWrite(PIN_LED_EXTERNA, LOW);
  pinMode(PIN_LED_EXTERNA, OUTPUT);   // controlado pelo LDR (lerLuz)
  pinMode(PIN_LED_ALARME, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  escreverAlarme(false);

  pinMode(PIN_ECHO, INPUT);
  digitalWrite(PIN_TRIG, LOW);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_BOTAO, INPUT_PULLUP);
  timerBotao.attach_ms(BOTAO_TICK_MS, lerBotao);
  timerAlarme.attach_ms(ALARME_TICK_MS, verificarAlarme);
  timerLuz.attach_ms(LDR_TICK_MS, lerLuz);

  connectWiFi();

  // O ESP8266 nao guarda os certificados raiz do Railway. Para o escopo
  // deste TCC aceitamos o certificado sem validar. Em producao real,
  // o correto seria fixar a impressao digital do certificado.
  // Chamado uma unica vez aqui (nao a cada sync) porque secureClient
  // agora e uma instancia global de longa duracao (ve declaracao acima).
  secureClient.setInsecure();
}

void loop() {
  // Se o WiFi caiu, tenta reconectar e pula este ciclo. As luzes ficam no
  // ultimo estado, e o alarme segue funcionando pelo timer.
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
