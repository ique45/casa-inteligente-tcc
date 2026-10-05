# Monitor serial no histórico e automações coerentes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar o monitor serial do painel e pô-lo no histórico atrás de um botão; deixar o formulário de automações só com Voz e Botão físico; trocar a resposta de voz da luz externa.

**Architecture:** Site estático (HTML + JS sem bundler, Firebase compat SDK). `js/devices.js` é compartilhado entre páginas e exporta para os testes Node via `module.exports`; a lista de gatilhos sai de `js/automation.js` para lá, para ser testável. Backend e firmware não mudam.

**Tech Stack:** HTML/CSS/JS puro, Firebase Auth + Firestore + Realtime Database (compat 10.12), testes com `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-05-serial-no-historico-e-automacoes-design.md`

## Global Constraints

- Textos em português, exatamente:
  - Resposta de voz da luz externa: `A luz externa acende sozinha quando escurece.`
  - Subtítulo do painel, "Suas automações": `Frases de voz suas e o que o botão da maquete faz`
  - Subtítulo de `automation.html`: `Crie suas próprias frases de voz ou escolha o que o botão da maquete faz`
  - Botão do histórico: `Ver monitor serial` (fechado) / `Esconder monitor serial` (aberto)
- Gatilhos do formulário: `luz` e `alarme_armado` → `['voz', 'botao_fisico']`.
- Não mexer em `backend/`, `firmware/`, filtros do histórico nem `TRIGGER_INFO`/`describeAutomation` (o histórico antigo ainda usa os rótulos).
- Não fazer `git push` sem o usuário pedir: push no `master` publica o site no GitHub Pages.
- Nunca commitar `firmware/esp8266/casa_inteligente/casa_inteligente.ino` (tem WiFi e token reais, modificado no working tree).
- Testes: `node --test tools/*.test.js` (57 passam hoje).

## Review Focus

1. Abrir/fechar o monitor várias vezes não pode empilhar listeners (cada linha aparecendo duplicada ou download repetido) — o listener anterior é sempre desligado antes de ligar outro.
2. Sair da conta com o monitor aberto desliga o listener (sem erro de permissão no console depois do logout).
3. Log vazio ou nó inexistente (placa nunca ligou nessa conta) mostra "Aguardando a placa…", sem quebrar.
4. Uma automação antiga com gatilho removido (`botao`, `presenca`, `luminosidade`) ainda aparece no painel com descrição legível e pode ser desligada/editada sem erro (nenhuma conta tem hoje, mas o código não pode quebrar se surgir).
5. Voz "apagar a luz externa" (ação false) também responde a frase nova, não só "acender".

Itens 1–3 são verificados no Task 3 (função pura testada + passo de navegador); 4 e 5 no Task 1/2.

---

### Task 1: Gatilhos e resposta de voz em `js/devices.js`

**Files:**
- Modify: `js/devices.js` (linha 3, luz externa; bloco `module.exports` no fim)
- Modify: `js/automation.js:1-5` (remove a constante local), `js/automation.js:87-97` (`getTriggerNote`), `js/automation.js:~285-300` (`updatePreview`)
- Modify: `automation.html` (subtítulo)
- Test: `tools/voice-commands.test.js`

**Interfaces:**
- Produces: `TRIGGERS_BY_DEVICE` (objeto `{ luz: string[], alarme_armado: string[] }`) global no navegador e exportado; `DEVICES[luz_externa].respostaVoz` (string). Task 2 usa `respostaVoz`.

- [ ] **Step 1: Testes que falham** — acrescentar ao fim de `tools/voice-commands.test.js`:

