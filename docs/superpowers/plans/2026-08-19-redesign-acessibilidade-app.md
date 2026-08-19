# Redesign de Acessibilidade do App — Plano de Implementação

> **Para executores agênticos:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Goal:** Tornar o app da Casa Inteligente utilizável por idosos e pessoas com baixa visão — tema claro por padrão com alternador, controle de tamanho de texto, confirmação falada e correção dos defeitos de teclado e contraste.

**Architecture:** O `css/app.css` é refatorado para tokens semânticos (uma camada) declarados em dois blocos de tema, e todas as medidas passam de `px` para `rem`. Um script de verificação em Node calcula os contrastes e denuncia cores literais fora dos blocos de tema, servindo de guarda contra regressão. Os controles do usuário vivem numa barra fixa presente em todas as páginas, com preferências em `localStorage` aplicadas por script inline antes da renderização.

**Tech Stack:** HTML/CSS/JS sem framework, scripts globais carregados por `<script>` (sem módulos ES). Testes com o executor embutido do Node 24 (`node --test`) — **nenhuma dependência nova**. Backend Express/Jest permanece intocado.

**Spec:** `docs/superpowers/specs/2026-08-19-redesign-acessibilidade-app-design.md`

**Branch:** `redesign-acessibilidade`

## Global Constraints

- **Alvo de contraste: 7:1 para texto, 3:1 para contornos de componente.** Não é o mínimo AA de 4.5:1.
- **Nenhuma cor literal fora dos dois blocos de tema.** Nem `#hex`, nem `rgb()`, nem `rgba()`. Verificado por script.
- **Nenhuma medida em `px` para texto, espaçamento interno ou alvo de toque.** Usar `rem`. Exceções permitidas: larguras de borda (`1px`, `2px`, `3px`) e sombras.
- **Piso de tamanho de texto: 0.875rem (14px).** Nada menor em nenhuma tela.
- **Alvo de toque mínimo: 2.75rem × 2.75rem (44×44px na escala normal).**
- **`html { font-size: 100% }`** — nunca um valor em `px` na raiz.
- **Texto sobre preenchimentos fracos (`--accent-weak`, `--success-weak`, `--danger-weak`) é sempre `--text`.** Nunca a cor de destaque.
- **Não adicionar `@media (prefers-color-scheme: dark)`.** Decisão deliberada da Seção 1 do spec: o claro é o padrão explícito e só o botão o altera. Seguir a preferência do sistema entregaria o modo pior por padrão a um idoso cujo aparelho está no escuro.
- **Cor nunca sozinha.** Todo estado carrega texto junto (`LIGADO`/`DESLIGADO`, `ATIVA`/`DESLIGADA`). Ao mexer em qualquer badge ou status, não substituir o texto por cor.
- **Idioma pt-BR** em toda copy visível e em `speechSynthesis`.
- **O backend não é tocado.** `cd backend && npm test` deve continuar reportando 18 testes ao final.
- **Commits em português**, prefixados (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).

---

### Task 1: Guardas automatizadas de contraste

Entrega o script que todas as tarefas seguintes usam para se verificar. Escrito com teste antes, porque é lógica pura.

**Files:**
- Create: `tools/check-contrast.js`
- Test: `tools/check-contrast.test.js`

**Interfaces:**
- Consumes: nada (primeira tarefa)
- Produces:
  - `contrast(fgHex, bgHex) -> number` — razão de contraste WCAG
  - `luminance(hex) -> number` — luminância relativa
  - `parseTokens(css, selector) -> { [tokenName]: hex }`
  - `checkPairs(themeName, tokens, pairs, min, kind) -> string[]` — lista de falhas
  - `findStrayColors(css) -> string[]` — cores literais fora dos blocos de tema
  - `run(cssPath) -> string[]` — todas as falhas
  - Executável: `node tools/check-contrast.js` sai com código 1 se houver falha

- [ ] **Step 1: Escrever os testes que falham**

Criar `tools/check-contrast.test.js`:

```js
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test tools/`
Expected: FAIL — `Cannot find module './check-contrast.js'`

- [ ] **Step 3: Implementar o script**

Criar `tools/check-contrast.js`:

```js
'use strict';
const fs = require('fs');
const path = require('path');

const TEXT_PAIRS = [
  ['--text', '--bg'], ['--text', '--surface'], ['--text', '--surface-2'],
  ['--text', '--accent-weak'], ['--text', '--success-weak'], ['--text', '--danger-weak'],
  ['--text-muted', '--bg'], ['--text-muted', '--surface'], ['--text-muted', '--surface-2'],
  ['--text-on-accent', '--accent'],
  ['--accent-text', '--bg'], ['--accent-text', '--surface'],
  ['--success', '--bg'], ['--success', '--surface'],
  ['--danger', '--bg'], ['--danger', '--surface']
];

const UI_PAIRS = [
  ['--border', '--bg'], ['--border', '--surface'],
  ['--border-strong', '--surface'],
  ['--focus-ring', '--bg'], ['--focus-ring', '--surface']
];

const TEXT_MIN = 7;
const UI_MIN = 3;

function srgbToLinear(channel) {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(String(hex).trim());
  if (!m) throw new Error(`cor nao e hex de 6 digitos: ${hex}`);
  const n = parseInt(m[1], 16);
  return 0.2126 * srgbToLinear((n >> 16) & 255)
       + 0.7152 * srgbToLinear((n >> 8) & 255)
       + 0.0722 * srgbToLinear(n & 255);
}

function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

function parseTokens(css, selector) {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`seletor nao encontrado: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const tokens = {};
  for (const decl of css.slice(open + 1, close).split(';')) {
    const m = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/.exec(decl);
    if (m) tokens[m[1]] = m[2];
  }
  return tokens;
}

function checkPairs(themeName, tokens, pairs, min, kind) {
  const falhas = [];
  for (const [fg, bg] of pairs) {
    if (!tokens[fg] || !tokens[bg]) {
      falhas.push(`${themeName}: token ausente no par ${fg} sobre ${bg}`);
      continue;
    }
    const ratio = contrast(tokens[fg], tokens[bg]);
    if (ratio < min) {
      falhas.push(`${themeName}: ${fg} sobre ${bg} = ${ratio.toFixed(2)}:1 (${kind} exige ${min}:1)`);
    }
  }
  return falhas;
}

