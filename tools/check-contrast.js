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
  let globalInTheme = false;
  let globalBraceDepth = 0;

  lines.forEach((line, i) => {
    let accumulated = '';
    let inTheme = globalInTheme;
    let braceDepth = globalBraceDepth;

    // Check if this line starts a theme block (if we're not already in one)
    if (!inTheme && /^:root(\s*\{|\[data-theme)/.test(line.trim())) {
      inTheme = true;
    }

    // Process line character by character to track when theme closes
    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (inTheme) {
        if (char === '{') braceDepth++;
        if (char === '}') {
          braceDepth--;
          if (braceDepth === 0) inTheme = false;
        }
      } else {
        accumulated += char;
      }
    }

    // Check accumulated for colors outside theme blocks
    if (/#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(accumulated)) {
      stray.push(`css/app.css:${i + 1}: ${line.trim()}`);
    }

    globalInTheme = inTheme;
    globalBraceDepth = braceDepth;
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