```js
// ---- Gatilhos oferecidos e resposta da luz externa (2026-10-05) ----
const { TRIGGERS_BY_DEVICE, DEVICES } = require('../js/devices.js');

test('formulario oferece so voz e botao fisico', () => {
  assert.deepStrictEqual(TRIGGERS_BY_DEVICE.luz, ['voz', 'botao_fisico']);
  assert.deepStrictEqual(TRIGGERS_BY_DEVICE.alarme_armado, ['voz', 'botao_fisico']);
  assert.strictEqual(TRIGGERS_BY_DEVICE.luz_externa, undefined);
  assert.strictEqual(TRIGGERS_BY_DEVICE.alarme, undefined);
});

test('luz externa explica que acende sozinha', () => {
  const ext = DEVICES.find(d => d.id === 'luz_externa');
  assert.strictEqual(ext.respostaVoz, 'A luz externa acende sozinha quando escurece.');
});

test('automacao antiga com gatilho removido ainda e descrita', () => {
  for (const trigger of ['botao', 'presenca', 'luminosidade']) {
    const { whenText, thenText } = describeAutomation(
      { deviceType: 'luz', deviceName: 'Luz', trigger, action: 'toggle', enabled: true });
    assert.ok(whenText && thenText, `sem descricao para ${trigger}`);
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/voice-commands.test.js`
Expected: FAIL nos dois primeiros (`TRIGGERS_BY_DEVICE` undefined, `respostaVoz` undefined). O terceiro já deve passar (confirma que `describeAutomation` cobre os antigos).

- [ ] **Step 3: Implementar em `js/devices.js`**

Na entrada da luz externa (linha 3), depois de `nota: '...'`, acrescentar o campo:

```js
    nota: 'Acende sozinha quando escurece (LDR) e apaga quando clareia.',
    respostaVoz: 'A luz externa acende sozinha quando escurece.' },
```

Logo antes de `const TRIGGER_INFO = {`, acrescentar:

```js
// Gatilhos que o formulário de automação oferece. Escureceu e objeto perto
// ficaram de fora: a placa já cuida da luz externa e da sirene sozinha.
// Botão no dashboard também: os cartões de "Agora na casa" já fazem isso.
// TRIGGER_INFO continua com todos, porque o histórico antigo usa os rótulos.
const TRIGGERS_BY_DEVICE = {
  luz:           ['voz', 'botao_fisico'],
  alarme_armado: ['voz', 'botao_fisico']
};
```

No `module.exports`, acrescentar `TRIGGERS_BY_DEVICE` à primeira linha: `DEVICES, TRIGGERS_BY_DEVICE, escapeHtml, formatRelativeTime, frasePara,`.

- [ ] **Step 4: Tirar a constante de `js/automation.js`** — apagar as linhas 1-5 (`const TRIGGERS_BY_DEVICE = { ... };` e o comentário da luz externa/sirene). `automation.html` já carrega `js/devices.js` antes de `js/automation.js` (conferir com `grep -n "devices.js\|automation.js" automation.html`; se a ordem for outra, corrigir).

- [ ] **Step 5: Limpar os ramos dos gatilhos removidos em `js/automation.js`**

`getTriggerNote` passa a ser:

```js
function getTriggerNote(triggerId) {
  const NOTAS = {
    botao_fisico: 'Requer o botão (push button) ligado à placa. Cada apertada alterna o estado.'
  };
  return NOTAS[triggerId] || null;
}
```

Nas chamadas `getTriggerNote(x, y)` o segundo argumento passa a ser ignorado; deixar as chamadas como estão. Se `descAlternar` ficar sem uso em `automation.js`, não remover (é usado no preview).

Em `updatePreview`, apagar os ramos `else if (trigger === 'botao')`, `else if (trigger === 'presenca')` e `else if (trigger === 'luminosidade')`, mantendo `voz` e `botao_fisico` e o `else` final que já existir.

- [ ] **Step 6: Subtítulo de `automation.html`** — trocar `Regras automáticas para seus dispositivos` por `Crie suas próprias frases de voz ou escolha o que o botão da maquete faz`.

- [ ] **Step 7: Rodar os testes**

Run: `node --test tools/*.test.js`
Expected: 60 pass, 0 fail.

