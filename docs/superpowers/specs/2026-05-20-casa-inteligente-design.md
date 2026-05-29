# Casa Inteligente — Design Spec

**Data:** 2026-05-20  
**Projeto:** TCC — Sistema de Automação Residencial para Acessibilidade  
**Turma:** 3 AMS Desenvolvimento de Sistemas

---

## 1. Visão Geral

Sistema de automação residencial voltado para pessoas com mobilidade reduzida, deficiência visual e outras necessidades de acessibilidade. Permite controlar dispositivos da casa (luzes, portão, ventilador, alarme) por voz, botão no site/app ou sensores — tudo configurável por uma interface web acessível de qualquer dispositivo.

---

## 2. Arquitetura

### Stack

| Camada | Tecnologia | Função |
|--------|-----------|--------|
| Frontend | HTML/CSS/JS (site existente) + novas páginas | Interface web — login, dashboard, configurações |
| Backend | Node.js + Express (Railway) | API REST, autenticação, ponte com Firebase |
| Auth | Firebase Authentication | Login por email/senha e Google |
| Banco de dados | Firestore | Perfis, automações, histórico |
| Estado em tempo real | Firebase Realtime Database | Estado ao vivo dos dispositivos (ON/OFF) |
| Hardware WiFi | ESP8266 | Comunica com Firebase via HTTPS/REST |
| Hardware principal | Arduino Mega | Controla GPIO — sensores e atuadores |
| Hospedagem backend | Railway (free tier) | Deploy contínuo via GitHub |

### Fluxo de dados

**Comando pelo site → dispositivo:**
1. Usuário aperta botão no site
2. Firebase Realtime DB atualizado (`devices/{userId}/{deviceId}/state = ON`)
3. ESP8266 detecta mudança via Firebase listener
4. ESP8266 envia sinal Serial ao Arduino Mega
5. Arduino aciona o relé/atuador correspondente

**Sensor físico → site:**
1. Sensor detecta evento (presença, temperatura, etc.)
2. Arduino Mega processa e envia via Serial ao ESP8266
3. ESP8266 atualiza Firebase Realtime DB
4. Site recebe atualização em tempo real e exibe no dashboard
5. Evento salvo no Firestore como registro de histórico

### Comunicação Arduino ↔ ESP8266
- Protocolo: Serial (UART) com mensagens JSON simples
- Exemplo: `{"cmd":"relay","pin":2,"state":1}`
- ESP8266 funciona como ponte WiFi/Firebase — Arduino Mega faz o controle físico

---

## 3. Telas do Sistema

### 3.1 Login / Cadastro
- Email + senha ou Google OAuth
- Visual no tema do site (fundo escuro, roxo)
- Link para criar conta

### 3.2 Seleção de Perfil (pós-login)
Aparece após login, antes do dashboard.

**Parte 1 — Cards de perfil (multi-seleção):**
- Perfis pré-definidos: Mobilidade Reduzida, Deficiência Visual, Idoso
- Usuário pode selecionar um ou mais perfis
- Card com ícone, nome, e tipos de gatilho do perfil
- Opção "+ Criar perfil" personalizado

**Parte 2 — Toggles de funções:**
- Gerados a partir dos perfis selecionados
- Cada função (voz, botão, presença, etc.) tem toggle ON/OFF individual
- Permite ajuste fino — ativar função de outro perfil sem selecionar o perfil todo
- Configuração salva na conta automaticamente

### 3.3 Dashboard Principal
- Status do Arduino (online/offline + último sync)
- Perfil ativo atual
- Controles rápidos: botões por dispositivo com estado atual (ON/OFF)
- Histórico recente (últimas 3–5 ativações com timestamp e origem)
- Link para histórico completo

### 3.4 Editor de Automação
Fluxo em passos, campos aparecem conforme seleção anterior:

**1 — Dispositivo:** Luz, Portão, Ventilador, Alarme (extensível)

**2 — Nome:** Campo de texto livre para identificação (ex: "Luz Cozinha", "Luz Sala"). Aparece no dashboard e no histórico. Tooltip explicativo ("ⓘ") ao lado do label.

