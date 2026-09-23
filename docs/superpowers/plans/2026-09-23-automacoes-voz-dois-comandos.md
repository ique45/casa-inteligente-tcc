# Automações sem escolha de ação e voz com dois comandos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar a escolha de ação de todas as automações (todas alternam), dar à automação de voz dois comandos (liga/desliga) montados a partir do nome, e fazer o microfone reconhecer de verdade esses comandos salvos.

**Architecture:** Toda a lógica nova que não depende de DOM (pares de verbos, montagem de frases, normalização, busca do comando falado, detecção de frase repetida, textos de descrição) fica em `js/devices.js`, que já é carregado por todas as páginas e exportado para o Node — assim é testável com `node --test`. `js/automation.js` (formulário) e `js/voice.js`/`js/dashboard.js` (microfone) só consomem essas funções.

**Tech Stack:** JavaScript puro no navegador (sem bundler; funções globais via `<script>`), Firebase compat 10.12 (Firestore + RTDB), `node:test` para testes, `firebase-admin` (em `backend/node_modules`) para a limpeza de dados.

**Spec:** `docs/superpowers/specs/2026-09-23-automacoes-voz-dois-comandos-design.md`

## Global Constraints

- Backend e firmware **não mudam**. `resolveAction('toggle', ...)` do backend já cobre o novo modelo.
- Todo documento salvo tem `action: 'toggle'`. `voiceCommand` deixa de ser escrito. Voz grava `voiceOn` e `voiceOff`.
- **Sem compatibilidade com automações antigas** — mas documento antigo não pode quebrar a página (sem exceção, só texto vazio).
- `firestore.rules` não muda.
- Os padrões fixos de `voice.js` (`COMMANDS`) continuam como fallback: a voz tem que funcionar mesmo sem nenhuma automação.
- Automação desativada (`enabled === false`) não responde por voz.
- Textos de interface em português, com acentos. Código novo segue o estilo do arquivo (nomes em português nas funções novas, como `frasePara`).
- `devices.js` continua sem dependências e termina com o bloco `module.exports` condicional.
- Testes: `node --test tools/*.test.js` (Windows: rodar no Git Bash, ou `node --test tools/` no PowerShell).
- Site local: `node server.js` → **`http://localhost:8080`** (nunca `127.0.0.1`). `?preview=1` usa dados falsos sem login.

## Review Focus

1. **"Desligar X" contém "ligar X"** — falar "desligar luz quarto" não pode casar com o comando "Ligar Luz Quarto"; comparação por palavra inteira, não substring. (teste na Task 1)
2. **Transcrição do Chrome com pontuação/maiúscula/acento diferente** — "Acender a luz do quarto." e "acender luz quarto" têm que casar com "Acender Luz Quarto". (teste na Task 1)
3. **Os dois comandos iguais depois de normalizar** — "Ligar Luz" e "ligar luz!" contam como iguais; o formulário não deixa salvar. (teste de `normalizarFrase` na Task 1 + validação na Task 2)
4. **Frase vazia ou documento antigo sem `voiceOn`/`voiceOff`** — nunca casa com qualquer fala e não lança exceção. (teste na Task 1)
5. **Renomear depois de editar à mão um dos comandos** — só o campo não editado é recalculado. (verificação manual guiada na Task 2)

---

## File Structure

| Arquivo | Responsabilidade | Mudança |
|---|---|---|
| `js/devices.js` | dados de dispositivo + funções puras de automação/voz | adiciona `VOICE_VERBS`, `montarComandos`, `normalizarFrase`, `encontrarComando`, `comandoJaUsado`, `descAlternar`; reescreve `describeAutomation`; remove `ACTIONS_*`/`getActions` |
| `tools/voice-commands.test.js` | testes das funções acima | **novo** |
| `automation.html` | marcação do formulário | remove `#step-action`; voz ganha 2 campos + aviso |
| `js/automation.js` | comportamento do formulário | remove ação; chips de par de verbos; 2 campos; flags de edição manual |
| `js/voice.js` | reconhecimento de fala | `setAutomacoes()`; consulta `encontrarComando` antes do fallback |
| `js/dashboard.js` | liga lista de automações ao microfone | entrega lista a cada snapshot; botão sempre alterna; mensagem com a frase salva |
| `server.js` | dados falsos do modo preview | automações de exemplo no formato novo |
| `tools/limpar-automacoes.js` | backup + apagar automações de teste | **novo**, rodado à mão |

---

### Task 0: Commitar o trabalho pendente do dashboard

O `js/dashboard.js` tem uma mudança não commitada (`aguardarConfirmacao`, timeout de confirmação da placa) que o spec cita como "feito hoje". Ela precisa entrar num commit próprio antes, para não se misturar com esta feature.

**Files:**
- Modify: `js/dashboard.js` (já modificado no working tree)

- [ ] **Step 1: Conferir que a mudança é só a do timeout**

Run: `git diff --stat`
Expected: só `js/dashboard.js | 51 +++`.

- [ ] **Step 2: Commit**

```bash
git add js/dashboard.js
git commit -m "fix: botao nao fica preso em 'Armando...' quando a placa nao responde"
```

---