- [ ] **Step 8: Commit**

```bash
git add js/devices.js js/automation.js automation.html tools/voice-commands.test.js
git commit -m "feat: automacoes so com voz e botao fisico; resposta de voz da luz externa"
```

---

### Task 2: Painel sem monitor serial e sem botão de automação "botão"

**Files:**
- Modify: `dashboard.html:87-98` (CSS `.serial-*`), `dashboard.html:159-167` (seção), subtítulo de "Suas automações"
- Modify: `js/dashboard.js` — `renderSerial` (~164-186), chamada em `listenArduinoStatus` (~381), `primaryBtnHtml` em `renderAutomations` (~205-220 e o listener `.automation-card-primary-btn`), `acionarDispositivo` (~252-283), laços `trigger !== 'botao'` em `mostrarEstadoReal` e `updateDeviceUI`, ramo `somenteLeitura` do `voiceControl.onResult` (~510)
- Modify: `css/app.css:403-411` (`.automation-card-primary-*`)

**Interfaces:**
- Consumes: `DEVICES[...].respostaVoz` (Task 1).

- [ ] **Step 1: Remover a seção do HTML** — apagar o bloco de `dashboard.html` que vai de `<div class="section-header" style="margin-top:1.75rem">` (o que contém `Monitor serial`) até o `</div>` que fecha `#serial-box`. Apagar também o CSS de `/* ── Monitor serial ── */` até `.serial-vazio { ... }` (Task 3 recria no histórico).

- [ ] **Step 2: Subtítulo** — em `dashboard.html`, trocar `Ative, desative ou edite as automações que você criou` por `Frases de voz suas e o que o botão da maquete faz`.

- [ ] **Step 3: Remover `renderSerial`** — apagar o bloco `// ---- Monitor serial ----` inteiro (comentário + função) em `js/dashboard.js` e a linha `renderSerial();` dentro de `listenArduinoStatus`.

- [ ] **Step 4: Remover o botão grande dos cartões** — em `renderAutomations`, apagar o comentário "Só a automação de gatilho "botão"..." e o bloco `let primaryBtnHtml = ''; if (d.trigger === 'botao' && device) { ... }`, a linha `${primaryBtnHtml}` do template, e o laço final `grid.querySelectorAll('.automation-card-primary-btn').forEach(...)`. Apagar a função `acionarDispositivo` inteira. Em `mostrarEstadoReal` e `updateDeviceUI`, apagar os laços `automationsList.forEach(item => { if (item.data.trigger !== 'botao' ...) ... });`. Ajustar o comentário acima de `updateDeviceUI` para: `// Anuncia por voz toda mudanca de estado confirmada pelo Firebase — venha do card, da voz ou do ESP8266.` Em `css/app.css`, apagar as regras `.automation-card-primary-wrap`, `.automation-card-primary-btn`, `.automation-card-primary-btn.on` e `.automation-card-primary-btn:disabled`.

Conferir que nada mais referencia o que saiu:

Run: `grep -n "acionar\|primary-btn\|primaryBtn\|serial" js/dashboard.js dashboard.html css/app.css`
Expected: nenhuma linha.

- [ ] **Step 5: Frase da luz externa na voz** — no ramo `somenteLeitura` do `voiceControl.onResult`, trocar as linhas que montam `nome`, `status.textContent` e `speech.falar` por:

```js
      const resposta = DEVICES.find(x => x.id === deviceId).respostaVoz
        || `${DEVICES.find(x => x.id === deviceId).name} é controlada pelo sensor da maquete.`;
      status.textContent = resposta;
      speech.falar(resposta);
```

(O ramo cobre "acender" e "apagar", porque testa só o `deviceId`.)

- [ ] **Step 6: Testes**

Run: `node --test tools/*.test.js`
Expected: 60 pass.

- [ ] **Step 7: Commit**

