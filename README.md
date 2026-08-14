# Casa Inteligente

Sistema de automação residencial voltado à **acessibilidade**, desenvolvido como
Trabalho de Conclusão de Curso da turma 3 AMS de Desenvolvimento de Sistemas.

O objetivo é dar mais autonomia a idosos e pessoas com mobilidade reduzida,
permitindo controlar luz, ventilador, portão e alarme pelo site, por comando de
voz ou automaticamente, a partir de sensores de presença e temperatura.

## Arquitetura

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐     ┌───────────┐
│     Site     │◀───▶│     Firebase     │◀───▶│    Backend   │◀───▶│  ESP8266  │
│ HTML/CSS/JS  │     │ Auth · Firestore │     │   Express    │     │  NodeMCU  │
│              │     │       RTDB       │     │  (Railway)   │     │  + reles  │
└──────────────┘     └──────────────────┘     └──────────────┘     └───────────┘
```

1. O usuário aciona um dispositivo no site; o comando é gravado no Realtime Database.
2. O ESP8266 consulta o backend a cada 2 segundos, enviando temperatura, presença
   e o estado atual dos relés.
3. O backend responde com os comandos pendentes — do site e das automações — e o
   ESP8266 aciona os relés. A temperatura recebida é gravada no Realtime Database
   (`arduino_status/{uid}`).
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

Depois abra <http://localhost:8080> no navegador.

> O site **precisa** ser aberto por esse servidor. Abrir os arquivos `.html`
> com duplo clique não funciona: o Firebase Authentication não opera sob o
> protocolo `file://`.

> Use `localhost`, não `127.0.0.1`. O login com Google (`signInWithPopup`)
> só funciona em domínios autorizados no Firebase, e `localhost` é
> autorizado por padrão — `127.0.0.1` é um domínio distinto e normalmente
> não está na lista. O login por e-mail/senha funciona nos dois, o que
> pode mascarar o problema.

O `server.js` só serve os arquivos do próprio site: páginas HTML e arquivos
`.css`/`.js`/`.png`/`.jpg`/`.svg`/`.ico` na raiz do projeto, além do conteúdo
das pastas `css/` e `js/`. Qualquer outro caminho — incluindo `backend/.env`
e a chave de serviço do Firebase — recebe `403 Forbidden`.

**Modo de preview.** Abrir qualquer página com `?preview=1` na URL (ex.:
`http://localhost:8080/dashboard.html?preview=1`) injeta um mock do Firebase
que simula um usuário autenticado com dados vazios, sem precisar de login
real. Existe só para permitir testes visuais rápidos das telas; funciona
apenas no servidor local (`server.js`) e não expõe nem lê nenhum dado real.

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
│   ├── firebase-config.js  Inicialização do Firebase (Auth, Firestore, RTDB)
│   ├── profile.js          Seleção de perfil de acessibilidade
│   ├── dashboard.js        Controle dos dispositivos em tempo real
│   ├── automation.js       Editor de automações
│   ├── history.js          Listagem do histórico
│   ├── voice.js            Comandos de voz
│   └── devices.js          Definições compartilhadas de dispositivos
├── backend/                API Express publicada no Railway
│   ├── routes/arduino.js   Endpoint POST /arduino/sync
│   ├── services/           Automações e histórico
│   └── __tests__/          18 testes automatizados
├── firmware/esp8266/       Firmware do NodeMCU
├── firestore.rules         Regras de segurança do Firestore
├── database.rules.json     Regras de segurança do Realtime Database
└── docs/                   Specs, planos e capturas de tela
```

## Segurança dos dados

O acesso aos bancos é controlado por regras publicadas no Firebase, versionadas
em `firestore.rules` e `database.rules.json`. O princípio é simples: o UID vem do
Firebase Authentication e não pode ser forjado pelo navegador, então cada pessoa
só lê e escreve os próprios dados — qualquer tentativa de acessar dados de outra
conta é recusada pelo servidor, não pela interface.

Os caminhos `devices/` e `arduino_status/` são somente leitura para o navegador,
porque quem escreve neles é o backend, que usa o Admin SDK e não passa pelas
regras.

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
| Backend + deploy | Concluído — 18 testes passando |
| Firmware ESP8266 | Escrito, **não testado em hardware** |
| Montagem física | Pendente — o NodeMCU ainda não foi adquirido |

## Limitações conhecidas

- **Sem hardware.** O NodeMCU ainda não foi comprado, então o firmware nunca foi
  executado em uma placa real. Enquanto não houver uma placa conectada, o
  dashboard indica que o hardware não está conectado e os comandos ficam
  guardados no Realtime Database, aguardando.
- **Automações por horário não disparam.** O site permite criá-las e o backend
  aceita o gatilho, mas nenhuma camada gera esse evento — não existe agendador no
  backend nem relógio no firmware. Apenas os gatilhos de presença e temperatura
  funcionam de ponta a ponta. Documentado em
  `docs/superpowers/specs/2026-05-29-firmware-esp8266-design.md`.
- **Temperatura gravada, mas não exibida.** O backend persiste a leitura em
  `arduino_status/{uid}`, mas nenhuma tela do site lê ou mostra esse valor hoje.
- **Relé do alarme no GPIO15 (D8) não validado em hardware.** Esse pino precisa
  estar em LOW no boot do ESP8266, e como `RELAY_ON = LOW`, o relé fica energizado
  desde o power-on até o `setup()` rodar; dependendo do módulo de relé usado, isso
  também pode impedir o boot. Precisa ser validado assim que o hardware for
  montado — ver comentário em `firmware/esp8266/casa_inteligente.ino`.

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