### Task 1: Funções puras de voz e descrição em `devices.js`

**Files:**
- Modify: `js/devices.js:17-67` (bloco de ações e `describeAutomation`) e `js/devices.js:84-87` (exports)
- Create: `tools/voice-commands.test.js`

**Interfaces:**
- Consumes: `DEVICES`, `escapeHtml` (já existem em `devices.js`).
- Produces (globais no navegador, exportados no Node):
  - `VOICE_VERBS: { [deviceId]: Array<{ on: string, off: string }> }` — primeiro par é o padrão.
  - `montarComandos(par: {on, off}, nome: string) → { voiceOn: string, voiceOff: string }`
  - `normalizarFrase(texto: string|undefined) → string`
  - `encontrarComando(fala: string, automacoes: Array<{id, data}>) → { automation: {id, data}, state: boolean, frase: string } | null`
  - `comandoJaUsado(frase: string, automacoes: Array<{id, data}>, ignorarId: string|null) → {id, data} | null`
  - `descAlternar(deviceId: string) → string` — ex.: `'liga se estiver desligada, desliga se estiver ligada'`
  - `describeAutomation(d) → { whenText: string, thenText: string }` (HTML já escapado)
  - **Removidos:** `ACTIONS_DEFAULT`, `ACTIONS_BY_DEVICE`, `getActions`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tools/voice-commands.test.js`:

```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/voice-commands.test.js`
Expected: FAIL — `montarComandos is not a function` (e similares).

- [ ] **Step 3: Implementar em `devices.js`**

Substituir o bloco que vai de `const ACTIONS_DEFAULT = [` até o fim de `function describeAutomation(d) { ... }` (linhas 28-67) por:

```js
// Pares de verbos que o formulário oferece para a automação de voz. O
// primeiro de cada lista é o padrão, já escolhido ao abrir a etapa de voz.
const VOICE_VERBS = {
  luz:        [{ on: 'Acender', off: 'Apagar' },   { on: 'Ligar', off: 'Desligar' }],
  ventilador: [{ on: 'Ligar',   off: 'Desligar' }],
  portao:     [{ on: 'Abrir',   off: 'Fechar' }],
  alarme:     [{ on: 'Armar',   off: 'Desarmar' }, { on: 'Ativar', off: 'Desativar' }]
};

// Toda automação alterna. O texto explica o que "alternar" faz em cada
// dispositivo, concordando em gênero ("desligada" para luz).
const ALTERNAR_DESC = {
  luz:        'liga se estiver desligada, desliga se estiver ligada',
  ventilador: 'liga se estiver desligado, desliga se estiver ligado',
  portao:     'abre se estiver fechado, fecha se estiver aberto',
  alarme:     'arma se estiver desarmado, desarma se estiver armado'
};

function descAlternar(deviceId) {
  return ALTERNAR_DESC[deviceId] || 'liga se estiver desligado, desliga se estiver ligado';
}

function montarComandos(par, nome) {
  const n = String(nome || '').trim().replace(/\s+/g, ' ');
  return {
    voiceOn:  n ? `${par.on} ${n}`  : par.on,
    voiceOff: n ? `${par.off} ${n}` : par.off
  };
}

// Palavras que o reconhecimento de fala às vezes inclui e às vezes não
// ("acender a luz do quarto" x "acender luz quarto"). Somem na comparação.
const PALAVRAS_SOLTAS = new Set(['o', 'a', 'os', 'as', 'do', 'da', 'dos', 'das', 'de', 'no', 'na']);

function normalizarFrase(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(p => p && !PALAVRAS_SOLTAS.has(p))
    .join(' ');
}

// Compara por palavra inteira: "desligar ventilador" contém a substring
// "ligar ventilador", mas não pode acionar o comando de ligar.
function _contemFrase(fala, frase) {
  return (' ' + fala + ' ').includes(' ' + frase + ' ');
}

function _automacoesDeVoz(automacoes) {
  return (automacoes || []).filter(a => a && a.data && a.data.trigger === 'voz');
}

function encontrarComando(fala, automacoes) {
  const f = normalizarFrase(fala);
  if (!f) return null;
  let melhor = null;
  let melhorTamanho = 0;
  _automacoesDeVoz(automacoes).forEach(item => {
    if (item.data.enabled === false) return;
    [[item.data.voiceOn, true], [item.data.voiceOff, false]].forEach(([frase, state]) => {
      const n = normalizarFrase(frase);
      if (!n || !_contemFrase(f, n)) return;
      // ">" e não ">=": no empate fica a primeira encontrada.
      if (n.length > melhorTamanho) {
        melhor = { automation: item, state, frase };
        melhorTamanho = n.length;
      }
    });
  });
  return melhor;
}

function comandoJaUsado(frase, automacoes, ignorarId) {
  const n = normalizarFrase(frase);
  if (!n) return null;
  return _automacoesDeVoz(automacoes).find(item =>
    item.id !== ignorarId &&
    (normalizarFrase(item.data.voiceOn) === n || normalizarFrase(item.data.voiceOff) === n)
  ) || null;
}

function describeAutomation(d) {
  let whenText = '';
  if (d.trigger === 'voz') {
    whenText = `você falar <strong>"${escapeHtml(d.voiceOn || '')}"</strong> (liga)` +
               ` ou <strong>"${escapeHtml(d.voiceOff || '')}"</strong> (desliga)`;
  }
  else if (d.trigger === 'botao') whenText = `você clicar no botão do dashboard`;
  else if (d.trigger === 'presenca') whenText = `o sensor detectar presença`;
  else if (d.trigger === 'temperatura') whenText = `o sensor de temperatura disparar`;
  else if (d.trigger === 'horario') whenText = `chegar o horário programado`;
  else whenText = escapeHtml(d.trigger);

  const nome = `<strong>${escapeHtml(d.deviceName)}</strong>`;
  let thenText;
  if (d.trigger === 'voz') {
    const par = (VOICE_VERBS[d.deviceType] || [{ on: 'Ligar', off: 'Desligar' }])[0];
    const verbos = `${par.on.toLowerCase()} ou ${par.off.toLowerCase()}`;
    thenText = `<span class="action-verb">${verbos}</span> o ${nome}, conforme o comando`;
  } else {
    thenText = `<span class="action-verb">alternar</span> o ${nome} (${descAlternar(d.deviceType)})`;
  }
  return { whenText, thenText };
}
```

Atualizar o comentário do topo do bloco (linhas 17-19) para:

```js
// Compartilhado entre automation.html (formulário) e dashboard.html (lista
// de cards e microfone): gatilhos, comandos de voz e os textos
// "Quando: / O sistema vai:" de uma automação salva.
```

E o export no fim do arquivo:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEVICES, escapeHtml, formatRelativeTime, frasePara,
    VOICE_VERBS, montarComandos, normalizarFrase, encontrarComando,
    comandoJaUsado, describeAutomation, descAlternar
  };
}
```

- [ ] **Step 4: Rodar todos os testes**

Run: `node --test tools/*.test.js`
Expected: todos PASS (os novos + `speech-labels` + `check-contrast`).

- [ ] **Step 5: Commit**

```bash
git add js/devices.js tools/voice-commands.test.js
git commit -m "feat: funcoes de comando de voz com dois comandos e descricao sempre alternando"
```

> Depois deste commit o formulário fica quebrado (`getActions` sumiu) até a Task 2. É esperado; não publicar (`git push`) entre as Tasks 1 e 3.

---

### Task 2: Formulário sem ação e com dois comandos de voz

**Files:**
- Modify: `automation.html:109-125` (etapas de voz e ação)
- Modify: `js/automation.js` (quase todo: estado do form, seleção, edição, prévia, salvar, reset)

**Interfaces:**
- Consumes (Task 1): `VOICE_VERBS`, `montarComandos(par, nome)`, `normalizarFrase(texto)`, `comandoJaUsado(frase, automacoes, ignorarId)`, `descAlternar(deviceId)`, `describeAutomation(d)`.
- Produces: documento Firestore `{ deviceType, deviceName, trigger, action: 'toggle', voiceOn?, voiceOff?, enabled, createdAt }`.

- [ ] **Step 1: Trocar a marcação da etapa de voz e remover a de ação**

Em `automation.html`, substituir os dois blocos `<div class="form-step" id="step-voice" ...>...</div>` e `<div class="form-step" id="step-action" ...>...</div>` por:

```html
          <div class="form-step" id="step-voice" style="display:none">
            <div class="step-label">
              <span class="step-num">4</span> Comandos de voz
              <button type="button" class="tooltip-icon" aria-expanded="false"><span aria-hidden="true">ⓘ</span><span class="visually-hidden">Ajuda</span><span class="tooltip-text">Uma frase para ligar e outra para desligar. Escolha os verbos e o nome entra sozinho no final. Você pode mudar as frases à vontade.</span></button>
            </div>
            <div class="chip-group" id="voice-verbs" style="margin-bottom:0.625rem"></div>
            <div class="form-group">
              <label class="form-label" for="input-voice-on">Comando para ligar</label>
              <input type="text" id="input-voice-on" class="form-input" placeholder="Ex: Acender Luz Quarto" maxlength="60"/>
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label" for="input-voice-off">Comando para desligar</label>
              <input type="text" id="input-voice-off" class="form-input" placeholder="Ex: Apagar Luz Quarto" maxlength="60"/>
            </div>
            <p id="voice-aviso" class="trigger-note" role="status" style="display:none"></p>
          </div>
```

- [ ] **Step 2: Estado do formulário e ajuste dos pontos de reset**

Em `js/automation.js`:

1. Apagar a constante `VOICE_SUGGESTIONS` (linhas 14-19) e trocar o comentário das linhas 10-12 por:

```js
// TRIGGER_INFO, VOICE_VERBS, montarComandos() e describeAutomation() vêm de
// js/devices.js — compartilhados com o dashboard, que também precisa
// descrever automações e reconhecer os comandos de voz.
```

2. Logo abaixo, criar a fábrica do estado e usá-la nos 4 lugares que hoje montam `form = { device: ..., voiceCommand: '', action: null }` (linhas 22, 38, 80, 379):

```js
// par: índice em VOICE_VERBS[device] que gerou as frases (null = nenhum).
// editadoOn/Off: o usuário mexeu no campo à mão; aí renomear não o sobrescreve.
function formVazio(device) {
  return { device: device || null, name: '', trigger: null,
           voiceOn: '', voiceOff: '', par: null, editadoOn: false, editadoOff: false };
}

let form = formVazio();
```

- linha 38 → `form = formVazio();`
- linha 80 (`selectDevice`) → `form = formVazio(id);`
- linha 379 (`resetForm`) → `form = formVazio();`

3. Em `onAuthStateChanged` (linhas 39-44) trocar as referências a `input-voice` e `renderActionChips()`:

```js
  const _inputName = document.getElementById('input-name');
  if (_inputName) _inputName.value = '';
  limparCamposVoz();
  renderDeviceChips();
  loadAutomations();
```

4. Em `selectDevice` apagar a linha `renderActionChips();`.

5. Em `hideFrom` a lista de etapas vira:

```js
  const steps = ['step-trigger', 'step-voice', 'preview-wrap', 'btn-save-auto'];
```

6. Apagar a função `renderActionChips` inteira (linhas 189-212).

- [ ] **Step 3: Nota do gatilho botão usa o texto central**

Em `getTriggerNote`, trocar o ramo `if (triggerId === 'botao') { ... }` por:

```js
  if (triggerId === 'botao') {
    return `O botão no dashboard sempre alterna o estado: ${descAlternar(deviceId)}.`;
  }
```

- [ ] **Step 4: Seleção de gatilho e chips de verbos**

Substituir `selectTrigger` e `renderVoiceSuggestions` (linhas 139-187) por:

```js
function selectTrigger(id) {
  form.trigger = id;
  document.querySelectorAll('#trigger-chips .chip').forEach(c => {
    const escolhido = c.dataset.id === id;
    c.classList.toggle('selected', escolhido);
    c.setAttribute('aria-pressed', String(escolhido));
  });

  showTriggerNote(id, form.device);

  if (id === 'voz') {
    // Já entra com o primeiro par escolhido: as frases aparecem prontas.
    escolherPar(0);
    document.getElementById('step-voice').style.display = 'block';
  } else {
    limparCamposVoz();
    document.getElementById('step-voice').style.display = 'none';
  }
  updatePreview();
}

function limparCamposVoz() {
  form.voiceOn = ''; form.voiceOff = '';
  form.par = null; form.editadoOn = false; form.editadoOff = false;
  const on = document.getElementById('input-voice-on');
  const off = document.getElementById('input-voice-off');
  if (on) on.value = '';
  if (off) off.value = '';
}

function renderVoiceVerbs() {
  const pares = VOICE_VERBS[form.device] || [];
  const wrap = document.getElementById('voice-verbs');
  wrap.innerHTML = pares.map((p, i) => {
    const escolhido = form.par === i;
    return `<button type="button" class="suggestion-chip${escolhido ? ' selected' : ''}" data-par="${i}" aria-pressed="${escolhido}">${escapeHtml(p.on)} / ${escapeHtml(p.off)}</button>`;
  }).join('');
  wrap.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => { escolherPar(Number(chip.dataset.par)); updatePreview(); });
  });
}

// Escolher um par sempre reescreve as duas frases e esquece edições à mão.
function escolherPar(i) {
  form.par = i;
  form.editadoOn = false;
  form.editadoOff = false;
  recalcularComandos();
  renderVoiceVerbs();
}

// Refaz as frases a partir do par e do nome, poupando o campo editado à mão.
function recalcularComandos() {
  const par = (VOICE_VERBS[form.device] || [])[form.par];
  if (!par) return;
  const { voiceOn, voiceOff } = montarComandos(par, form.name);
  if (!form.editadoOn) {
    form.voiceOn = voiceOn;
    document.getElementById('input-voice-on').value = voiceOn;
  }
  if (!form.editadoOff) {
    form.voiceOff = voiceOff;
    document.getElementById('input-voice-off').value = voiceOff;
  }
}
```

Verificar em `css/*.css` se `.suggestion-chip.selected` tem estilo; se não houver, adicionar logo depois da regra `.suggestion-chip:hover` (≈ linha 501 do CSS em que ela está):

```css
.suggestion-chip.selected { background: var(--accent-weak); color: var(--text); border-color: var(--border-strong); font-weight: 700; }
```

- [ ] **Step 5: Modo edição**

Em `enterEditMode`, substituir desde `form = {` até antes de `document.getElementById('btn-save-auto').textContent = 'Salvar alterações';` por:

```js
  form = formVazio(d.deviceType);
  form.name = d.deviceName;
  form.trigger = d.trigger;
  form.voiceOn = d.voiceOn || '';
  form.voiceOff = d.voiceOff || '';
  // Se as frases salvas ainda são exatamente as geradas por um par, renomear
  // continua recalculando; se não, o usuário as escreveu e ficam como estão.
  const pares = VOICE_VERBS[form.device] || [];
  const i = pares.findIndex(p => {
    const c = montarComandos(p, form.name);
    return c.voiceOn === form.voiceOn && c.voiceOff === form.voiceOff;
  });
  form.par = i >= 0 ? i : null;
  form.editadoOn = form.editadoOff = i < 0;

  document.getElementById('form-wrap').style.display = 'block';
  document.getElementById('btn-new-auto').textContent = '✕ Cancelar';

  document.querySelectorAll('#device-chips .chip').forEach(c => {
    const escolhido = c.dataset.id === form.device;
    c.classList.toggle('selected', escolhido);
    c.setAttribute('aria-pressed', String(escolhido));
  });

  document.getElementById('input-name').value = form.name;
  document.getElementById('step-name').style.display = 'block';

  document.getElementById('step-trigger').style.display = 'block';
  renderTriggerChips();
  showTriggerNote(form.trigger, form.device);

  if (form.trigger === 'voz') {
    renderVoiceVerbs();
    document.getElementById('input-voice-on').value = form.voiceOn;
    document.getElementById('input-voice-off').value = form.voiceOff;
    document.getElementById('step-voice').style.display = 'block';
  } else {
    document.getElementById('step-voice').style.display = 'none';
  }
```

- [ ] **Step 6: Prévia, validação e aviso**

Substituir `updatePreview` inteira por:

```js
function _listaCache() {
  return Object.keys(_automationsCache).map(id => ({ id, data: _automationsCache[id] }));
}

// Mensagem que impede salvar (null = ok) e aviso que só informa.
function validarVoz() {
  if (form.trigger !== 'voz') return { erro: null, aviso: null };
  const on = form.voiceOn.trim(), off = form.voiceOff.trim();
  if (!on || !off) return { erro: 'Preencha o comando para ligar e o para desligar.', aviso: null };
  if (normalizarFrase(on) === normalizarFrase(off)) {
    return { erro: 'Os dois comandos precisam ser diferentes.', aviso: null };
  }
  const repetida = comandoJaUsado(on, _listaCache(), editingId) || comandoJaUsado(off, _listaCache(), editingId);
  const aviso = repetida
    ? `Atenção: a automação "${repetida.data.deviceName}" já usa um desses comandos. Só uma delas vai responder.`
    : null;
  return { erro: null, aviso };
}

function updatePreview() {
  const previewWrap = document.getElementById('preview-wrap');
  const previewBox = document.getElementById('preview-box');
  const saveBtn = document.getElementById('btn-save-auto');
  const avisoEl = document.getElementById('voice-aviso');

  const d = DEVICES.find(x => x.id === form.device);
  if (!d) { previewWrap.style.display = 'none'; return; }
  previewWrap.style.display = 'block';

  const name = form.name.trim() || d.name;
  const nome = `<strong>${escapeHtml(name)}</strong>`;
  const alternar = `vai alternar o dispositivo ${nome} (${descAlternar(form.device)})`;
  const trigger = form.trigger;

  let text;
  if (trigger === 'voz') {
    const on = escapeHtml(form.voiceOn.trim() || '…');
    const off = escapeHtml(form.voiceOff.trim() || '…');
    text = `Ao falar "<strong>${on}</strong>", liga ${nome}; ao falar "<strong>${off}</strong>", desliga.`;
  } else if (trigger === 'botao') {
    text = `Ao clicar no botão do dashboard, ${alternar}`;
  } else if (trigger === 'presenca') {
    text = `Ao detectar presença, ${alternar}`;
  } else if (trigger === 'temperatura') {
    text = `Quando o sensor de temperatura disparar, ${alternar}`;
  } else if (trigger === 'horario') {
    text = `No horário programado no Arduino, ${alternar}`;
  } else {
    text = `<strong>${escapeHtml(d.name)}</strong> — escolha o gatilho`;
  }
  previewBox.innerHTML = text;

  const { erro, aviso } = validarVoz();
  const mensagem = erro || aviso;
  avisoEl.textContent = mensagem || '';
  avisoEl.style.display = mensagem ? 'block' : 'none';

  const isReady = !!(trigger && form.name.trim() && !erro);
  previewBox.classList.toggle('ready', isReady);
  saveBtn.style.display = isReady ? 'inline-flex' : 'none';
}
```

- [ ] **Step 7: Eventos dos campos**

Substituir o listener de `input-name` e o de `input-voice` (linhas 318-332) por:

```js
document.getElementById('input-name').addEventListener('input', e => {
  form.name = e.target.value;
  if (form.name.trim()) {
    document.getElementById('step-trigger').style.display = 'block';
    renderTriggerChips();
  } else {
    hideFrom('step-trigger');
  }
  if (form.trigger === 'voz') recalcularComandos();
  updatePreview();
});

document.getElementById('input-voice-on').addEventListener('input', e => {
  form.voiceOn = e.target.value;
  form.editadoOn = true;
  updatePreview();
});

document.getElementById('input-voice-off').addEventListener('input', e => {
  form.voiceOff = e.target.value;
  form.editadoOff = true;
  updatePreview();
});
```

> Observação: apagar o nome esconde a etapa de gatilho (`hideFrom`) mas mantém `form.trigger`. Isso já era assim antes; não mudar.

- [ ] **Step 8: Salvar**

No listener de `btn-save-auto`, trocar as duas linhas de guarda e a montagem de `data` (linhas 338-351) por:

```js
  if (!form.device || !form.trigger || !form.name.trim()) return;
  if (validarVoz().erro) return;
  const btn = document.getElementById('btn-save-auto');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  const data = {
    deviceType: form.device,
    deviceName: form.name.trim(),
    trigger: form.trigger,
    action: 'toggle'
  };
  if (form.trigger === 'voz') {
    data.voiceOn = form.voiceOn.trim();
    data.voiceOff = form.voiceOff.trim();
  } else if (editingId) {
    data.voiceOn = firebase.firestore.FieldValue.delete();
    data.voiceOff = firebase.firestore.FieldValue.delete();
  }
```

- [ ] **Step 9: Reset**

Em `resetForm`, trocar `document.getElementById('input-voice').value = '';` por `limparCamposVoz();` e, depois da linha do `trigger-note`, esconder o aviso:

```js
  const avisoEl = document.getElementById('voice-aviso');
  if (avisoEl) avisoEl.style.display = 'none';
```

- [ ] **Step 10: Conferir que não sobrou referência velha**

Run: `grep -n "voiceCommand\|getActions\|renderActionChips\|action-step-num\|step-action\|input-voice'\|VOICE_SUGGESTIONS\|form.action" js/automation.js automation.html`
Expected: nenhuma linha.

Run: `node --test tools/*.test.js`
Expected: todos PASS.

- [ ] **Step 11: Verificação manual no navegador**

Pedir ao usuário para rodar `node server.js` no terminal dele e abrir `http://localhost:8080/automation.html` logado (conta de demo). Conferir, com o console do navegador aberto (sem erros vermelhos):

1. Luz → nome "Luz Quarto" → Voz: chip "Acender / Apagar" marcado; campos "Acender Luz Quarto" / "Apagar Luz Quarto"; não existe mais a etapa "Ação".
2. Tocar "Ligar / Desligar": campos viram "Ligar Luz Quarto" / "Desligar Luz Quarto".
3. Editar à mão o campo de desligar para "Desligar tudo"; mudar o nome para "Luz Sala" → ligar vira "Ligar Luz Sala", desligar continua "Desligar tudo". *(Review Focus 5)*
4. Escrever "ligar luz sala!" no campo de desligar → aviso "Os dois comandos precisam ser diferentes." e botão de salvar some. *(Review Focus 3)*
5. Corrigir e salvar; na lista aparece *você falar "…" (liga) ou "…" (desliga)*.
6. Editar a automação salva: os dois campos voltam preenchidos; trocar o gatilho para Botão e salvar; editar de novo e voltar para Voz: frases recalculadas do primeiro par.
7. Criar uma segunda automação de voz com o mesmo comando → aviso "já usa um desses comandos", mas deixa salvar.
8. Automação de Presença: prévia diz "vai alternar o dispositivo … (liga se estiver desligada, …)".

- [ ] **Step 12: Commit**

```bash
git add automation.html js/automation.js css/
git commit -m "feat: formulario sem escolha de acao e com comando de ligar e de desligar"
```

---

### Task 3: Microfone reconhece os comandos salvos

**Files:**
- Modify: `js/voice.js:23-57` (estado + `onresult`)
- Modify: `js/dashboard.js` (`acionarDispositivo`, `listenAutomations`, `logHistory`, `initVoice`)
- Modify: `server.js:45-54` (dados do preview)

**Interfaces:**
- Consumes (Task 1): `encontrarComando(fala, automacoes) → { automation, state, frase } | null` — global, porque `dashboard.html` carrega `js/devices.js` antes de `js/voice.js`.
- Produces:
  - `voiceControl.setAutomacoes(lista: Array<{id, data}>)`.
  - `voiceControl.onResult` recebe `{ command, deviceId, action, automationName, frase }` — os dois últimos são `null` quando o comando veio do fallback fixo.
  - `logHistory(deviceId, trigger, state, nome?)` — `nome` opcional sobrepõe o nome do histórico.

- [ ] **Step 1: `voice.js` consulta as automações antes do fallback**

Depois de `let _sessionCounter = 0;` adicionar:

```js
  // Automações do usuário, atualizadas pelo dashboard a cada snapshot.
  let _automacoes = [];
```

Dentro de `const api = {`, depois de `isListening() { ... },` adicionar:

```js
    setAutomacoes(lista) { _automacoes = lista || []; },
```

Trocar o corpo de `recognition.onresult` por:

```js
      recognition.onresult = (e) => {
        if (_sessionId !== _sessionCounter) return;
        const command = e.results[0][0].transcript.trim();
        if (!api.onResult) return;
        // Primeiro os comandos que o usuário salvou; se nenhum casar, os
        // padrões fixos — assim a voz funciona mesmo sem automação cadastrada.
        const salvo = encontrarComando(command, _automacoes);
        if (salvo) {
          api.onResult({
            command,
            deviceId: salvo.automation.data.deviceType,
            action: salvo.state,
            automationName: salvo.automation.data.deviceName,
            frase: salvo.frase
          });
          return;
        }
        const match = COMMANDS.find(c => c.pattern.test(command));
        api.onResult({
          command,
          deviceId: match?.deviceId || null,
          action: match !== undefined ? match.action : null,
          automationName: null,
          frase: null
        });
      };
```

Trocar o comentário da linha 1 por:

```js
// Web Speech API — comandos salvos nas automações de voz e, como reserva,
// frases fixas mapeadas para dispositivos.
```

- [ ] **Step 2: Dashboard entrega a lista ao microfone**

Em `listenAutomations`, logo depois de montar `automationsList` e antes de `renderAutomations();`:

```js
      voiceControl.setAutomacoes(automationsList);
```

Em `_teardownListeners`, depois de `automationsList = [];`:

```js
  voiceControl.setAutomacoes([]);
```

- [ ] **Step 3: Botão sempre alterna**

Em `acionarDispositivo`, trocar:

```js
  const action = item.data.action || 'toggle';
  const newState = action === 'on' ? true : action === 'off' ? false : !prevState;
```

por:

```js
  const newState = !prevState;   // toda automação alterna
```

- [ ] **Step 4: Histórico com o nome da automação falada**

Trocar a assinatura e a linha do nome em `logHistory`:

```js
async function logHistory(deviceId, trigger, state, nome) {
  const device = DEVICES.find(d => d.id === deviceId);
  if (!device) return;
  const deviceName = nome || automationNames[deviceId] || device.name;
```

- [ ] **Step 5: Mensagem de reconhecimento e dica do microfone**

Em `initVoice`, trocar a assinatura do `onResult` e as linhas de `logHistory`/status:

```js
  voiceControl.onResult = async ({ command, deviceId, action, automationName, frase }) => {
    if (deviceId && action !== null) {
      try {
        if (!currentUser) return;
        _voiceResultHandled = true;
        await rtdb.ref(`commands/${currentUser.uid}/${deviceId}`).set({ state: action, ts: Date.now() });
        await logHistory(deviceId, 'voz', action, automationName);
        aguardarConfirmacao(deviceId, action);
        status.textContent = `Comando reconhecido: "${frase || command}"`;
```

(o resto do `try/catch` e o `else` ficam iguais)

No clique do botão, trocar a linha da dica:

```js
      status.textContent = `Fale um comando (ex: "${exemploDeComando()}")`;
```

e adicionar, logo antes de `function initVoice()`:

```js
// Mostra na dica um comando que o usuário salvou, se houver algum ativo.
function exemploDeComando() {
  const voz = automationsList.find(a => a.data.trigger === 'voz' && a.data.enabled !== false && a.data.voiceOn);
  return voz ? voz.data.voiceOn : 'acender luz';
}
```

- [ ] **Step 6: Preview com dados no formato novo**

Em `server.js`, substituir as 8 linhas de `items:` (a1–a8) por:

```js
      { id: 'a1', data: { deviceType: 'luz',        deviceName: 'Luz da sala',          trigger: 'botao',       action: 'toggle', enabled: true,  createdAt: ts(now - 7 * 86400000) } },
      { id: 'a2', data: { deviceType: 'ventilador', deviceName: 'Ventilador do quarto', trigger: 'botao',       action: 'toggle', enabled: true,  createdAt: ts(now - 7 * 86400000) } },
      { id: 'a3', data: { deviceType: 'portao',     deviceName: 'Portão da garagem',    trigger: 'botao',       action: 'toggle', enabled: true,  createdAt: ts(now - 6 * 86400000) } },
      { id: 'a4', data: { deviceType: 'alarme',     deviceName: 'Alarme da entrada',    trigger: 'botao',       action: 'toggle', enabled: true,  createdAt: ts(now - 6 * 86400000) } },
      { id: 'a5', data: { deviceType: 'luz',        deviceName: 'Luz da sala',          trigger: 'presenca',    action: 'toggle', enabled: true,  createdAt: ts(now - 4 * 86400000) } },
      { id: 'a6', data: { deviceType: 'ventilador', deviceName: 'Ventilador do quarto', trigger: 'temperatura', action: 'toggle', enabled: true,  createdAt: ts(now - 3 * 86400000) } },
      { id: 'a7', data: { deviceType: 'portao',     deviceName: 'Portão Garagem',       trigger: 'voz',         action: 'toggle', enabled: true,  voiceOn: 'Abrir Portão Garagem', voiceOff: 'Fechar Portão Garagem', createdAt: ts(now - 2 * 86400000) } },
      { id: 'a8', data: { deviceType: 'alarme',     deviceName: 'Alarme da entrada',    trigger: 'horario',     action: 'toggle', enabled: false, createdAt: ts(now - 1 * 86400000) } }
```

- [ ] **Step 7: Conferências automáticas**

Run: `grep -rn "voiceCommand\|getActions\|ACTIONS_" js/ server.js *.html`
Expected: nenhuma linha.

Run: `node --test tools/*.test.js`
Expected: todos PASS.

Run: `node --check server.js && node --check js/voice.js && node --check js/dashboard.js && node --check js/automation.js && node --check js/devices.js`
Expected: sem saída (sintaxe ok).

- [ ] **Step 8: Verificação manual**

1. `http://localhost:8080/dashboard.html?preview=1`: card do "Portão Garagem" mostra os dois comandos; cards de presença/temperatura dizem "alternar"; console sem erros.
2. Logado na conta de demo, com uma automação de voz "Luz Quarto" criada na Task 2: clicar no microfone, a dica mostra `ex: "Acender Luz Quarto"`; falar "acender a luz do quarto" → "Comando reconhecido: "Acender Luz Quarto""; o histórico registra "Luz Quarto".
3. Falar "apagar luz quarto" → desliga.
4. Desativar a automação no interruptor e falar "acender luz quarto" → cai no padrão fixo (`acender … luz` casa com o regex de luz) e liga a luz: isso é o fallback esperado, não um bug. Falar "abrir portão garagem" com a automação de portão desativada também cai no fixo. Falar "tocar música" → "Não entendi".
5. No celular (GitHub Pages só depois do push; antes disso, pular este item e fazer na Task 4).

- [ ] **Step 9: Commit**

```bash
git add js/voice.js js/dashboard.js server.js
git commit -m "feat: microfone reconhece os comandos de ligar e desligar salvos nas automacoes"
```

---

### Task 4: Limpar as automações de teste e fechar

**Files:**
- Create: `tools/limpar-automacoes.js`

**Interfaces:**
- Consumes: service account `*firebase-adminsdk*.json` na raiz do repo (ignorado pelo git), `backend/node_modules/firebase-admin`.
- Produces: backup JSON em pasta **fora do repo**; automações apagadas só com `--apagar`.

- [ ] **Step 1: Escrever o script**

```js
'use strict';
// Backup e limpeza das automações de teste (formato antigo, com
// voiceCommand/action escolhida). Uso:
//   node tools/limpar-automacoes.js <pasta-de-backup>            -> só lista e salva backup
//   node tools/limpar-automacoes.js <pasta-de-backup> --apagar   -> salva backup e apaga
// A pasta de backup deve ficar FORA do repositório.
const fs = require('fs');
const path = require('path');
const admin = require('../backend/node_modules/firebase-admin');

const RAIZ = path.join(__dirname, '..');
const chave = fs.readdirSync(RAIZ).find(f => /firebase-adminsdk.*\.json$/.test(f));
if (!chave) { console.error('Service account não encontrada na raiz do repo.'); process.exit(1); }

const pastaBackup = process.argv[2];
const apagar = process.argv.includes('--apagar');
if (!pastaBackup || pastaBackup.startsWith('--')) {
  console.error('Informe a pasta de backup (fora do repo).'); process.exit(1);
}
if (path.resolve(pastaBackup).startsWith(path.resolve(RAIZ))) {
  console.error('A pasta de backup não pode ficar dentro do repositório.'); process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(path.join(RAIZ, chave))) });
const db = admin.firestore();

(async () => {
  const donos = await db.collection('automations').listDocuments();
  const backup = {};
  let total = 0;
  for (const dono of donos) {
    const snap = await dono.collection('items').get();
    backup[dono.id] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    total += snap.size;
    console.log(`${dono.id}: ${snap.size} automação(ões)`);
  }
  fs.mkdirSync(pastaBackup, { recursive: true });
  const arquivo = path.join(pastaBackup, `automacoes-backup-${Date.now()}.json`);
  fs.writeFileSync(arquivo, JSON.stringify(backup, null, 2));
  console.log(`Backup de ${total} automação(ões) em ${arquivo}`);

  if (!apagar) { console.log('Nada apagado (rode com --apagar para apagar).'); return; }
  for (const dono of donos) {
    const snap = await dono.collection('items').get();
    for (const d of snap.docs) await d.ref.delete();
  }
  console.log(`Apagadas ${total} automação(ões).`);
})().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Rodar sem apagar**

Run: `node tools/limpar-automacoes.js "C:/Users/WINDOWS/Documents/backups-tcc"`
Expected: lista por UID, contagem e caminho do backup; "Nada apagado".

- [ ] **Step 3: Pedir confirmação ao usuário**

Mostrar a contagem por conta ao usuário e **esperar um "sim" explícito** antes do próximo passo. Apagar dados não tem volta além do backup.

- [ ] **Step 4: Apagar (só depois do sim)**

Run: `node tools/limpar-automacoes.js "C:/Users/WINDOWS/Documents/backups-tcc" --apagar`
Expected: "Apagadas N automação(ões)." e rodar de novo sem `--apagar` mostra 0 em todas as contas.

- [ ] **Step 5: Commit do script**

```bash
git add tools/limpar-automacoes.js
git commit -m "chore: script de backup e limpeza das automacoes de teste"
```

- [ ] **Step 6: Publicar e testar no celular (com o usuário)**

Perguntar ao usuário antes do `git push` (o push republica o site no GitHub Pages em 1-2 min). Depois, no celular, na conta de demo: criar uma automação de voz para a luz, falar os dois comandos e confirmar que liga e desliga.

- [ ] **Step 7: Atualizar a memória do projeto**

Em `project-tcc.md` da memória: automações agora sempre alternam, voz tem `voiceOn`/`voiceOff`, automações de teste apagadas em 2026-09-23 (backup em `C:/Users/WINDOWS/Documents/backups-tcc`). Em `reference-ambiente-tcc.md`: registrar `tools/limpar-automacoes.js`.
