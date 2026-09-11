// Gera casos-de-teste.html a partir de casos-de-teste.template.html, embutindo
// as capturas de tela desta mesma pasta como data URIs (o artifact fica 100%
// autocontido, sem depender de arquivos externos).
//
// Rodar de dentro de docs/apresentacao: node build-casos-de-teste.js
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const TEMPLATE = path.join(DIR, 'casos-de-teste.template.html');
const OUT = path.join(DIR, 'casos-de-teste.html');

function dataUri(file) {
  const b = fs.readFileSync(path.join(DIR, file));
  return 'data:image/png;base64,' + b.toString('base64');
}

let html = fs.readFileSync(TEMPLATE, 'utf8');

const map = {
  '__IMG_LOGIN__': dataUri('06-login.png'),
  '__IMG_DASH__': dataUri('01-dashboard.png'),
  '__IMG_AUTOEDIT__': dataUri('04-automacao-editor.png'),
  '__IMG_HIST__': dataUri('05-historico.png'),
  '__IMG_DARK__': dataUri('08-dashboard-tema-escuro.png'),
  '__IMG_PERFIL__': dataUri('02-perfil.png'),
  '__IMG_AUTOLIST__': dataUri('03-automacoes-lista.png'),
  '__IMG_BIG__': dataUri('07-dashboard-texto-maior.png'),
  '__IMG_VOZOFF__': dataUri('09-dashboard-voz-desativada.png'),
  '__IMG_HISTVOZ__': dataUri('10-historico-filtro-voz.png'),
};

for (const [k, v] of Object.entries(map)) {
  html = html.split(k).join(v);
}

fs.writeFileSync(OUT, html);
console.log('OK', OUT, Math.round(fs.statSync(OUT).size / 1024) + 'KB');
