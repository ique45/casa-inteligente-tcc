process.env.ARDUINO_SECRET = 'test-secret';
process.env.FIREBASE_PROJECT_ID = 'test';
process.env.FIREBASE_DATABASE_URL = 'https://test-default-rtdb.firebaseio.com';

// Mock do firebase.js para não precisar de credenciais reais
jest.mock('../firebase', () => {
  const mockRef = () => ({
    set:    jest.fn().mockResolvedValue(),
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
