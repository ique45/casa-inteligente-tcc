// Modelo dos dados de rede e de acesso do firmware.
//
// Copie este arquivo para segredos.h, na mesma pasta, e preencha os valores.
// O segredos.h fica fora do git (.gitignore): ele tem a senha do WiFi e o
// token que o backend aceita como se fosse a placa, e quem tivesse o token
// poderia mandar estados e eventos falsos para a conta.
#pragma once

#define WIFI_SSID_REAL     "NomeDaSuaRede"
#define WIFI_PASSWORD_REAL "SenhaDaSuaRede"
#define UID_REAL           "cole-aqui-o-uid-do-firebase"
// O mesmo valor da variavel ARDUINO_SECRET configurada no Railway.
#define TOKEN_REAL         "cole-aqui-o-mesmo-valor-de-ARDUINO_SECRET"
