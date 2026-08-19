'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { contrast, parseTokens, checkPairs, findStrayColors } = require('./check-contrast.js');

test('preto sobre branco da 21:1', () => {
  assert.ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 0.01);
});

test('branco sobre branco da 1:1', () => {
  assert.ok(Math.abs(contrast('#ffffff', '#ffffff') - 1) < 0.01);
});

test('contraste e simetrico', () => {
  const a = contrast('#5b21b6', '#ffffff');
  const b = contrast('#ffffff', '#5b21b6');
  assert.ok(Math.abs(a - b) < 1e-9);
});

test('parseTokens le apenas o bloco pedido', () => {
  const css = ':root {\n  --bg: #ffffff;\n}\n:root[data-theme="dark"] {\n  --bg: #050510;\n}\n';
  assert.strictEqual(parseTokens(css, ':root {')['--bg'], '#ffffff');
  assert.strictEqual(parseTokens(css, ':root[data-theme="dark"]')['--bg'], '#050510');
});

test('parseTokens reclama de seletor ausente', () => {
  assert.throws(() => parseTokens(':root { --bg: #fff000; }', ':root[data-theme="dark"]'));
});

test('checkPairs aprova par acima do minimo', () => {
  const tokens = { '--text': '#000000', '--bg': '#ffffff' };
  const falhas = checkPairs('claro', tokens, [['--text', '--bg']], 7, 'texto');
  assert.deepStrictEqual(falhas, []);
});

test('checkPairs reprova par abaixo do minimo e diz a razao', () => {
  const tokens = { '--text': '#949494', '--bg': '#ffffff' };
  const falhas = checkPairs('claro', tokens, [['--text', '--bg']], 7, 'texto');
  assert.strictEqual(falhas.length, 1);
  assert.match(falhas[0], /claro/);
  assert.match(falhas[0], /--text/);
  assert.match(falhas[0], /:1/);
});

test('checkPairs acusa token ausente em vez de calcular com undefined', () => {
  const falhas = checkPairs('claro', { '--bg': '#ffffff' }, [['--text', '--bg']], 7, 'texto');
  assert.strictEqual(falhas.length, 1);
  assert.match(falhas[0], /ausente/);
});

test('findStrayColors ignora cores dentro dos blocos de tema', () => {
  const css = ':root {\n  --bg: #ffffff;\n}\n:root[data-theme="dark"] {\n  --bg: #050510;\n}\n';
  assert.deepStrictEqual(findStrayColors(css), []);
});

test('findStrayColors acusa cor literal fora dos blocos, com a linha', () => {
  const css = ':root {\n  --bg: #ffffff;\n}\n.card {\n  color: #ff0000;\n}\n';
  const strays = findStrayColors(css);
  assert.strictEqual(strays.length, 1);
  assert.match(strays[0], /:5:/);
});

test('findStrayColors acusa rgba fora dos blocos', () => {
  const css = ':root {\n  --bg: #ffffff;\n}\n.card {\n  background: rgba(255,255,255,0.03);\n}\n';
  assert.strictEqual(findStrayColors(css).length, 1);
});

test('findStrayColors acusa cor literal apos blocodetema fechado na mesma linha', () => {
  const css = ':root { --bg: #ffffff; } .card { color: #ff0000; }\n';
  const strays = findStrayColors(css);
  assert.strictEqual(strays.length, 1);
  assert.match(strays[0], /#ff0000/);
});

test('findStrayColors ignora blocodetema completo em uma linha', () => {
  const css = ':root { --bg: #ffffff; }\n';
  const strays = findStrayColors(css);
  assert.strictEqual(strays.length, 0);
});