```bash
git add dashboard.html js/dashboard.js css/app.css
git commit -m "feat: painel sem monitor serial e sem botao de automacao 'botao'; frase nova da luz externa"
```

---

### Task 3: Monitor serial no histórico

**Files:**
- Modify: `js/devices.js` (nova função pura `linhasDoSerial`, exportada)
- Modify: `history.html` (CSS dentro do `<style>` existente; botão + quadro depois de `#btn-load-more`)
- Modify: `js/history.js` (abrir/fechar, listener, teardown no logout)
- Test: `tools/voice-commands.test.js`

**Interfaces:**
- Produces: `linhasDoSerial(log) -> string` (HTML das linhas; `log` é o valor de `arduino_status/{uid}/log`, array de `{ t, m }` ou qualquer outra coisa).

- [ ] **Step 1: Testes que falham** — acrescentar a `tools/voice-commands.test.js`:

```js
// ---- Monitor serial (historico) ----
const { linhasDoSerial } = require('../js/devices.js');

test('serial vazio mostra aguardando', () => {
  for (const vazio of [null, undefined, [], {}, 'x']) {
    assert.match(linhasDoSerial(vazio), /Aguardando a placa/);
  }
});

test('serial escapa html e marca alertas', () => {
  const html = linhasDoSerial([
    { t: 0, m: 'Luminosidade: 580' },
    { t: 0, m: 'Falha <b>HTTP</b>' }
  ]);
  assert.ok(!html.includes('<b>'), 'html da placa nao pode virar tag');
  assert.match(html, /class="serial-alerta"[^>]*>.*Falha &lt;b&gt;HTTP/);
  assert.match(html, /Luminosidade: 580/);
});

test('serial aceita log como objeto de chaves', () => {
  assert.match(linhasDoSerial({ a: { t: 0, m: 'Botao apertado' } }), /Botao apertado/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tools/voice-commands.test.js`
Expected: FAIL (`linhasDoSerial is not a function`).

- [ ] **Step 3: Implementar em `js/devices.js`** (antes do bloco `module.exports`) e exportar `linhasDoSerial`:

```js
// Monitor serial: o firmware manda as linhas a cada sync e o backend guarda
// as últimas em arduino_status/{uid}/log como [{ t: hora do recebimento, m }].
// O RTDB pode devolver um array como objeto de chaves, então aceitamos os dois.
function linhasDoSerial(log) {
  const linhas = Array.isArray(log) ? log
    : (log && typeof log === 'object') ? Object.values(log) : [];
  if (!linhas.length) return '<div class="serial-vazio">Aguardando a placa…</div>';
  return linhas.map(l => {
    const hora = l && l.t ? new Date(l.t).toLocaleTimeString('pt-BR') : '';
    const msg = String((l && l.m) || '');
    const alerta = /erro|falha|sem wifi|disparado/i.test(msg);
    return `<div${alerta ? ' class="serial-alerta"' : ''}><span class="serial-hora">${hora}</span>${escapeHtml(msg)}</div>`;
  }).join('');
}
```

- [ ] **Step 4: Rodar**

Run: `node --test tools/*.test.js`
Expected: 63 pass.

- [ ] **Step 5: HTML e CSS do histórico** — no `<style>` de `history.html`, acrescentar:

```css
    .serial-wrap { margin-top: 2rem; }
    .serial-box {
      margin-top: 0.75rem;
      background: #0b0b14; color: #d7f5d7; border-radius: var(--radius);
      border: 2px solid var(--border);
      font-family: Consolas, 'Courier New', monospace; font-size: var(--fs-xs);
      line-height: 1.55; padding: 0.75rem 1rem;
      height: 14rem; overflow-y: auto; white-space: pre-wrap; word-break: break-word;
    }
    .serial-box:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
    .serial-hora { color: #8a93a6; margin-right: 0.6rem; }
    .serial-alerta { color: #ff9b92; }
    .serial-vazio { color: #8a93a6; }
```

Depois do botão `#btn-load-more`, ainda dentro de `<main>`:

