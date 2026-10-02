'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { DEVICES, frasePara } = require('../js/devices.js');

test('luz concorda no feminino', () => {
  assert.strictEqual(frasePara('luz', true), 'Luz interna ligada');
  assert.strictEqual(frasePara('luz', false), 'Luz interna desligada');
  assert.strictEqual(frasePara('luz_externa', true), 'Luz externa ligada');
  assert.strictEqual(frasePara('luz_externa', false), 'Luz externa desligada');
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
