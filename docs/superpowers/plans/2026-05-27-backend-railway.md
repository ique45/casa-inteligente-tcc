# Backend Railway — Node.js + Express Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o servidor Node.js/Express hospedado no Railway que faz ponte entre o ESP8266/Arduino e o Firebase, além de executar automações disparadas pelo hardware.

**Architecture:** O ESP8266 faz `POST /arduino/sync` a cada N segundos enviando o estado atual dos dispositivos e eventos de sensor. O backend atualiza o Firebase Realtime DB com os estados reais, busca comandos pendentes do site (escritos pelo `dashboard.js` em `rtdb/commands/{uid}`), executa automações do Firestore disparadas pelos eventos (`presenca`, `temperatura`, `horario`), registra no histórico e retorna os comandos ao Arduino. O site já escuta `rtdb/devices/{uid}` para atualizar a UI em tempo real.

**Tech Stack:** Node.js 20+, Express 4, firebase-admin SDK, dotenv, cors, jest (testes)

---

## Estrutura de Arquivos

```
backend/
  server.js              ← entry point: inicializa Express, monta rotas
  firebase.js            ← inicializa Firebase Admin SDK (singleton)
  routes/
    arduino.js           ← POST /arduino/sync, GET /health
  services/
    automation.js        ← busca automações do Firestore e executa ações
    history.js           ← grava entradas no histórico do Firestore
  __tests__/
    automation.test.js   ← testa resolução de ação (toggle/on/off)
    arduino.test.js      ← testa handler da rota /arduino/sync
  .env.example           ← template de variáveis de ambiente
  package.json
  Procfile               ← web: node server.js (para Railway)
```

**Mudança no frontend** (1 linha):
- `js/dashboard.js:131` — troca `rtdb.ref('devices/...')` por `rtdb.ref('commands/...')`

---

## Estrutura do Firebase (referência)

**Firestore:**
```
automations/{uid}/items/{id}  →  { deviceType, deviceName, trigger, action, voiceCommand?, enabled, createdAt }
users/{uid}/history/{id}      →  { device, deviceId, trigger, state, timestamp }
```

**Realtime DB:**
```
devices/{uid}/{deviceId}      →  { state: bool }        ← backend escreve estado real
commands/{uid}/{deviceId}     →  { state: bool, ts: num } ← site escreve comandos pendentes
arduino_status/{uid}          →  { online: bool, lastSeen: num }
```

---

## Task 1: Setup do projeto (package.json, .env, Procfile)

**Files:**
- Create: `backend/package.json`
- Create: `backend/.env.example`
- Create: `backend/Procfile`

- [ ] **Step 1: Criar package.json**

```json
{
  "name": "casa-inteligente-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "firebase-admin": "^12.1.0"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

- [ ] **Step 2: Criar .env.example**

```
# Copie para .env e preencha os valores reais
ARDUINO_SECRET=troque-por-segredo-forte
FIREBASE_PROJECT_ID=casa-inteligente-tcc
FIREBASE_DATABASE_URL=https://casa-inteligente-tcc-default-rtdb.firebaseio.com
PORT=3000

# Cole o JSON inteiro da chave de serviço do Firebase (sem quebras de linha)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
```

- [ ] **Step 3: Criar Procfile**

```
web: node server.js
```

- [ ] **Step 4: Instalar dependências**

```bash
cd backend
npm install
```

Esperado: `node_modules/` criado sem erros.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/.env.example backend/Procfile
git commit -m "chore: setup inicial do backend Node.js"
```

---

## Task 2: Firebase Admin SDK

**Files:**
- Create: `backend/firebase.js`

- [ ] **Step 1: Escrever o teste (que vai falhar)**

Crie `backend/__tests__/firebase.test.js`:

