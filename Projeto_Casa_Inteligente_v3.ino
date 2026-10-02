/*  #############################
    ####  CASA INTELIGENTE ######
    #### 1o AMS - DS 2024  ######
    #############################
*/

// declarando Vars e const
const int buzzer = 11;        // pino buzzer
const int ledAlarmePin = 11;  // pino LED alarme
const int pinLEDext = 8;      //pino LED externo
const int pushButton = 7;     // pino pushButton
const int ledInterno = 13;    // pin LEDs internos
const int sensorUVPin = 12;   // pin SensorUV
bool estadoled = 0;           // var booleana do estado do led (pushbutton)



void setup() {
  Serial.begin(9600);  //inicializa a serial em 9600bps
  pinMode(buzzer, OUTPUT);
  pinMode(ledAlarmePin, OUTPUT);
  pinMode(pinLEDext, OUTPUT);
  pinMode(pushButton, INPUT_PULLUP);
  pinMode(ledInterno, OUTPUT);
  pinMode(sensorUVPin, INPUT);
}

void loop() {
  // LEDs Internos
  if (digitalRead(pushButton) == LOW) {
    estadoled = !estadoled;  //troca o estado do LED
    digitalWrite(ledInterno, estadoled);
    while (digitalRead(pushButton) == LOW)
      ;
    delay(100);
  }

  //LEDs externos
  int LDR = analogRead(A0);  //lê porta Analogica A0 => LDR
  Serial.print("Luminosidade: ");
  Serial.println(LDR);  // imprime saida LDR na Serial

  if (LDR < 650)                    //se o LDR tiver luminosidade menor que 800 (varia de 1 a 1024)
    digitalWrite(pinLEDext, HIGH);  // liga os LEDs externos
  else
    digitalWrite(pinLEDext, LOW);  //senao desliga os LEDs externos
  delay(500);

  //SensorUV
  if (digitalRead(sensorUVPin) == LOW) {
    Serial.println("LOW = ZERO = DETECTADO");
    digitalWrite(buzzer, HIGH);
    digitalWrite(ledAlarmePin, HIGH);
  } else {
    Serial.println("HIGH = HUM = NAO DETECADO");
    digitalWrite(buzzer, LOW);
    digitalWrite(ledAlarmePin, LOW);
  }
  delay(100);
}
