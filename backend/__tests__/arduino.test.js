process.env.ARDUINO_SECRET = 'test-secret';
process.env.FIREBASE_PROJECT_ID = 'test';
process.env.FIREBASE_DATABASE_URL = 'https://test-default-rtdb.firebaseio.com';

// Mock do firebase.js para não precisar de credenciais reais
jest.mock('../firebase', () => {
  const mockRef = () => ({
    set:    jest.fn().mockResolvedValue(),
    update: jest.fn().mockResolvedValue(),
    once:   jest.fn().mockResolvedValue({ val: () => null }),
    remove: jest.fn().mockResolvedValue()
  });
  return {
    db: {
      collection: jest.fn().mockReturnThis(),
      doc:        jest.fn().mockReturnThis(),
      where:      jest.fn().mockReturnThis(),
      get:        jest.fn().mockResolvedValue({ empty: true, docs: [] })
    },
    rtdb:  { ref: jest.fn(mockRef) },
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'ts' } } }
  };
});

jest.mock('../services/automation', () => ({
  executeAutomations: jest.fn().mockResolvedValue([])
}));

jest.mock('../services/history', () => ({
  logHistory: jest.fn().mockResolvedValue()
}));

const express = require('express');
const request = require('supertest');
const arduinoRouter = require('../routes/arduino');

const app = express();
app.use(express.json());
app.use('/arduino', arduinoRouter);

