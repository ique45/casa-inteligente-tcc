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

test('alarme fala disparado e desligado', () => {
  assert.strictEqual(frasePara('alarme', true), 'Alarme disparado');
  assert.strictEqual(frasePara('alarme', false), 'Alarme desligado');
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
