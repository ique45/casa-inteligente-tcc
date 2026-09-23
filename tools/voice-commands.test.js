'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  VOICE_VERBS, montarComandos, normalizarFrase, encontrarComando,
  comandoJaUsado, describeAutomation, descAlternar
} = require('../js/devices.js');

// Monta um item no formato de automationsList do dashboard: { id, data }.
function auto(id, voiceOn, voiceOff, extra) {
  return { id, data: Object.assign(
    { deviceType: 'luz', deviceName: 'Luz', trigger: 'voz', action: 'toggle', enabled: true, voiceOn, voiceOff },
    extra || {}) };
}

// ---- VOICE_VERBS / montarComandos ----

test('todo dispositivo tem pelo menos um par de verbos', () => {
  for (const id of ['luz', 'ventilador', 'portao', 'alarme']) {
    assert.ok(VOICE_VERBS[id] && VOICE_VERBS[id].length > 0, `${id} sem verbos`);
    for (const par of VOICE_VERBS[id]) assert.ok(par.on && par.off);
  }
});

test('primeiro par de cada dispositivo', () => {
  assert.deepStrictEqual(VOICE_VERBS.luz[0], { on: 'Acender', off: 'Apagar' });
  assert.deepStrictEqual(VOICE_VERBS.ventilador[0], { on: 'Ligar', off: 'Desligar' });
  assert.deepStrictEqual(VOICE_VERBS.portao[0], { on: 'Abrir', off: 'Fechar' });
  assert.deepStrictEqual(VOICE_VERBS.alarme[0], { on: 'Armar', off: 'Desarmar' });
});

test('montarComandos poe o nome depois do verbo', () => {
  assert.deepStrictEqual(montarComandos({ on: 'Acender', off: 'Apagar' }, 'Luz Quarto'),
    { voiceOn: 'Acender Luz Quarto', voiceOff: 'Apagar Luz Quarto' });
});

test('montarComandos apara espacos e preserva acentos do nome', () => {
  assert.deepStrictEqual(montarComandos({ on: 'Abrir', off: 'Fechar' }, '  Portão   Garagem '),
    { voiceOn: 'Abrir Portão Garagem', voiceOff: 'Fechar Portão Garagem' });
});

test('montarComandos com nome vazio devolve so o verbo', () => {
  assert.deepStrictEqual(montarComandos({ on: 'Ligar', off: 'Desligar' }, ''),
    { voiceOn: 'Ligar', voiceOff: 'Desligar' });
});

// ---- normalizarFrase ----

test('normalizarFrase tira acento, maiuscula e pontuacao', () => {
  assert.strictEqual(normalizarFrase('Abrir o Portão!'), 'abrir portao');
  assert.strictEqual(normalizarFrase('Acender luz quarto.'), 'acender luz quarto');
});

test('normalizarFrase tira artigos e preposicoes soltos', () => {
  assert.strictEqual(normalizarFrase('Acender a luz do quarto'), 'acender luz quarto');
  assert.strictEqual(normalizarFrase('ligar os ventiladores da sala'), 'ligar ventiladores sala');
});

test('normalizarFrase nao corta artigo dentro de palavra', () => {
  assert.strictEqual(normalizarFrase('apagar a sala'), 'apagar sala');
  assert.strictEqual(normalizarFrase('Desarmar alarme'), 'desarmar alarme');
});

test('normalizarFrase colapsa espacos e aceita vazio', () => {
  assert.strictEqual(normalizarFrase('  ligar    luz  '), 'ligar luz');
  assert.strictEqual(normalizarFrase(''), '');
  assert.strictEqual(normalizarFrase(undefined), '');
});

test('frases que so diferem em pontuacao normalizam igual', () => {
  assert.strictEqual(normalizarFrase('Ligar Luz'), normalizarFrase('ligar luz!'));
});

// ---- encontrarComando ----

const LISTA = [
  auto('a1', 'Acender Luz Quarto', 'Apagar Luz Quarto', { deviceName: 'Luz Quarto' }),
  auto('a2', 'Abrir Portão', 'Fechar Portão', { deviceType: 'portao', deviceName: 'Portão' })
];

test('frase exata liga', () => {
  const r = encontrarComando('Acender Luz Quarto', LISTA);
  assert.strictEqual(r.automation.id, 'a1');
  assert.strictEqual(r.state, true);
  assert.strictEqual(r.frase, 'Acender Luz Quarto');
});

test('frase de desligar desliga', () => {
  const r = encontrarComando('apagar luz quarto', LISTA);
  assert.strictEqual(r.automation.id, 'a1');
  assert.strictEqual(r.state, false);
});

test('fala com artigos, acento diferente e ponto final casa', () => {
  const r = encontrarComando('Acender a luz do quarto.', LISTA);
  assert.strictEqual(r && r.automation.id, 'a1');
  const p = encontrarComando('abrir o portao', LISTA);
  assert.strictEqual(p && p.automation.id, 'a2');
});

test('fala com palavras extras em volta casa', () => {
  const r = encontrarComando('por favor fechar o portão agora', LISTA);
  assert.strictEqual(r.automation.id, 'a2');
  assert.strictEqual(r.state, false);
});