```html
      <div class="serial-wrap">
        <button type="button" class="btn btn-secondary" id="btn-serial"
          aria-expanded="false" aria-controls="serial-box">Ver monitor serial</button>
        <div class="serial-box" id="serial-box" role="log" aria-label="Monitor serial da placa"
          tabindex="0" hidden></div>
      </div>
```

- [ ] **Step 6: Lógica em `js/history.js`** — acrescentar antes do listener do `btn-logout`:

```js
// ---- Monitor serial ----
// Só escuta o log enquanto o quadro está aberto: fechado, a página não baixa
// as linhas da placa à toa.
let _serialRef = null;

function pararSerial() {
  if (_serialRef) { _serialRef.off('value'); _serialRef = null; }
}

function abrirSerial() {
  if (!currentUser) return;
  pararSerial();
  const box = document.getElementById('serial-box');
  box.innerHTML = linhasDoSerial(null);
  _serialRef = rtdb.ref(`arduino_status/${currentUser.uid}/log`);
  _serialRef.on('value', snap => {
    // Só desce sozinho se a pessoa já estava no fim; se ela subiu para ler
    // uma linha antiga, não arrancamos a rolagem dela.
    const noFim = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.innerHTML = linhasDoSerial(snap.val());
    if (noFim) box.scrollTop = box.scrollHeight;
  });
}

document.getElementById('btn-serial').addEventListener('click', () => {
  const btn = document.getElementById('btn-serial');
  const box = document.getElementById('serial-box');
  const abrir = box.hidden;
  box.hidden = !abrir;
  btn.setAttribute('aria-expanded', String(abrir));
  btn.textContent = abrir ? 'Esconder monitor serial' : 'Ver monitor serial';
  if (abrir) abrirSerial(); else pararSerial();
});
```

No `auth.onAuthStateChanged`, no ramo `if (!user)`, chamar `pararSerial();` antes do redirect:

```js
  if (!user) { _historyInitialized = false; pararSerial(); window.location.href = 'login.html'; return; }
```

No listener do `btn-logout`, chamar `pararSerial();` antes de `auth.signOut()`.

`history.html` não carrega o SDK do Realtime Database? Conferir: já carrega `firebase-database-compat.js` (linha ~108) e `js/firebase-config.js` define `rtdb` — conferir com `grep -n "rtdb" js/firebase-config.js`.

- [ ] **Step 7: Commit**

```bash
git add js/devices.js js/history.js history.html tools/voice-commands.test.js
git commit -m "feat: monitor serial no historico, atras do botao Ver monitor serial"
```

---

### Task 4: Verificação no navegador

**Files:** nenhum (só verificação; corrigir no task dono se algo falhar).

- [ ] **Step 1:** Usuário roda `node server.js` no terminal dele; abrir `http://localhost:8080/login.html` (nunca 127.0.0.1) e entrar com `demo@casa.com` / `casa1234`.
- [ ] **Step 2: Painel** — sem "Monitor serial"; subtítulo novo em "Suas automações"; console sem erros.
- [ ] **Step 3: Histórico** — clicar "Ver monitor serial": quadro abre, texto do botão vira "Esconder monitor serial", linhas chegam com a placa ligada. Fechar e abrir 3 vezes: linhas não duplicam. Sair da conta com o quadro aberto: nenhum erro `permission_denied` no console.
- [ ] **Step 4: Automações** — escolher Luz interna e Alarme: só aparecem 🎤 Voz e 🔲 Botão físico. Criar e apagar uma automação de voz de teste.
- [ ] **Step 5: Voz** — no Chrome, falar "acender a luz externa" e "apagar a luz externa": tela e fala dizem `A luz externa acende sozinha quando escurece.` e nada vai para `commands/`.
- [ ] **Step 6:** Rodar `node --test tools/*.test.js` (63 pass) e `cd backend && npm test`. Não fazer push: perguntar ao usuário.