```js
// Só verifica que o módulo exporta auth, db e rtdb sem explodir
test('firebase exports auth, db e rtdb', () => {
  // Seta variáveis de ambiente mínimas antes de importar
  process.env.FIREBASE_PROJECT_ID = 'test-project';
  process.env.FIREBASE_DATABASE_URL = 'https://test-project-default-rtdb.firebaseio.com';
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
    type: 'service_account',
    project_id: 'test-project',
    private_key_id: 'key123',
    private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA2a2rwplBQLF29amygykEMmYz0+Kcj3bKBp29B2rCgCvOoMIS\nFm4Mzq15EYGqBqFAFVGTPUE7fHSYH4HMrTR+S7bX6FJ6hFVaFLGDVZkS5IGMN5V\nLi1UYLqCLMOuUMDKDUGMTxQRSmBOPDLKUObkPZ8lq2zLCFcMnKZRSM0oGQqzIlp\nja7/UKkO1EIyIXbHrDKFExKXtjJhbHEFMdpNIZs7sTI9BFrPGlxzfYqXC4RRMGR\nPL7BLyqbBkSQIlEEwb1mxs/H0CqaU/LFbDPmxcRuXLzl4lQHnG6qC6BPQO0fIT\nqPkqB0Y0MNKB5A4l2jAqbXEyTl9qLIAXv4WzYwIDAQABAoIBAHlWEL+MIEqKYMzx\nQRSFOVBDWbREBqsb3DLFsHLGiPvMCgG6b3sNJBvFzOLaZrqSf3W5FbPqxnlLlqQ\nCHFN5FBpQ3J2q2MzMxVYIUXXY0GEDjDLHq2vJB/IcP0tFj/3lqdT5jPaZsT7LlQ\nabjCHd0VV5LqP6VHKR6n8v5L9y0r0t5J4Z6b1W9cQjfZ7lN3c8G3VH1yc9j0qI\nwQaK7pqHe5mO9y5T4bqb0mAE0k5pNXYWTERH3rMX0k7b1e0X7Q3X9V0lRQ3J5Q\nSVB8qJN0xF2c0GpOTNmBmHNpqHBbFJ4Z6b1W9cQjfZ7lN3c8G3VH1yc9j0qIwQ\naK7pqHe5mO9y5T4bqb0mAE0k5pNXYWTERH3rMX0k7b1e0X7Q3X9V0lRQ3J5QSVB\n8qJN0xF2c0GpOTNmBmHNpqHBbFJ4=\n-----END RSA PRIVATE KEY-----\n',
    client_email: 'test@test-project.iam.gserviceaccount.com',
    client_id: '123',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token'
  });

  // Limpa cache do require para forçar re-inicialização
  jest.resetModules();
  const { db, rtdb } = require('../firebase');
  expect(db).toBeDefined();
  expect(rtdb).toBeDefined();
  expect(typeof db.collection).toBe('function');
  expect(typeof rtdb.ref).toBe('function');
});
```

- [ ] **Step 2: Rodar o teste — confirmar que FALHA**

```bash
cd backend && npm test -- --testPathPattern=firebase
```

Esperado: FAIL com `Cannot find module '../firebase'`

- [ ] **Step 3: Criar backend/firebase.js**

```js
require('dotenv').config();
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db   = admin.firestore();
const rtdb = admin.database();

module.exports = { db, rtdb, admin };
```

- [ ] **Step 4: Rodar o teste — confirmar que PASSA**

```bash
cd backend && npm test -- --testPathPattern=firebase
```

Esperado: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/firebase.js backend/__tests__/firebase.test.js
git commit -m "feat: inicialização do Firebase Admin SDK"
```

---

## Task 3: Serviço de histórico

**Files:**
- Create: `backend/services/history.js`

- [ ] **Step 1: Criar backend/services/history.js**

Não tem lógica complexa — só uma função que grava. Sem teste separado; será coberto pelos testes de integração da rota.

```js
const { db, admin } = require('../firebase');

/**
 * Grava uma entrada no histórico de ativações do usuário.
 * @param {string} uid
 * @param {object} entry  { deviceId, device, trigger, state }
 */