test('desligar nao casa com o comando de ligar', () => {
  const lista = [auto('v1', 'Ligar Ventilador', 'Parar Ventilador', { deviceType: 'ventilador' })];
  assert.strictEqual(encontrarComando('desligar ventilador', lista), null);
});

test('desligar casa com desligar mesmo existindo ligar', () => {
  const lista = [auto('v1', 'Ligar Ventilador', 'Desligar Ventilador', { deviceType: 'ventilador' })];
  const r = encontrarComando('desligar ventilador', lista);
  assert.strictEqual(r.state, false);
});

test('automacao desativada nao responde', () => {
  const lista = [auto('a1', 'Acender Luz', 'Apagar Luz', { enabled: false })];
  assert.strictEqual(encontrarComando('acender luz', lista), null);
});

test('automacao que nao e de voz nao responde', () => {
  const lista = [auto('a1', 'Acender Luz', 'Apagar Luz', { trigger: 'botao' })];
  assert.strictEqual(encontrarComando('acender luz', lista), null);
});

test('frase mais longa vence', () => {
  const lista = [
    auto('curta', 'Acender Luz', 'Apagar Luz'),
    auto('longa', 'Acender Luz Quarto', 'Apagar Luz Quarto')
  ];
  assert.strictEqual(encontrarComando('acender luz quarto', lista).automation.id, 'longa');
  assert.strictEqual(encontrarComando('acender luz', lista).automation.id, 'curta');
});

test('empate de tamanho: vence a primeira da lista', () => {
  const lista = [auto('primeira', 'Acender Luz', 'Apagar Luz'), auto('segunda', 'Acender Luz', 'Apagar Luz')];
  assert.strictEqual(encontrarComando('acender luz', lista).automation.id, 'primeira');
});

test('sem match devolve null', () => {
  assert.strictEqual(encontrarComando('tocar musica', LISTA), null);
  assert.strictEqual(encontrarComando('', LISTA), null);
  assert.strictEqual(encontrarComando('acender luz', []), null);
});

test('documento antigo sem voiceOn/voiceOff nao casa nem explode', () => {
  const antigo = { id: 'old', data: { deviceType: 'luz', trigger: 'voz', enabled: true, voiceCommand: 'ligar luz' } };
  assert.strictEqual(encontrarComando('ligar luz', [antigo]), null);
  assert.strictEqual(encontrarComando('qualquer coisa', [antigo]), null);
});

// ---- comandoJaUsado ----

test('comandoJaUsado acha frase igual em outra automacao de voz', () => {
  const r = comandoJaUsado('acender a luz quarto', LISTA, null);
  assert.strictEqual(r && r.id, 'a1');
});

test('comandoJaUsado ignora a propria automacao em edicao', () => {
  assert.strictEqual(comandoJaUsado('Acender Luz Quarto', LISTA, 'a1'), null);
});

test('comandoJaUsado ignora frase vazia e automacao que nao e de voz', () => {
  assert.strictEqual(comandoJaUsado('', LISTA, null), null);
  const botao = [auto('b', 'Acender Luz', 'Apagar Luz', { trigger: 'botao' })];
  assert.strictEqual(comandoJaUsado('Acender Luz', botao, null), null);
});

// ---- descAlternar / describeAutomation ----

test('descAlternar concorda com o dispositivo', () => {
  assert.strictEqual(descAlternar('luz'), 'liga se estiver desligada, desliga se estiver ligada');
  assert.strictEqual(descAlternar('portao'), 'abre se estiver fechado, fecha se estiver aberto');
  assert.strictEqual(descAlternar('alarme'), 'arma se estiver desarmado, desarma se estiver armado');
  assert.strictEqual(descAlternar('xyz'), 'liga se estiver desligado, desliga se estiver ligado');
});

test('describeAutomation de voz mostra os dois comandos', () => {
  const { whenText, thenText } = describeAutomation(
    { deviceType: 'luz', deviceName: 'Luz Quarto', trigger: 'voz', action: 'toggle',
      voiceOn: 'Acender Luz Quarto', voiceOff: 'Apagar Luz Quarto' });
  assert.match(whenText, /"Acender Luz Quarto"<\/strong> \(liga\)/);
  assert.match(whenText, /"Apagar Luz Quarto"<\/strong> \(desliga\)/);
  assert.match(thenText, /acender ou apagar/);
  assert.match(thenText, /Luz Quarto/);
});

test('describeAutomation de sensor diz alternar', () => {
  const { whenText, thenText } = describeAutomation(
    { deviceType: 'luz', deviceName: 'Luz Sala', trigger: 'presenca', action: 'toggle' });
  assert.match(whenText, /sensor detectar presença/);
  assert.match(thenText, /alternar/);
  assert.match(thenText, /Luz Sala/);
});

test('describeAutomation escapa HTML do usuario', () => {
  const { whenText, thenText } = describeAutomation(
    { deviceType: 'luz', deviceName: '<b>x</b>', trigger: 'voz', voiceOn: '<i>', voiceOff: 'a"b' });
  assert.ok(!whenText.includes('<i>'));
  assert.ok(!thenText.includes('<b>'));
});

test('describeAutomation de documento antigo nao explode', () => {
  const { whenText } = describeAutomation({ deviceType: 'luz', deviceName: 'L', trigger: 'voz', voiceCommand: 'x' });
  assert.strictEqual(typeof whenText, 'string');
});