**3 — Gatilho:** Filtrado por dispositivo:
- Luz → Voz, Botão (no site), Presença
- Portão → Voz, Botão (no site), Presença
- Ventilador → Voz, Botão (no site), Temperatura, Horário
- Alarme → Botão (no site), Presença, Horário

> **Botão** = botão na tela do site/app no celular, não um botão físico no Arduino.

**4 — Comando** *(aparece somente se gatilho = Voz):*
- Sugestões pré-definidas: "Ligar luz", "Acender luz", "Ativar luz"
- Campo editável com o comando exato que a pessoa vai falar
- Tooltip explicativo disponível

**5 — Ação:** Alternar / Só ligar / Só desligar

**Prévia em tempo real:** mostra o resumo da automação conforme o usuário preenche.

### 3.5 Histórico de Ativações
- Tabela com filtro por data e por tipo de ação
- Colunas: Ação, Disparado por (🎤 voz / 🔘 botão / 👁️ presença / ⏰ horário / 🌡️ temperatura), Data/hora
- Dados salvos no Firestore

---

## 4. Modelo de Dados (Firestore)

```
users/{userId}
  ├── email, name, createdAt
  ├── activeProfiles: [string]        // perfis selecionados
  └── activeToggles: {voz: true, ...} // toggles individuais

automations/{userId}/{automationId}
  ├── deviceType: "luz" | "portao" | "ventilador" | "alarme"
  ├── deviceName: "Luz Cozinha"
  ├── trigger: "voz" | "botao" | "presenca" | "horario" | "temperatura"
  ├── voiceCommand: "Acender luz Cozinha"  // só se trigger = voz
  ├── action: "toggle" | "on" | "off"
  └── enabled: true

history/{userId}/{eventId}
  ├── automationId, deviceName, deviceType
  ├── triggeredBy: "voz" | "botao" | "presenca" | "horario" | "temperatura" | "site"
  ├── action: "on" | "off"
  └── timestamp: Firestore Timestamp

devices/{userId}/{deviceId}           // Realtime Database
  ├── state: "on" | "off"
  └── lastUpdated: timestamp
```

---

## 5. Firmware NodeMCU ESP8266

> ⚠️ **Arquitetura revisada (2026-05-29):** A abordagem original com Arduino Mega + ESP8266 via Serial foi descartada. O hardware final usa apenas **NodeMCU ESP8266**, que controla os relés e sensores diretamente. Ver spec detalhada: `docs/superpowers/specs/2026-05-29-firmware-esp8266-design.md`

### Estratégia atual
- Firmware único no NodeMCU ESP8266 (arquivo `.ino`)
- Sincroniza com o backend via HTTP POST a cada 2 segundos (`/arduino/sync`)
- Toda configuração (WiFi, UID, TOKEN) fica num bloco no topo do arquivo
- Relés (Luz, Ventilador, Portão, Alarme) + PIR + DHT11 conectados diretamente ao NodeMCU

---

## 6. Gatilho de Voz

- Reconhecimento de voz via **Web Speech API** (nativa no Chrome/Android)
- Funciona no próprio browser do celular, sem app extra
- O site escuta o microfone, reconhece a frase e compara com as automações do usuário
- Se bater com um `voiceCommand` cadastrado → envia comando ao Firebase

---

## 7. Escopo do Primeiro Protótipo (TCC)

Funcionalidades obrigatórias para a apresentação:
- [ ] Login/cadastro funcionando (Firebase Auth)
- [ ] Tela de seleção de perfil com cards + toggles
- [ ] Dashboard com controles rápidos e histórico recente
- [ ] Editor de automações completo
- [ ] Histórico de ativações com filtros
- [ ] Pelo menos 1 dispositivo físico funcionando end-to-end (ex: luz via botão no site)
- [ ] Pelo menos 1 automação por voz funcionando
- [ ] Firmware NodeMCU ESP8266 funcional (ver spec: `docs/superpowers/specs/2026-05-29-firmware-esp8266-design.md`)

Dispositivos físicos a definir conforme hardware disponível.

---

## 8. O que foi deixado em aberto

- Lista definitiva de dispositivos físicos (depende do hardware adquirido)
- Número de pinos/relés no NodeMCU (definido na spec do firmware)
- Módulo de voz específico (Web Speech API no browser é a abordagem inicial)
- Design visual final das telas (seguirá o tema roxo escuro do site existente)