describe('GET /arduino/health', () => {
  test('retorna 200', async () => {
    const res = await request(app).get('/arduino/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /arduino/sync', () => {
  const defaultMockRef = () => ({
    set:    jest.fn().mockResolvedValue(),
    update: jest.fn().mockResolvedValue(),
    once:   jest.fn().mockResolvedValue({ val: () => null }),
    remove: jest.fn().mockResolvedValue()
  });

  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    const { rtdb } = require('../firebase');
    rtdb.ref.mockImplementation(defaultMockRef);
  });

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
      devices: { luz: true, alarme: false },
      events: [],
      online: true
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('commands');
    expect(Array.isArray(res.body.commands)).toBe(true);
  });

  test('chama executeAutomations com evento presenca', async () => {
    const { executeAutomations } = require('../services/automation');
    executeAutomations.mockClear();
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

  test('aceita devices:null sem crash', async () => {
    const res = await request(app).post('/arduino/sync').send({
      uid: 'uid123', token: 'test-secret',
      devices: null, events: null, online: true
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.commands)).toBe(true);
  });

  test('inclui automationCommands no response', async () => {
    const { executeAutomations } = require('../services/automation');
    executeAutomations.mockResolvedValueOnce([{ device: 'luz', state: true }]);
    const res = await request(app).post('/arduino/sync').send({
      uid: 'uid123', token: 'test-secret',
      devices: {}, events: ['presenca'], online: true
    });
    expect(res.status).toBe(200);
    expect(res.body.commands).toContainEqual({ device: 'luz', state: true });
  });

  test('site-command tem prioridade sobre automationCommand para o mesmo device', async () => {
    const { executeAutomations } = require('../services/automation');
    executeAutomations.mockResolvedValueOnce([{ device: 'luz', state: true }]);
    const { rtdb } = require('../firebase');
    rtdb.ref.mockImplementation((path) => {
      if (path.includes('commands/')) {
        return {
          once: jest.fn().mockResolvedValue({ val: () => ({ luz: { state: false, ts: 1 } }) }),
          remove: jest.fn().mockResolvedValue()
        };
      }
      return { set: jest.fn().mockResolvedValue(), once: jest.fn().mockResolvedValue({ val: () => null }), remove: jest.fn().mockResolvedValue(), update: jest.fn().mockResolvedValue() };
    });
    const res = await request(app).post('/arduino/sync').send({
      uid: 'uid123', token: 'test-secret',
      devices: {}, events: ['presenca'], online: true
    });
    expect(res.status).toBe(200);
    const luzCmds = res.body.commands.filter(c => c.device === 'luz');
    expect(luzCmds).toHaveLength(1);
    expect(luzCmds[0].state).toBe(false); // site-command (false) vence automação (true)
  });

  test.each(['botao_fisico', 'luminosidade'])('chama executeAutomations com evento %s', async (evento) => {
    const { executeAutomations } = require('../services/automation');
    executeAutomations.mockClear();
    const res = await request(app).post('/arduino/sync').send({
      uid: 'uid123', token: 'test-secret',
      devices: {}, events: [evento], online: true
    });
    expect(res.status).toBe(200);
    expect(executeAutomations).toHaveBeenCalledWith('uid123', evento);
  });

  test('ignora dispositivo que não existe mais (ventilador)', async () => {
    const { rtdb } = require('../firebase');
    rtdb.ref.mockClear();
    const res = await request(app).post('/arduino/sync').send({
      uid: 'uid123', token: 'test-secret',
      devices: { luz: true, ventilador: true }, events: [], online: true
    });
    expect(res.status).toBe(200);
    const caminhos = rtdb.ref.mock.calls.map(c => c[0]);
    expect(caminhos).toContain('devices/uid123/luz');
    expect(caminhos).not.toContain('devices/uid123/ventilador');
  });

  test('arduino_status guarda só online e lastSeen', async () => {
    const { rtdb } = require('../firebase');
    const updateStatusMock = jest.fn().mockResolvedValue();
    rtdb.ref.mockImplementation((path) => {
      if (path === 'arduino_status/uid123') {
        return { update: updateStatusMock };
      }
      return defaultMockRef();
    });
    const res = await request(app).post('/arduino/sync').send({
      uid: 'uid123', token: 'test-secret',
      devices: {}, events: [], online: true, temperature: 25.5
    });
    expect(res.status).toBe(200);
    expect(Object.keys(updateStatusMock.mock.calls[0][0]).sort()).toEqual(['lastSeen', 'online']);
  });

  test('acrescenta as linhas do serial ao log e guarda só as últimas 60', async () => {
    const { rtdb } = require('../firebase');
    const updateStatusMock = jest.fn().mockResolvedValue();
    const anteriores = Array.from({ length: 59 }, (_, i) => ({ t: 1, m: `antiga ${i}` }));
    rtdb.ref.mockImplementation((path) => {
      if (path === 'arduino_status/uid123/log') {
        return { once: jest.fn().mockResolvedValue({ val: () => anteriores }) };
      }
      if (path === 'arduino_status/uid123') return { update: updateStatusMock };
      return defaultMockRef();
    });
    const res = await request(app).post('/arduino/sync').send({
      uid: 'uid123', token: 'test-secret', devices: {}, events: [], online: true,
      log: ['Botao apertado', 'Luminosidade: 512', 42, '   ']
    });
    expect(res.status).toBe(200);
    const log = updateStatusMock.mock.calls[0][0].log;
    expect(log).toHaveLength(60);
    expect(log[0].m).toBe('antiga 1');
    expect(log.slice(-2).map(l => l.m)).toEqual(['Botao apertado', 'Luminosidade: 512']);
  });

  test('registra no histórico quando o alarme dispara, e não repete se nada mudou', async () => {
    const { rtdb } = require('../firebase');
    const { logHistory } = require('../services/history');
    logHistory.mockClear();
    let alarmeAntes = { state: false };
    rtdb.ref.mockImplementation((path) => {
      if (path === 'devices/uid123/alarme') {
        return {
          once: jest.fn().mockImplementation(async () => ({ val: () => alarmeAntes })),
          update: jest.fn().mockResolvedValue()
        };
      }
      return defaultMockRef();
    });
    const corpo = { uid: 'uid123', token: 'test-secret', devices: { alarme: true }, events: [], online: true };

    await request(app).post('/arduino/sync').send(corpo);
    expect(logHistory).toHaveBeenCalledWith('uid123',
      { deviceId: 'alarme', device: 'Alarme', trigger: 'presenca', state: true });

    logHistory.mockClear();
    alarmeAntes = { state: true };
    await request(app).post('/arduino/sync').send(corpo);
    expect(logHistory).not.toHaveBeenCalled();
  });

  test('registra no histórico quando a placa acende a luz externa pelo LDR', async () => {
    const { rtdb } = require('../firebase');
    const { logHistory } = require('../services/history');
    logHistory.mockClear();
    rtdb.ref.mockImplementation((path) => {
      if (path === 'devices/uid123/luz_externa') {
        return { once: jest.fn().mockResolvedValue({ val: () => ({ state: false }) }), update: jest.fn().mockResolvedValue() };
      }
      return defaultMockRef();
    });
    await request(app).post('/arduino/sync').send({
      uid: 'uid123', token: 'test-secret', devices: { luz_externa: true }, events: [], online: true
    });
    expect(logHistory).toHaveBeenCalledWith('uid123',
      { deviceId: 'luz_externa', device: 'Luz externa', trigger: 'luminosidade', state: true });
  });

  test('ignora event inválido', async () => {
    const { executeAutomations } = require('../services/automation');
    executeAutomations.mockClear();
    const res = await request(app).post('/arduino/sync').send({
      uid: 'uid123',
      token: 'test-secret',
      devices: {},
      events: ['evento-inexistente'],
      online: true
    });
    expect(res.status).toBe(200);
    expect(executeAutomations).not.toHaveBeenCalled();
  });
});
