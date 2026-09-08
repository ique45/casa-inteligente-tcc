'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { DEVICES, frasePara } = require('../js/devices.js');

test('luz concorda no feminino', () => {
  assert.strictEqual(frasePara('luz', true), 'Luz ligada');
  assert.strictEqual(frasePara('luz', false), 'Luz desligada');
});

test('ventilador concorda no masculino', () => {
  assert.strictEqual(frasePara('ventilador', true), 'Ventilador ligado');
  assert.strictEqual(frasePara('ventilador', false), 'Ventilador desligado');
});

test('portao usa abrir e fechar, nao ligar', () => {
  assert.strictEqual(frasePara('portao', true), 'Portão aberto');
  assert.strictEqual(frasePara('portao', false), 'Portão fechado');
});

test('alarme usa armar e desarmar', () => {
  assert.strictEqual(frasePara('alarme', true), 'Alarme armado');
  assert.strictEqual(frasePara('alarme', false), 'Alarme desarmado');
});

test('todo dispositivo tem os dois participios', () => {
  for (const d of DEVICES) {
    assert.ok(d.speechOn, `${d.id} sem speechOn`);
    assert.ok(d.speechOff, `${d.id} sem speechOff`);
  }
});

test('dispositivo desconhecido nao explode', () => {
  assert.strictEqual(frasePara('inexistente', true), null);
});
