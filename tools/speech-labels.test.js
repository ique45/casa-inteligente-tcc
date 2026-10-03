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

test('alarme fala armado e desarmado; sirene, tocando e desligada', () => {
  assert.strictEqual(frasePara('alarme_armado', true), 'Alarme armado');
  assert.strictEqual(frasePara('alarme_armado', false), 'Alarme desarmado');
  assert.strictEqual(frasePara('alarme', true), 'Sirene tocando');
  assert.strictEqual(frasePara('alarme', false), 'Sirene desligada');
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