async function logHistory(uid, { deviceId, device, trigger, state }) {
  await db
    .collection('users').doc(uid)
    .collection('history').add({
      deviceId,
      device,
      trigger,
      state,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
}

module.exports = { logHistory };
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/history.js
git commit -m "feat: serviço de histórico no Firestore"
```

---

## Task 4: Serviço de automações

**Files:**
- Create: `backend/services/automation.js`
- Create: `backend/__tests__/automation.test.js`

- [ ] **Step 1: Escrever os testes (vão falhar)**

Crie `backend/__tests__/automation.test.js`:

```js
const { resolveAction } = require('../services/automation');

describe('resolveAction', () => {
  test('toggle: estado false → retorna true', () => {
    expect(resolveAction('toggle', false)).toBe(true);
  });

  test('toggle: estado true → retorna false', () => {
    expect(resolveAction('toggle', true)).toBe(false);
  });

  test('on: sempre retorna true', () => {
    expect(resolveAction('on', false)).toBe(true);
    expect(resolveAction('on', true)).toBe(true);
  });

  test('off: sempre retorna false', () => {
    expect(resolveAction('off', true)).toBe(false);
    expect(resolveAction('off', false)).toBe(false);
  });

  test('ação desconhecida: retorna null', () => {
    expect(resolveAction('invalido', false)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar os testes — confirmar que FALHAM**

```bash
cd backend && npm test -- --testPathPattern=automation
```

Esperado: FAIL com `Cannot find module '../services/automation'`

- [ ] **Step 3: Criar backend/services/automation.js**

```js
const { db, rtdb } = require('../firebase');
const { logHistory } = require('./history');

/**
 * Resolve o estado final para uma ação dada o estado atual.
 * @param {'toggle'|'on'|'off'} action
 * @param {boolean} currentState
 * @returns {boolean|null}
 */
function resolveAction(action, currentState) {
  if (action === 'toggle') return !currentState;
  if (action === 'on')     return true;
  if (action === 'off')    return false;
  return null;
}

/**
 * Busca automações ativas do usuário para um gatilho específico
 * e executa cada uma: atualiza RTDB + grava histórico.
 *
 * @param {string} uid        Firebase user UID
 * @param {string} trigger    'presenca' | 'temperatura' | 'horario'
 */
async function executeAutomations(uid, trigger) {
  const snap = await db
    .collection('automations').doc(uid)
    .collection('items')
    .where('trigger', '==', trigger)
    .where('enabled', '==', true)
    .get();

  if (snap.empty) return;

  const results = [];

  for (const doc of snap.docs) {
    const auto  = doc.data();
    const deviceRef = rtdb.ref(`devices/${uid}/${auto.deviceType}`);
    const deviceSnap = await deviceRef.once('value');
    const currentState = (deviceSnap.val() || {}).state === true;
    const newState = resolveAction(auto.action, currentState);

    if (newState === null) continue;

    await deviceRef.set({ state: newState });
    await logHistory(uid, {
      deviceId: auto.deviceType,
      device:   auto.deviceName,
      trigger,
      state:    newState
    });

    results.push({ device: auto.deviceType, state: newState });
  }

  return results;
}

module.exports = { resolveAction, executeAutomations };
```

- [ ] **Step 4: Rodar os testes — confirmar que PASSAM**

```bash
cd backend && npm test -- --testPathPattern=automation
```

Esperado: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add backend/services/automation.js backend/__tests__/automation.test.js
git commit -m "feat: serviço de automações com resolveAction + executeAutomations"
```

---

## Task 5: Rota /arduino/sync

**Files:**
- Create: `backend/routes/arduino.js`
- Create: `backend/__tests__/arduino.test.js`

A rota recebe do ESP8266:
```json
{
  "uid": "firebase-user-uid",
  "token": "segredo-compartilhado",
  "devices": { "luz": true, "ventilador": false, "portao": false, "alarme": false },
  "events": ["presenca"],
  "temperature": 28.5,
  "online": true
}
```

E responde:
```json
{ "commands": [{ "device": "luz", "state": false }] }
```

- [ ] **Step 1: Escrever os testes (vão falhar)**

Crie `backend/__tests__/arduino.test.js`:

```js
process.env.ARDUINO_SECRET = 'test-secret';
process.env.FIREBASE_PROJECT_ID = 'test';
process.env.FIREBASE_DATABASE_URL = 'https://test-default-rtdb.firebaseio.com';

// Mock do firebase.js para não precisar de credenciais reais
jest.mock('../firebase', () => ({
  db: {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ empty: true, docs: [] })
  },
  rtdb: {
    ref: jest.fn(() => ({
      set: jest.fn().mockResolvedValue(),
      once: jest.fn().mockResolvedValue({ val: () => null }),
      remove: jest.fn().mockResolvedValue()
    }))
  },
  admin: { firestore: { FieldValue: { serverTimestamp: () => 'ts' } } }
}));

jest.mock('../services/automation', () => ({
  executeAutomations: jest.fn().mockResolvedValue([])
}));

const express = require('express');
const request = require('supertest');
const arduinoRouter = require('../routes/arduino');

const app = express();
app.use(express.json());
app.use('/arduino', arduinoRouter);

describe('POST /arduino/sync', () => {
  test('retorna 401 com token errado', async () => {
    const res = await request(app).post('/arduino/sync').send({
      uid: 'uid123', token: 'wrong', devices: {}, events: [], online: true
    });
    expect(res.status).toBe(401);
  });

  test('retorna 400 sem uid', async () => {
    const res = await request(app).post('/arduino/sync').send({
      token: 'test-secret', devices: {}, events: [], online: true
    });
    expect(res.status).toBe(400);
  });

  test('retorna 200 com payload válido', async () => {
    const res = await request(app).post('/arduino/sync').send({
      uid: 'uid123',
      token: 'test-secret',
      devices: { luz: true, ventilador: false },
      events: [],
      online: true
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('commands');
    expect(Array.isArray(res.body.commands)).toBe(true);
  });

  test('retorna 200 com evento presenca', async () => {
    const { executeAutomations } = require('../services/automation');
    const res = await request(app).post('/arduino/sync').send({
      uid: 'uid123',
      token: 'test-secret',
      devices: { luz: false },
      events: ['presenca'],
      online: true
    });
    expect(res.status).toBe(200);
    expect(executeAutomations).toHaveBeenCalledWith('uid123', 'presenca');
  });
});

describe('GET /health', () => {
  test('retorna 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Instalar supertest (dev dependency)**

```bash
cd backend && npm install --save-dev supertest
```

- [ ] **Step 3: Rodar os testes — confirmar que FALHAM**

```bash
cd backend && npm test -- --testPathPattern=arduino
```

Esperado: FAIL com `Cannot find module '../routes/arduino'`

- [ ] **Step 4: Criar backend/routes/arduino.js**

```js
const express  = require('express');
const { rtdb } = require('../firebase');
const { executeAutomations } = require('../services/automation');
const { logHistory }         = require('../services/history');

const router = express.Router();

const VALID_DEVICES  = ['luz', 'ventilador', 'portao', 'alarme'];
const VALID_TRIGGERS = ['presenca', 'temperatura', 'horario'];

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

router.post('/sync', async (req, res) => {
  const { uid, token, devices = {}, events = [], online = true } = req.body;

  if (!uid)                               return res.status(400).json({ error: 'uid obrigatório' });
  if (token !== process.env.ARDUINO_SECRET) return res.status(401).json({ error: 'token inválido' });

  try {
    // 1. Atualiza status do Arduino no RTDB
    await rtdb.ref(`arduino_status/${uid}`).set({
      online,
      lastSeen: Date.now()
    });

    // 2. Grava estado real de cada dispositivo informado pelo Arduino
    for (const [deviceId, state] of Object.entries(devices)) {
      if (!VALID_DEVICES.includes(deviceId)) continue;
      await rtdb.ref(`devices/${uid}/${deviceId}`).set({ state: !!state });
    }

    // 3. Executa automações disparadas pelos eventos do sensor
    for (const event of events) {
      if (VALID_TRIGGERS.includes(event)) {
        await executeAutomations(uid, event);
      }
    }

    // 4. Lê comandos pendentes que o site escreveu (dashboard.js)
    const commandsSnap = await rtdb.ref(`commands/${uid}`).once('value');
    const rawCommands  = commandsSnap.val() || {};

    const commands = Object.entries(rawCommands)
      .filter(([deviceId]) => VALID_DEVICES.includes(deviceId))
      .map(([deviceId, val]) => ({ device: deviceId, state: !!val.state }));

    // 5. Limpa a fila de comandos (já vai mandar para o Arduino)
    if (commands.length > 0) {
      await rtdb.ref(`commands/${uid}`).remove();

      // Grava no histórico como acionado pelo site (botao)
      for (const cmd of commands) {
        await logHistory(uid, {
          deviceId: cmd.device,
          device:   cmd.device,
          trigger:  'botao',
          state:    cmd.state
        });
      }
    }

    res.json({ commands });

  } catch (err) {
    console.error('[/arduino/sync] erro:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
```

- [ ] **Step 5: Rodar os testes — confirmar que PASSAM**

```bash
cd backend && npm test -- --testPathPattern=arduino
```

Esperado: PASS (5 testes)

- [ ] **Step 6: Commit**

```bash
git add backend/routes/arduino.js backend/__tests__/arduino.test.js
git commit -m "feat: rota POST /arduino/sync com auth, estados e automações"
```

---

## Task 6: Entry point server.js

**Files:**
- Create: `backend/server.js`

- [ ] **Step 1: Criar backend/server.js**

```js
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const arduinoRoute = require('./routes/arduino');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/arduino', arduinoRoute);

// Rota raiz — útil para verificar no Railway que o servidor subiu
app.get('/', (_req, res) => res.json({ app: 'Casa Inteligente Backend', status: 'online' }));

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

module.exports = app;
```

- [ ] **Step 2: Testar localmente**

```bash
cd backend
cp .env.example .env
# Edite .env: preencha ARDUINO_SECRET e as credenciais do Firebase
node server.js
```

Esperado no terminal:
```
Servidor rodando na porta 3000
```

Em outro terminal:
```bash
curl http://localhost:3000/
```
Esperado: `{"app":"Casa Inteligente Backend","status":"online"}`

- [ ] **Step 3: Rodar todos os testes**

```bash
cd backend && npm test
```

Esperado: todos os testes PASSAM

- [ ] **Step 4: Commit**

```bash
git add backend/server.js
git commit -m "feat: entry point Express com rota /arduino montada"
```

---

## Task 7: Atualizar dashboard.js para usar fila de comandos

**Files:**
- Modify: `js/dashboard.js:131`

Atualmente o site escreve o estado desejado direto em `rtdb/devices/{uid}/{deviceId}`, que é o mesmo caminho que o Arduino usa para reportar o estado real. Isso causa conflito: o site sobrescreve o estado real antes de o Arduino executar. A correção é escrever em `rtdb/commands/{uid}/{deviceId}` (fila de comandos que o backend drena e entrega ao Arduino).

- [ ] **Step 1: Alterar a linha de escrita no RTDB**

Em `js/dashboard.js`, localize (por volta da linha 131):
```js
await rtdb.ref(`devices/${currentUser.uid}/${deviceId}`).set({ state: newState });
```

Troque por:
```js
await rtdb.ref(`commands/${currentUser.uid}/${deviceId}`).set({ state: newState, ts: Date.now() });
```

- [ ] **Step 2: Verificar visualmente no browser**

Abrir o app localmente, logar (ou usar o server.js de preview), acionar um dispositivo no dashboard. Conferir no Firebase Console → Realtime Database:
- `commands/{uid}/luz` deve aparecer com `{ state: true, ts: ... }`
- `devices/{uid}/luz` NÃO deve mudar até o Arduino sincronizar

- [ ] **Step 3: Commit**

```bash
git add js/dashboard.js
git commit -m "fix: site enfileira comandos em rtdb/commands ao invés de escrever estado diretamente"
```

---

## Task 8: Deploy no Railway

- [ ] **Step 1: Criar conta no Railway (se ainda não tiver)**

Acesse railway.app → Login com GitHub.

- [ ] **Step 2: Criar novo projeto**

No Railway Dashboard: **New Project → Deploy from GitHub repo** → selecionar `ique45/casa-inteligente-tcc`.

- [ ] **Step 3: Configurar root directory**

Em **Settings → General → Root Directory**: colocar `backend`.

- [ ] **Step 4: Configurar variáveis de ambiente**

Em **Variables** do projeto, adicionar:
```
ARDUINO_SECRET=<segredo-forte-igual-ao-que-vai-no-firmware>
FIREBASE_PROJECT_ID=casa-inteligente-tcc
FIREBASE_DATABASE_URL=https://casa-inteligente-tcc-default-rtdb.firebaseio.com
FIREBASE_SERVICE_ACCOUNT=<json-da-chave-de-serviço-em-uma-linha>
```

Para gerar a chave de serviço: Firebase Console → Configurações do Projeto → Contas de Serviço → Gerar nova chave privada.

- [ ] **Step 5: Obter a URL pública**

Em **Settings → Networking → Generate Domain** → anotar a URL (ex: `https://casa-inteligente-backend.up.railway.app`).

- [ ] **Step 6: Testar o deploy**

```bash
curl https://<sua-url>.up.railway.app/
```
Esperado: `{"app":"Casa Inteligente Backend","status":"online"}`

- [ ] **Step 7: Testar a rota sync com token errado**

```bash
curl -X POST https://<sua-url>.up.railway.app/arduino/sync \
  -H "Content-Type: application/json" \
  -d '{"uid":"test","token":"errado","devices":{},"events":[],"online":true}'
```
Esperado: `{"error":"token inválido"}` com status 401

- [ ] **Step 8: Commit com URL anotada**

Anote a URL no `docs/superpowers/plans/2026-05-27-backend-railway.md` (este arquivo) e faça commit.

```bash
git add docs/superpowers/plans/2026-05-27-backend-railway.md
git commit -m "docs: anota URL do Railway após deploy"
```

---

## Checklist de cobertura do spec

| Requisito | Task |
|---|---|
| Ponte Arduino ↔ Firebase | Task 5 (rota sync) |
| Autenticação Arduino (token) | Task 5 (validação token) |
| Estado real dos dispositivos no RTDB | Task 5 (step 2 da rota) |
| Comandos pendentes do site → Arduino | Task 5 (step 4–5 da rota) + Task 7 |
| Automações por presença | Task 4 + Task 5 |
| Automações por temperatura | Task 4 + Task 5 |
| Automações por horário | Task 4 + Task 5 |
| Histórico de ativações | Task 3 + Task 5 |
| Status online/offline do Arduino | Task 5 (step 1 da rota) |
| Deploy no Railway | Task 8 |
| Testes | Tasks 2, 4, 5 |