function findStrayColors(css) {
  const lines = css.split(/\r?\n/);
  const stray = [];
  let depth = 0;
  let inTheme = false;
  lines.forEach((line, i) => {
    if (/^:root(\s*\{|\[data-theme)/.test(line.trim())) inTheme = true;
    if (!inTheme && /#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(line)) {
      stray.push(`css/app.css:${i + 1}: ${line.trim()}`);
    }
    depth += (line.match(/\{/g) || []).length;
    depth -= (line.match(/\}/g) || []).length;
    if (inTheme && depth === 0) inTheme = false;
  });
  return stray;
}

function run(cssPath) {
  const css = fs.readFileSync(cssPath, 'utf8');
  const claro = parseTokens(css, ':root {');
  const escuro = parseTokens(css, ':root[data-theme="dark"]');
  return [
    ...checkPairs('claro', claro, TEXT_PAIRS, TEXT_MIN, 'texto'),
    ...checkPairs('claro', claro, UI_PAIRS, UI_MIN, 'contorno'),
    ...checkPairs('escuro', escuro, TEXT_PAIRS, TEXT_MIN, 'texto'),
    ...checkPairs('escuro', escuro, UI_PAIRS, UI_MIN, 'contorno'),
    ...findStrayColors(css).map(s => `cor literal fora dos blocos de tema — ${s}`)
  ];
}

module.exports = { luminance, contrast, parseTokens, checkPairs, findStrayColors, run, TEXT_PAIRS, UI_PAIRS, TEXT_MIN, UI_MIN };

if (require.main === module) {
  const falhas = run(path.join(__dirname, '..', 'css', 'app.css'));
  if (falhas.length) {
    console.error('REPROVADO:\n' + falhas.map(f => '  ' + f).join('\n'));
    process.exit(1);
  }
  console.log('OK — todos os pares atingem o alvo nos dois temas, sem cores literais soltas.');
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test tools/`
Expected: PASS — 11 testes

- [ ] **Step 5: Commit**

```bash
git add tools/check-contrast.js tools/check-contrast.test.js
git commit -m "test: verificador de contraste e de cores literais"
```

---

### Task 2: Tokens semânticos e paleta

Substitui o `:root` atual pelos dois blocos de tema e converte toda cor literal do arquivo. É a maior tarefa em volume de edição, e o script da Task 1 diz quando terminou.

**Files:**
- Modify: `css/app.css:3-17` (bloco `:root`) e todas as regras com cor literal

**Interfaces:**
- Consumes: `node tools/check-contrast.js` da Task 1
- Produces: os 17 tokens abaixo, consumidos por todas as tarefas seguintes

- [ ] **Step 1: Substituir o bloco `:root`**

O seletor do tema claro precisa ser exatamente `:root {` (com espaço antes da chave) — é assim que o parser da Task 1 o distingue do bloco escuro.

```css
:root {
  --bg: #f8f8fb;
  --surface: #ffffff;
  --surface-2: #f1f1f6;
  --border: #70708a;
  --border-strong: #5b21b6;
  --text: #14141f;
  --text-muted: #4b5563;
  --text-on-accent: #ffffff;
  --accent: #5b21b6;
  --accent-hover: #4c1d95;
  --accent-text: #5b21b6;
  --accent-weak: #ede9fe;
  --success: #14532d;
  --success-weak: #dcfce7;
  --danger: #7f1d1d;
  --danger-weak: #fee2e2;
  --focus-ring: #5b21b6;
  --radius: 0.75rem;
}

:root[data-theme="dark"] {
  --bg: #050510;
  --surface: #0d0d1f;
  --surface-2: #0a0a18;
  --border: #5a5a92;
  --border-strong: #a78bfa;
  --text: #ffffff;
  --text-muted: #94a3b8;
  --text-on-accent: #ffffff;
  --accent: #6d28d9;
  --accent-hover: #5b21b6;
  --accent-text: #a78bfa;
  --accent-weak: #241a3f;
  --success: #4ade80;
  --success-weak: #10281a;
  --danger: #f87171;
  --danger-weak: #2e1414;
  --focus-ring: #a78bfa;
}
```

Notas sobre valores que parecem arbitrários e não são:

- `--accent` e `--accent-text` são cores diferentes de propósito. `--accent` é preenchimento, com `--text-on-accent` por cima; `--accent-text` é texto sobre a página. No tema escuro os dois divergem (`#6d28d9` vs `#a78bfa`) porque o mesmo roxo não atinge 7:1 nas duas situações.
- `--border` no escuro sobe de `#2a2a50` para `#5a5a92`: o valor antigo dá **1.49:1** contra o fundo, e contorno de componente exige 3:1.
- `--accent`/`--success`/`--danger` no escuro são usados como preenchimento e como texto respectivamente; os `-weak` são fundos escuros sólidos (não `rgba`) para que o verificador consiga medi-los.

- [ ] **Step 2: Rodar o verificador e ver a lista do que falta converter**

Run: `node tools/check-contrast.js`
Expected: FAIL — dezenas de linhas "cor literal fora dos blocos de tema", uma por regra ainda não convertida. Essa saída **é** a lista de trabalho do próximo passo.

- [ ] **Step 3: Converter as cores literais**

Percorrer a lista do passo anterior aplicando este mapeamento:

| Literal atual | Token |
|---|---|
| `#fff`, `#ffffff` (texto) | `var(--text)` |
| `#050510` | `var(--bg)` |
| `#0d0d1f`, `#0a0a1e` | `var(--surface)` |
| `#0a0a18`, `#1a1a35` | `var(--surface-2)` |
| `#2a2a50` | `var(--border)` |
| `#7c3aed` (preenchimento) | `var(--accent)` |
| `#6d28d9` (hover) | `var(--accent-hover)` |
| `#a78bfa` (texto/borda ativa) | `var(--accent-text)` / `var(--border-strong)` |
| `rgba(124,58,237,0.12)` | `var(--accent-weak)` |
| `#94a3b8` | `var(--text-muted)` |
| `#475569` | `var(--text-muted)` — **é o defeito de 2.6:1 da Seção 5 do spec** |
| `#e2e8f0` | `var(--text)` |
| `#22c55e` | `var(--success)` |
| `rgba(34,197,94,0.08)`, `rgba(34,197,94,0.12)` | `var(--success-weak)` |
| `rgba(34,197,94,0.25)`, `rgba(34,197,94,0.3)` | `var(--success)` (borda) |
| `#ef4444` | `var(--danger)` |
| `rgba(239,68,68,0.08)`, `rgba(239,68,68,0.12)` | `var(--danger-weak)` |
| `rgba(239,68,68,0.2)`, `rgba(239,68,68,0.25)`, `rgba(239,68,68,0.3)` | `var(--danger)` (borda) |
| `rgba(255,255,255,0.02)`, `rgba(255,255,255,0.03)`, `rgba(255,255,255,0.04)`, `rgba(255,255,255,0.06)` | `var(--surface-2)` |
| `rgba(255,255,255,0.05)` (divisória) | `var(--border)` |
| `rgba(100,116,139,0.1)` | `var(--surface-2)` |
| `rgba(100,116,139,0.2)` | `var(--border)` |
| `#1a1a35` em `.profile-radio` | `var(--surface-2)` |

Atenção a três pontos onde a tradução direta não serve:

1. **`.device-toggle .toggle-thumb` usa `#475569` como bolinha desligada e `#fff` como ligada.** Desligada vira `var(--text-muted)`, ligada vira `var(--text-on-accent)`.
2. **`.sidebar-logo-dot` tem `box-shadow: 0 0 8px rgba(124,58,237,0.6)`.** Sombra é exceção permitida à regra de literais, mas o verificador vai acusar. Trocar por `box-shadow: 0 0 0 3px var(--accent-weak)` — resolve e fica visível no tema claro, onde brilho não aparece.
3. **`.sidebar` tinha fundo `#0a0a1e` diferente do `--bg`.** Passa a `var(--surface)`, para a sidebar continuar se distinguindo do corpo nos dois temas.

- [ ] **Step 4: Rodar o verificador até passar**

Run: `node tools/check-contrast.js`
Expected: PASS — `OK — todos os pares atingem o alvo nos dois temas, sem cores literais soltas.`

- [ ] **Step 5: Conferir a olho nos dois temas**

Run: `node server.js` (no terminal do usuário) e abrir `http://localhost:8080/dashboard.html` — **nunca `127.0.0.1`**, o login Google só aceita `localhost`.

Para testar o tema escuro antes de a Task 4 existir, no console do navegador: `document.documentElement.setAttribute('data-theme','dark')`.
Expected: nenhuma mancha escura no tema claro, nenhum texto invisível.

- [ ] **Step 6: Commit**

```bash
git add css/app.css
git commit -m "refactor: tokens semanticos de cor e tema claro por padrao"
```

---

### Task 3: Escala tipográfica e alvos de toque

**Files:**
- Modify: `css/app.css` (todas as declarações `font-size`, `padding`, `width`/`height` de controle, e a media query)

**Interfaces:**
- Consumes: tokens da Task 2
- Produces: `--fs-xs` … `--fs-2xl`; ponto de quebra `40em`; classe `.a11y-target` não é criada — o mínimo é aplicado diretamente em cada controle

- [ ] **Step 1: Adicionar os tokens de tamanho ao bloco `:root`**

Ficam no bloco claro apenas — não mudam entre temas.

```css
  --fs-xs: 0.875rem;
  --fs-sm: 1rem;
  --fs-base: 1.125rem;
  --fs-lg: 1.25rem;
  --fs-xl: 1.5rem;
  --fs-2xl: 2rem;
  --tap-min: 2.75rem;
```

- [ ] **Step 2: Definir a raiz e as escalas de texto**

```css
html { font-size: 100%; }
html[data-textsize="grande"] { font-size: 120%; }
html[data-textsize="maior"]  { font-size: 140%; }

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  font-size: var(--fs-base);
  line-height: 1.5;
}

h1, h2, h3, .section-title { line-height: 1.3; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Converter todo `font-size` para os tokens**

| Valor atual | Vira | Onde (exemplos) |
|---|---|---|
| 10px | `var(--fs-xs)` | `.badge`, `.sidebar-footer-label`, `.preview-label`, `.step-num` |
| 11px | `var(--fs-sm)` | `.form-label`, `.device-card-status`, `.history-card-body`, `.step-label`, `.toggle-hint`, `.sidebar-logo-text` |
| 12px | `var(--fs-sm)` | `.section-subtitle`, `.automation-card-when/-then`, `.chip-desc`, `.filter-chip`, `.trigger-note`, `.tooltip-text` |
| 13px | `var(--fs-base)` | `.sidebar-item`, `.error-msg`, `.preview-box`, `.history-card-time` |
| 14px | `var(--fs-base)` | `.form-input`, `.chip`, `.toggle-label`, `.empty-msg`, `.history-card-name` |
| 15px | `var(--fs-lg)` | `.btn`, `.profile-card-name`, `.automation-card-name`, `.voice-btn-title` |
| 16px | `var(--fs-lg)` | `.device-card-name`, `.btn-delete` |
| 18px | `var(--fs-xl)` | `.section-title`, `.sidebar-item-icon` |
| 20px, 22px, 26px | `var(--fs-xl)` a `var(--fs-2xl)` | ícones de card |

Nada pode ficar abaixo de `var(--fs-xs)`.

- [ ] **Step 3b: Tirar o maiúsculo dos rótulos de formulário**

Caixa alta elimina o contorno da palavra e reduz a velocidade de leitura. A 11px com `letter-spacing: 1px` era a pior combinação do app.

Remover `text-transform: uppercase` e `letter-spacing` de `.form-label`, `.step-label` e `.preview-label`, que passam a:

```css
.form-label {
  display: flex; align-items: center; gap: 0.375rem;
  font-size: var(--fs-sm); font-weight: 700;
  color: var(--text); margin-bottom: 0.5rem;
}
```

Note que a cor sobe de `--text-muted` para `--text`: rótulo de campo é conteúdo, não metadado.

**O maiúsculo permanece** em `.device-card-status`, `.badge` e afins — ali são uma ou duas palavras, e a redundância com a cor é o que protege quem não distingue cores.

- [ ] **Step 4: Converter espaçamentos e aplicar o alvo mínimo**

Todo `padding`/`margin`/`gap` em `px` vira `rem` dividindo por 16 (`16px` → `1rem`, `12px` → `0.75rem`, `10px` → `0.625rem`). Larguras de borda ficam em `px`.

Controles que precisam de alvo mínimo explícito:

```css
.btn-delete {
  min-width: var(--tap-min);
  min-height: var(--tap-min);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sidebar-item { min-height: var(--tap-min); }
.chip, .filter-chip, .suggestion-chip { min-height: var(--tap-min); }
.tooltip-icon { min-width: var(--tap-min); min-height: var(--tap-min); }
```

- [ ] **Step 5: Trocar o ponto de quebra e alargar a sidebar**

```css
.sidebar { width: 13rem; }   /* era 160px */
```

E na media query: `@media (max-width: 640px)` → `@media (max-width: 40em)`.

Motivo: `em` em media query acompanha a raiz, então no modo "maior" o ponto dispara a 896px em vez de 640px — a tela adota o layout de celular sozinha quando o texto cresce demais para a sidebar.

Dentro da media query, os rótulos da navegação sobem de `10px` para `var(--fs-xs)`.

- [ ] **Step 6: Verificar refluxo**

Run: `node server.js`, abrir `http://localhost:8080/dashboard.html`, estreitar a janela até 320px e depois aplicar zoom de 400% a 1280px.
No console: `document.documentElement.setAttribute('data-textsize','maior')`.
Expected: nenhuma barra de rolagem horizontal, nenhum texto cortado, layout de celular ativo nos dois casos.

- [ ] **Step 7: Rodar o verificador de contraste (não pode ter regredido)**

Run: `node tools/check-contrast.js`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add css/app.css
git commit -m "refactor: escala tipografica em rem e alvos de toque de 44px"
```

---

### Task 4: Barra de acessibilidade

**Files:**
- Create: `js/a11y.js`
- Modify: `css/app.css` (estilos da barra; remoção de `.mobile-topbar` e `.sidebar-footer`)
- Modify: `login.html`, `profile.html`, `dashboard.html`, `automation.html`, `history.html`

**Interfaces:**
- Consumes: tokens das Tasks 2 e 3
- Produces:
  - `localStorage['ci-theme']` ∈ `{'claro','escuro'}`, `localStorage['ci-textsize']` ∈ `{'normal','grande','maior'}`
  - Atributos `data-theme` (`"dark"` quando escuro, ausente quando claro) e `data-textsize` em `<html>`
  - Elemento `#a11y-live` com `aria-live="polite"`, reutilizado pela Task 7
  - `<main id="conteudo">` como destino do link de pular

- [ ] **Step 1: Script inline no `<head>` das 5 páginas**

Vai **antes** de qualquer `<link rel="stylesheet">`, para a tela não piscar escura antes de virar clara. Repetir literalmente em cada uma das 5 páginas — é curto de propósito, e um arquivo externo aqui reintroduziria o piscar.

```html
<script>
  (function () {
    var t = localStorage.getItem('ci-theme');
    var s = localStorage.getItem('ci-textsize');
    if (t === 'escuro') document.documentElement.setAttribute('data-theme', 'dark');
    if (s && s !== 'normal') document.documentElement.setAttribute('data-textsize', s);
  })();
</script>
```

- [ ] **Step 2: Marcação da barra nas 5 páginas**

Primeiro elemento do `<body>`, antes de `.app-layout`. No `login.html` não existe `.app-layout` nem status de Arduino — omitir o `<div class="a11y-arduino">` lá.

```html
<a class="skip-link" href="#conteudo">Pular para o conteúdo</a>

<div class="a11y-bar">
  <div class="a11y-arduino" id="arduino-status">
    <span class="a11y-arduino-dot" aria-hidden="true">●</span>
    <span class="a11y-arduino-label">Arduino</span>
    <span id="arduino-status-text">Verificando...</span>
  </div>

  <div class="a11y-group" role="group" aria-label="Tamanho do texto">
    <span class="a11y-group-label">Tamanho do texto:</span>
    <button type="button" class="a11y-size" data-size="normal" aria-pressed="true"  title="Texto normal">A</button>
    <button type="button" class="a11y-size" data-size="grande" aria-pressed="false" title="Texto grande">A</button>
    <button type="button" class="a11y-size" data-size="maior"  aria-pressed="false" title="Texto muito grande">A</button>
  </div>

  <button type="button" class="a11y-theme" id="btn-theme">
    <span aria-hidden="true">🌙</span> <span id="btn-theme-label">Tema escuro</span>
  </button>

  <span id="a11y-live" class="visually-hidden" aria-live="polite"></span>
</div>
```

Cada `<button class="a11y-size">` é renderizado no tamanho que aplica (Step 4), então os três `A` crescem da esquerda para a direita e se explicam sozinhos.

- [ ] **Step 3: Envolver o conteúdo em `<main id="conteudo">`**

Em cada página, `<div class="page-body">` vira `<main class="page-body" id="conteudo">`. No `login.html`, envolver o card de login.

- [ ] **Step 4: Estilos da barra**

```css
.skip-link {
  position: absolute; left: -9999px;
  background: var(--accent); color: var(--text-on-accent);
  padding: 0.75rem 1rem; border-radius: var(--radius); z-index: 300;
}
.skip-link:focus { left: 0.5rem; top: 0.5rem; }

.visually-hidden {
  position: absolute; width: 1px; height: 1px;
  margin: -1px; padding: 0; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

.a11y-bar {
  display: flex; align-items: center; flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  padding: 0.5rem 1rem;
  background: var(--surface);
  border-bottom: 2px solid var(--border);
  position: sticky; top: 0; z-index: 200;
}

.a11y-arduino { display: flex; align-items: center; gap: 0.5rem; font-size: var(--fs-sm); font-weight: 700; color: var(--success); }
.a11y-arduino.offline { color: var(--danger); }
.a11y-arduino.loading { color: var(--text-muted); }

.a11y-group { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; }
.a11y-group-label { font-size: var(--fs-sm); font-weight: 700; color: var(--text); }

.a11y-size {
  min-width: var(--tap-min); min-height: var(--tap-min);
  border: 2px solid var(--border); border-radius: 0.5rem;
  background: var(--surface-2); color: var(--text);
  font-family: inherit; font-weight: 700; cursor: pointer;
}
.a11y-size[data-size="normal"] { font-size: var(--fs-sm); }
.a11y-size[data-size="grande"] { font-size: var(--fs-lg); }
.a11y-size[data-size="maior"]  { font-size: var(--fs-xl); }
.a11y-size[aria-pressed="true"] {
  background: var(--accent); color: var(--text-on-accent); border-color: var(--border-strong);
}

.a11y-theme {
  display: inline-flex; align-items: center; gap: 0.5rem;
  min-height: var(--tap-min); padding: 0 1rem;
  border: 2px solid var(--border); border-radius: 0.5rem;
  background: var(--surface-2); color: var(--text);
  font-family: inherit; font-size: var(--fs-sm); font-weight: 700; cursor: pointer;
}

.a11y-bar button:focus-visible {
  outline: 3px solid var(--focus-ring); outline-offset: 2px;
}

@media (max-width: 40em) {
  .a11y-group { margin-left: 0; }
}
```

- [ ] **Step 5: Remover `.mobile-topbar` e `.sidebar-footer`**

Apagar de `css/app.css`: as regras `.mobile-topbar*` (incluindo as de dentro da media query), `.sidebar-footer*`, e a regra `body.has-mobile-topbar .page-body`.

Apagar do `dashboard.html`: o `<div class="mobile-topbar">` inteiro e a classe `has-mobile-topbar` do `<body>`. Apagar de todas as páginas: o `<div class="sidebar-footer">`.

O status do Arduino agora vive só na barra, e o `id="arduino-status-text"` continua o mesmo — por isso `js/dashboard.js` não precisa mudar. Verificar em `js/dashboard.js:161` (`renderArduinoStatus`) se ele referencia `#arduino-sidebar` ou `#mobile-topbar`; se sim, apontar para `#arduino-status`.

- [ ] **Step 6: Implementar `js/a11y.js`**

Carregado em todas as 5 páginas, com `<script src="js/a11y.js"></script>` antes dos outros scripts.

```js
// Preferências de acessibilidade — lidas pelo script inline do <head>,
// gerenciadas aqui. Vivem em localStorage para funcionarem antes do login.
(function () {
  var root = document.documentElement;
  var live = document.getElementById('a11y-live');

  function anunciar(msg) {
    if (live) live.textContent = msg;
  }

  // ── Tamanho do texto ──
  var NOMES = { normal: 'Texto normal', grande: 'Texto grande', maior: 'Texto muito grande' };
  var tamanhoAtual = localStorage.getItem('ci-textsize') || 'normal';

  function aplicarTamanho(size, anunciando) {
    tamanhoAtual = size;
    if (size === 'normal') root.removeAttribute('data-textsize');
    else root.setAttribute('data-textsize', size);
    localStorage.setItem('ci-textsize', size);
    document.querySelectorAll('.a11y-size').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.size === size));
    });
    if (anunciando) anunciar(NOMES[size]);
  }

  document.querySelectorAll('.a11y-size').forEach(function (b) {
    b.addEventListener('click', function () { aplicarTamanho(b.dataset.size, true); });
  });

  // ── Tema ──
  var temaAtual = localStorage.getItem('ci-theme') || 'claro';
  var btnTema = document.getElementById('btn-theme');
  var lblTema = document.getElementById('btn-theme-label');

  function aplicarTema(tema, anunciando) {
    temaAtual = tema;
    if (tema === 'escuro') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    localStorage.setItem('ci-theme', tema);
    // O botão anuncia a AÇÃO, não o estado: quem está no claro lê "Tema escuro".
    if (lblTema) lblTema.textContent = tema === 'escuro' ? 'Tema claro' : 'Tema escuro';
    if (btnTema) btnTema.firstElementChild.textContent = tema === 'escuro' ? '☀️' : '🌙';
    if (anunciando) anunciar(tema === 'escuro' ? 'Tema escuro' : 'Tema claro');
  }

  if (btnTema) {
    btnTema.addEventListener('click', function () {
      aplicarTema(temaAtual === 'escuro' ? 'claro' : 'escuro', true);
    });
  }

  aplicarTamanho(tamanhoAtual, false);
  aplicarTema(temaAtual, false);
})();
```

- [ ] **Step 7: Testar manualmente as duas preferências**

Run: `node server.js`, abrir `http://localhost:8080/login.html`.
Expected:
- Os três `A` aparecem em tamanhos crescentes; clicar no maior escala a página inteira
- O botão de tema alterna e o rótulo passa a oferecer o oposto
- Recarregar a página mantém as duas escolhas **sem piscar** no tema errado
- Navegar para `dashboard.html` preserva as escolhas
- `Tab` na primeira posição revela "Pular para o conteúdo"; `Enter` pula a sidebar

- [ ] **Step 8: Commit**

```bash
git add js/a11y.js css/app.css login.html profile.html dashboard.html automation.html history.html
git commit -m "feat: barra de acessibilidade com tema e tamanho de texto"
```

---

### Task 5: Semântica, foco e defeitos pontuais

**Files:**
- Modify: `dashboard.html`, `profile.html`, `automation.html`, `history.html`, `login.html`
- Modify: `css/app.css`
- Modify: `js/dashboard.js:76-118` (`renderDevices`)

**Interfaces:**
- Consumes: `<main id="conteudo">` da Task 4
- Produces: um `<h1>` por página; `aria-pressed` nos cards de dispositivo

- [ ] **Step 1: Um `<h1>` por página**

Nenhuma página do app tem `<h1>` hoje — só `index.html`. Leitores de tela navegam por cabeçalhos, e a ausência de `<h1>` deixa a pessoa sem ponto de partida.

Primeiro elemento dentro de `<main>`, em cada página:

| Página | `<h1>` |
|---|---|
| `dashboard.html` | `Seus dispositivos` (substitui o `<h2 class="section-title">` atual) |
| `automation.html` | `Automações` |
| `history.html` | `Histórico` |
| `profile.html` | `Seu perfil` |
| `login.html` | `Casa Inteligente` |

```css
h1 { font-size: var(--fs-2xl); font-weight: 800; margin-bottom: 0.375rem; color: var(--text); }
```

Os `<h2 class="section-title">` restantes continuam sendo `<h2>` — a hierarquia fica h1 → h2, sem pular nível.

- [ ] **Step 2: Emoji decorativo sai da leitura**

Todo emoji que acompanha um rótulo de texto recebe `aria-hidden="true"`. Sem isso o leitor de tela narra "casa Dashboard raio Automações prancheta Histórico" na sidebar.

Em cada página: `<span class="sidebar-item-icon">🏠</span>` → `<span class="sidebar-item-icon" aria-hidden="true">🏠</span>`. Mesmo tratamento em `.device-card-icon`, `.profile-card-icon`, `.automation-card-icon`, `.history-card-icon`, `.voice-btn-icon` e nos emojis dos `filter-chip` do `history.html`.

- [ ] **Step 3: Corrigir o link falso do dashboard**

`dashboard.html:103` é um `<a>` com `onclick` e **sem `href`** — não recebe foco pelo `Tab` e não é anunciado como link.

```html
<a class="link-ver-mais" href="history.html">Ver histórico completo →</a>
```

- [ ] **Step 4: Estado dos cards de dispositivo para leitor de tela**

Em `js/dashboard.js`, `renderDevices()` monta cada card. O `<button>` do card recebe `aria-pressed`, e `updateDeviceUI()` passa a mantê-lo em dia junto com a classe `.on`:

```js
// em renderDevices(), no <button class="device-card">:
aria-pressed="${isOn ? 'true' : 'false'}"

// em updateDeviceUI(), junto de btn.classList.toggle('on', isOn):
btn.setAttribute('aria-pressed', String(isOn));
```

- [ ] **Step 5: Foco visível e consistente**

```css
:where(a, button, input, select, [tabindex]):focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}
.toggle-switch:focus { outline: none; }
```

A segunda regra é o conserto: `.toggle-switch` usava `:focus`, que dispara também no clique de mouse e polui a tela. O `:focus-visible` da primeira regra passa a cobri-lo.

- [ ] **Step 6: Verificar com o teclado**

Run: `node server.js`, abrir cada uma das 5 páginas e percorrer com `Tab` do início ao fim.
Expected: todo controle recebe foco visível; a ordem segue a leitura; nenhum elemento é pulado.

- [ ] **Step 7: Commit**

```bash
git add dashboard.html profile.html automation.html history.html login.html css/app.css js/dashboard.js
git commit -m "fix: h1, main, aria e foco visivel em todas as telas"
```

---

### Task 6: Chips operáveis por teclado e tooltips clicáveis

O defeito mais grave do spec: o editor de automações e os filtros do histórico não funcionam sem mouse.

**Files:**
- Modify: `history.html:49-61`
- Modify: `js/automation.js:76,102,176-179`
- Modify: `js/history.js` (delegação de clique dos filtros)
- Modify: `automation.html:70,79,88` (tooltips)
- Modify: `css/app.css`

**Interfaces:**
- Consumes: tokens e alvos das Tasks 2 e 3
- Produces: chips como `<button type="button">` com `aria-pressed`; `data-*` preservados

- [ ] **Step 1: Filtros do histórico viram botões**

Em `history.html`, cada `<span class="filter-chip" data-filter=… data-value=…>` vira:

```html
<button type="button" class="filter-chip active" data-filter="trigger" data-value="todos" aria-pressed="true">Todos</button>
<button type="button" class="filter-chip" data-filter="trigger" data-value="voz" aria-pressed="false"><span aria-hidden="true">🎤</span> Voz</button>
```

Repetir para os 10 filtros (6 de gatilho, 4 de período), mantendo `data-filter` e `data-value` exatamente como estão — `js/history.js` seleciona por eles.

Onde `js/history.js` alterna a classe `active`, alternar também `aria-pressed`.

- [ ] **Step 2: Chips do editor de automações viram botões**

Em `js/automation.js`, três lugares geram chips como `<div>`:

```js
// linha 76 — dispositivos
`<button type="button" class="chip" data-id="${d.id}" aria-pressed="false">`

// linha 102 — gatilhos
`<button type="button" class="chip ${form.trigger === t ? 'selected' : ''}" data-id="${t}" aria-pressed="${form.trigger === t}">${info.icon} ${escapeHtml(info.label)}</button>`

// linha 176 — ações, com descrição
`<button type="button" class="chip chip-with-desc" data-id="${a.id}" aria-pressed="false">
   <span class="chip-main">${a.icon} ${escapeHtml(a.label)}</span>
   <span class="chip-desc">${escapeHtml(a.desc)}</span>
 </button>`
```

Onde a classe `selected` é aplicada, aplicar `aria-pressed` junto. Os emojis dentro dos chips recebem `aria-hidden="true"`.

- [ ] **Step 2b: Ajustar o CSS dos chips para `<button>`**

`<button>` traz estilos do agente do usuário que `<div>` não tinha:

```css
.chip, .filter-chip, .suggestion-chip {
  font-family: inherit;
  text-align: left;
}
```

- [ ] **Step 3: Tooltips que abrem no clique e fecham no `Esc`**

Hoje têm `tabindex="0"` mas o CSS só abre no `:hover` — dá para focar e nada aparece.

Em `automation.html`, os três tooltips viram botões:

```html
<button type="button" class="tooltip-icon" aria-expanded="false">
  <span aria-hidden="true">ⓘ</span>
  <span class="visually-hidden">Ajuda</span>
  <span class="tooltip-text">Nome para identificar essa automação. Aparece no histórico. Ex: "Luz Cozinha".</span>
</button>
```

```css
.tooltip-icon .tooltip-text { display: none; }
.tooltip-icon[aria-expanded="true"] .tooltip-text { display: block; }
```

(Remover a regra `.tooltip-icon:hover .tooltip-text { display: block; }`.)

Em `js/automation.js`, no final do arquivo:

```js
// Tooltips: clique abre, Esc fecha, clique fora fecha.
document.addEventListener('click', function (e) {
  var alvo = e.target.closest('.tooltip-icon');
  document.querySelectorAll('.tooltip-icon[aria-expanded="true"]').forEach(function (t) {
    if (t !== alvo) t.setAttribute('aria-expanded', 'false');
  });
  if (alvo) alvo.setAttribute('aria-expanded', alvo.getAttribute('aria-expanded') === 'false' ? 'true' : 'false');
});

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.tooltip-icon[aria-expanded="true"]').forEach(function (t) {
    t.setAttribute('aria-expanded', 'false');
    t.focus();
  });
});
```

- [ ] **Step 4: Testar o editor inteiro sem tocar no mouse**

Run: `node server.js`, abrir `http://localhost:8080/automation.html`.
Expected, usando **apenas `Tab`, setas, `Enter`/`Espaço` e `Esc`**:
- Escolher um dispositivo, um gatilho e uma ação
- Preencher o nome
- Abrir e fechar um tooltip
- Salvar a automação, e vê-la aparecer na lista

Depois, em `history.html`: aplicar um filtro de gatilho e um de período só pelo teclado.

- [ ] **Step 5: Confirmar que o mouse continua funcionando**

Expected: repetir o fluxo acima com o mouse — nenhuma regressão. Esta é a tarefa com maior risco de quebrar o que já funcionava.

- [ ] **Step 6: Commit**

```bash
git add history.html automation.html js/automation.js js/history.js css/app.css
git commit -m "fix: chips operaveis por teclado e tooltips clicaveis"
```

---

### Task 7: Confirmação falada

**Files:**
- Create: `js/speech.js`
- Create: `tools/speech-labels.test.js`
- Modify: `js/devices.js:1-6` (campos de fala)
- Modify: `js/dashboard.js:120-146` (`listenDeviceStates`, `updateDeviceUI`)
- Modify: `js/profile.js`, `profile.html` (interruptor + botão Testar)

**Interfaces:**
- Consumes: `DEVICES` de `js/devices.js`; `#a11y-live` da Task 4
- Produces:
  - `frasePara(deviceId, isOn) -> string` — ex.: `'Luz ligada'`
  - `speech.falar(texto)`, `speech.disponivel() -> boolean`
  - `localStorage['ci-fala']` ∈ `{'on','off'}`, padrão `'off'`

- [ ] **Step 1: Escrever o teste do mapa de particípios**

Criar `tools/speech-labels.test.js`. O `js/devices.js` é um script global, sem `module.exports` — o Step 3 adiciona um export guardado para o Node conseguir carregá-lo.

```js
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test tools/`
Expected: FAIL — `frasePara is not a function`

- [ ] **Step 3: Adicionar os particípios e `frasePara` a `js/devices.js`**

```js
const DEVICES = [
  { id: 'luz',        name: 'Luz',        icon: '💡', labelOn: 'Ligado',  labelOff: 'Desligado', labelTransition: { on: 'Ligando...',   off: 'Desligando...' }, speechOn: 'ligada',  speechOff: 'desligada'  },
  { id: 'ventilador', name: 'Ventilador', icon: '🌀', labelOn: 'Ligado',  labelOff: 'Desligado', labelTransition: { on: 'Ligando...',   off: 'Desligando...' }, speechOn: 'ligado',  speechOff: 'desligado'  },
  { id: 'portao',     name: 'Portão',     icon: '🚪', labelOn: 'Aberto',  labelOff: 'Fechado',   labelTransition: { on: 'Abrindo...',   off: 'Fechando...'   }, speechOn: 'aberto',  speechOff: 'fechado'    },
  { id: 'alarme',     name: 'Alarme',     icon: '🔔', labelOn: 'Armado',  labelOff: 'Desarmado', labelTransition: { on: 'Armando...',   off: 'Desarmando...' }, speechOn: 'armado',  speechOff: 'desarmado'  }
];

// "Luz ligada", não "Luz ligado" — os rótulos visuais (labelOn) não servem
// para fala porque não concordam em gênero com o nome do dispositivo.
function frasePara(deviceId, isOn) {
  const d = DEVICES.find(x => x.id === deviceId);
  if (!d) return null;
  return `${d.name} ${isOn ? d.speechOn : d.speechOff}`;
}
```

E no fim do arquivo, para o Node conseguir carregar (inerte no navegador, onde `module` não existe):

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEVICES, escapeHtml, formatRelativeTime, frasePara };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test tools/`
Expected: PASS — os 11 da Task 1 mais os 6 desta

- [ ] **Step 5: Implementar `js/speech.js`**

```js
// Saída falada das confirmações. O app já tem entrada por voz (voice.js);
// isto fecha o ciclo para quem não enxerga o estado na tela.
const speech = (() => {
  let vozPtBr = null;
  let procurou = false;

  function procurarVoz() {
    if (!('speechSynthesis' in window)) return;
    const vozes = window.speechSynthesis.getVoices();
    if (!vozes.length) return;            // Chrome responde vazio na 1ª chamada
    vozPtBr = vozes.find(v => /^pt[-_]BR/i.test(v.lang)) || null;
    procurou = true;
  }

  if ('speechSynthesis' in window) {
    procurarVoz();
    window.speechSynthesis.addEventListener('voiceschanged', procurarVoz);
  }

  return {
    // Só é "disponível" quando existe voz pt-BR — falar português com voz
    // inglesa fica ininteligível, que é pior que ficar em silêncio.
    disponivel() {
      if (!procurou) procurarVoz();
      return !!vozPtBr;
    },

    ativa() {
      return localStorage.getItem('ci-fala') === 'on';
    },

    falar(texto) {
      if (!this.ativa() || !this.disponivel() || !texto) return;
      // Realimentação: se o microfone está escutando, o reconhecimento
      // capta a própria voz do app. Não falar enquanto ele estiver ativo.
      if (typeof voiceControl !== 'undefined' && voiceControl.isListening()) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      u.voice = vozPtBr;
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    }
  };
})();
```

- [ ] **Step 6: Ligar ao dashboard, sem falar no primeiro snapshot**

Em `js/dashboard.js`, `listenDeviceStates()` (linha 120) entrega o estado inicial dos 4 dispositivos ao carregar a página. Sem trava, o app anuncia os quatro em sequência a cada abertura.

```js
// no topo do módulo
let _falaLiberada = false;

// dentro de listenDeviceStates(), após processar o primeiro snapshot:
_falaLiberada = true;

// dentro de updateDeviceUI(deviceId, isOn), no fim:
if (_falaLiberada) speech.falar(frasePara(deviceId, isOn));
```

O gancho é `updateDeviceUI` porque é o ponto único por onde toda mudança passa — clique, voz ou o próprio ESP8266 — e porque ele reflete o estado **confirmado** pelo Firebase, não o otimista que `toggleDevice()` pinta antes de saber o resultado.

Em `toggleDevice()`, no ramo de falha (onde hoje reverte a UI):

```js
const _dev = DEVICES.find(d => d.id === deviceId);
speech.falar(`Não foi possível ${action === 'on' ? 'ligar' : 'desligar'} ${_dev ? _dev.name.toLowerCase() : 'o dispositivo'}`);
```

Carregar o script em `dashboard.html`, depois de `devices.js` e `voice.js`:

```html
<script src="js/speech.js"></script>
```

- [ ] **Step 7: Interruptor no Perfil, com botão Testar**

Em `profile.html`, sexto item da lista de interruptores existente:

```html
<div class="toggle-row">
  <div>
    <div class="toggle-label">Confirmar ações em voz alta</div>
    <div class="toggle-hint">O app fala o que aconteceu, ex.: "Luz ligada".</div>
  </div>
  <button type="button" class="btn btn-secondary" id="btn-testar-fala">Testar</button>
  <button type="button" class="toggle-switch" id="toggle-fala" role="switch" aria-checked="false" aria-label="Confirmar ações em voz alta"></button>
</div>
```

Em `js/profile.js`:

```js
const toggleFala = document.getElementById('toggle-fala');
const btnTestar = document.getElementById('btn-testar-fala');

// Nasce desligado: som inesperado assusta, e navegadores bloqueiam fala
// antes da primeira interação do usuário.
function pintarFala() {
  const on = localStorage.getItem('ci-fala') === 'on';
  toggleFala.classList.toggle('on', on);
  toggleFala.setAttribute('aria-checked', String(on));
}

if (!speech.disponivel()) {
  toggleFala.disabled = true;
  btnTestar.disabled = true;
  document.querySelector('#toggle-fala').closest('.toggle-row')
    .querySelector('.toggle-hint').textContent = 'Não disponível neste navegador.';
} else {
  toggleFala.addEventListener('click', () => {
    localStorage.setItem('ci-fala', localStorage.getItem('ci-fala') === 'on' ? 'off' : 'on');
    pintarFala();
  });
  btnTestar.addEventListener('click', () => {
    const anterior = localStorage.getItem('ci-fala');
    localStorage.setItem('ci-fala', 'on');   // testar fala mesmo com o ajuste desligado
    speech.falar('Luz ligada');
    localStorage.setItem('ci-fala', anterior || 'off');
  });
}
pintarFala();
```

Carregar `js/speech.js` e `js/devices.js` em `profile.html`.

- [ ] **Step 8: Testar a fala**

Run: `node server.js`, abrir `http://localhost:8080/profile.html`.
Expected:
- "Testar" fala "Luz ligada" mesmo com o interruptor desligado
- Ligar o interruptor, ir ao dashboard: **abrir a página não fala nada** (a trava do primeiro snapshot)
- Clicar na luz fala "Luz ligada"; clicar de novo fala "Luz desligada"
- Abrir o portão fala "Portão aberto", não "Portão ligado"
- Com o microfone escutando, o app não fala por cima

- [ ] **Step 9: Commit**

```bash
git add js/speech.js js/devices.js js/dashboard.js js/profile.js profile.html dashboard.html tools/speech-labels.test.js
git commit -m "feat: confirmacao falada das acoes com concordancia de genero"
```

---

### Task 8: Tokens no site institucional

Escopo mínimo deliberado: o site institucional não é redesenhado agora (spec próprio, depois da apresentação). Só não pode destoar do app.

**Files:**
- Modify: `styles.css` (bloco `:root`)

- [ ] **Step 1: Alinhar as variáveis existentes**

`styles.css` já tem `:root` com `--bg`, `--card`, `--purple`, `--text`, `--text-muted` etc. Substituir os valores pelos do tema claro do app, mantendo os nomes que o arquivo já usa (não renomear — são dezenas de referências):

```css
:root {
  --bg: #f8f8fb;
  --bg2: #f1f1f6;
  --bg3: #ffffff;
  --card: #ffffff;
  --card2: #f1f1f6;
  --purple: #5b21b6;
  --purple-light: #6d28d9;
  --purple-dark: #4c1d95;
  --purple-bg: #ede9fe;
  --text: #14141f;
  --text-muted: #4b5563;
  --text-dim: #4b5563;
}
```

`--text-dim` (`#6b7280`, 4.8:1) passa a valer o mesmo que `--text-muted`: era a cor mais fraca do arquivo e não atinge 7:1.

- [ ] **Step 2: Elevar os tamanhos abaixo do piso**

`styles.css` tem `font-size` de `0.6rem`, `0.62rem`, `0.65rem`, `0.7rem`, `0.72rem` e `0.75rem` — todos abaixo do piso de `0.875rem`. Elevar cada um para `0.875rem`.

- [ ] **Step 3: Conferir a olho**

Run: `node server.js`, abrir `http://localhost:8080/index.html`.
Expected: página coerente com o app, sem texto claro sobre fundo claro. Onde houver seção que dependia do fundo escuro (herói, rodapé), ajustar para `var(--card)`/`var(--text)`.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "style: site institucional herda a paleta clara do app"
```

---

### Task 9: Verificação final

**Files:** nenhum (só verificação); `README.md` se algo mudar de comando

- [ ] **Step 1: Guardas automatizadas**

```bash
node tools/check-contrast.js
node --test tools/
cd backend && npm test
```
Expected: contraste OK; 17 testes de `tools/`; **18 testes de backend** — o backend não foi tocado, qualquer quebra ali indica alteração indevida.

- [ ] **Step 2: Varredura das 6 telas em claro/normal**

`login`, `profile`, `dashboard`, `automation`, `history` e `index`.
Expected: nada ilegível, nada cortado, nenhum resquício do tema escuro.

- [ ] **Step 3: Extremo oposto — escuro/maior**

`dashboard.html` e `automation.html` com tema escuro e texto "maior".
Expected: layout de celular ativo (o ponto de quebra em `em` dispara sozinho); nenhuma sobreposição.

- [ ] **Step 4: Teclado, tela a tela**

Expected: todo controle alcançável; foco sempre visível; editor de automações operável do início ao fim sem mouse; filtros do histórico idem.

- [ ] **Step 5: Refluxo**

320px de largura, e zoom de 400% a 1280px.
Expected: sem rolagem horizontal.

- [ ] **Step 6: Caminho de volta ao hardware não regrediu**

Com a simulação do Wokwi rodando (ver `project-firmware-esp8266`), clicar num dispositivo no dashboard.
Expected: o LED correspondente acende na simulação e o status volta para "Online". Nenhuma tarefa deste plano toca no backend ou no firmware, mas esta é a cadeia que a apresentação depende — vale confirmar antes de mesclar.

- [ ] **Step 7: Atualizar o README**

Acrescentar à seção de comandos:

```bash
node tools/check-contrast.js   # verifica contraste dos temas
node --test tools/             # testes das ferramentas
```

E, na seção de limitações, registrar: **não houve teste com leitor de tela real (NVDA/VoiceOver) nem com pessoa do público-alvo.** Os atributos `aria-*` são boa prática aplicada com cuidado, não comportamento medido.

- [ ] **Step 8: Commit**

```bash
git add README.md
git commit -m "docs: comandos de verificacao e limitacoes de acessibilidade"
```

---

## Ordem e Dependências

```
Task 1 (guardas)
  └─ Task 2 (tokens)
       └─ Task 3 (escala)
            ├─ Task 4 (barra)  ─┬─ Task 5 (semântica)
            │                   ├─ Task 6 (teclado)
            │                   └─ Task 7 (fala)
            └─ Task 8 (site institucional)
                 └─ Task 9 (verificação final)
```

Tasks 5, 6 e 7 são independentes entre si e podem ser paralelizadas depois da Task 4. A Task 8 só depende da paleta (Task 2), mas é melhor deixá-la perto do fim para não duplicar conferência visual.

## Riscos e Onde Eles Aparecem

| Risco | Tarefa | Sinal de que aconteceu |
|---|---|---|
| Regra de cor esquecida some no tema claro | 2 | `node tools/check-contrast.js` acusa "cor literal fora dos blocos" |
| Sidebar espremida no modo "maior" | 3 | Step 6 da Task 3 mostra rolagem horizontal |
| Conversão dos chips quebra o editor | 6 | Step 5 da Task 6 — refazer o fluxo com mouse |
| Fala dispara ao abrir o dashboard | 7 | Step 8 da Task 7 — a trava `_falaLiberada` não foi aplicada |
| Navegador da apresentação sem voz pt-BR | 7 | Interruptor aparece desabilitado; botão "Testar" verifica antes |
| Tela pisca escura antes de virar clara | 4 | Script inline foi posto depois do `<link>`, ou num arquivo externo |
