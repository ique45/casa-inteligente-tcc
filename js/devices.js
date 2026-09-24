const DEVICES = [
  { id: 'luz',        name: 'Luz',        icon: '💡', labelOn: 'Ligado',  labelOff: 'Desligado', labelTransition: { on: 'Ligando...',   off: 'Desligando...' }, speechOn: 'ligada',  speechOff: 'desligada'  },
  { id: 'ventilador', name: 'Ventilador', icon: '🌀', labelOn: 'Ligado',  labelOff: 'Desligado', labelTransition: { on: 'Ligando...',   off: 'Desligando...' }, speechOn: 'ligado',  speechOff: 'desligado'  },
  { id: 'portao',     name: 'Portão',     icon: '🚪', labelOn: 'Aberto',  labelOff: 'Fechado',   labelTransition: { on: 'Abrindo...',   off: 'Fechando...'   }, speechOn: 'aberto',  speechOff: 'fechado'    },
  { id: 'alarme',     name: 'Alarme',     icon: '🔔', labelOn: 'Armado',  labelOff: 'Desarmado', labelTransition: { on: 'Armando...',   off: 'Desarmando...' }, speechOn: 'armado',  speechOff: 'desarmado'  }
];

// "Luz ligada", não "Luz ligado" — os rótulos visuais (labelOn) não concordam
// em gênero com o nome do dispositivo, então não servem para a fala.
function frasePara(deviceId, isOn) {
  const d = DEVICES.find(x => x.id === deviceId);
  if (!d) return null;
  return `${d.name} ${isOn ? d.speechOn : d.speechOff}`;
}

// Compartilhado entre automation.html (formulário) e dashboard.html (lista
// de cards e microfone): gatilhos, comandos de voz e os textos
// "Quando: / O sistema vai:" de uma automação salva.

const TRIGGER_INFO = {
  voz:         { label: 'Voz',           icon: '🎤' },
  botao:       { label: 'Botão no dashboard', icon: '🔘' },
  presenca:    { label: 'Presença',      icon: '👁️' },
  temperatura: { label: 'Temperatura',   icon: '🌡️' },
  horario:     { label: 'Horário',       icon: '⏰' }
};

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
  return _melhorComando(fala, automacoes, true);
}

// A frase de uma automação desligada. O microfone precisa saber disso para
// não cair nos padrões fixos, que executariam o comando mesmo assim.
function comandoDesativado(fala, automacoes) {
  return _melhorComando(fala, automacoes, false);
}

function _melhorComando(fala, automacoes, ativas) {
  const f = normalizarFrase(fala);
  if (!f) return null;
  let melhor = null;
  let melhorTamanho = 0;
  _automacoesDeVoz(automacoes).forEach(item => {
    if ((item.data.enabled !== false) !== ativas) return;
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

// Ao abrir uma automação salva para edição: descobre de qual par de verbos
// as frases vieram, campo a campo. O campo que não bate com o par foi
// escrito à mão e não deve ser recalculado quando o nome mudar.
function detectarPar(pares, nome, voiceOn, voiceOff) {
  for (let i = 0; i < pares.length; i++) {
    const c = montarComandos(pares[i], nome);
    if (c.voiceOn === voiceOn || c.voiceOff === voiceOff) {
      return { par: i, editadoOn: c.voiceOn !== voiceOn, editadoOff: c.voiceOff !== voiceOff };
    }
  }
  return { par: null, editadoOn: true, editadoOff: true };
}

// Mensagem que impede salvar, ou null. Uma palavra só ("Luz") casaria
// dentro de qualquer fala com essa palavra — "apagar luz" ligaria a luz.
function validarComandos(voiceOn, voiceOff) {
  const on = String(voiceOn || '').trim(), off = String(voiceOff || '').trim();
  if (!on || !off) return 'Preencha o comando para ligar e o para desligar.';
  const nOn = normalizarFrase(on), nOff = normalizarFrase(off);
  if (nOn.split(' ').length < 2 || nOff.split(' ').length < 2) {
    return 'Cada comando precisa de pelo menos duas palavras, como "Acender Luz".';
  }
  if (nOn === nOff) return 'Os dois comandos precisam ser diferentes.';
  return null;
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

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatRelativeTime(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now - 86400000);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const dayMonth = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  if (isToday) return `Hoje, ${dayMonth} · ${time}`;
  if (isYesterday) return `Ontem, ${dayMonth} · ${time}`;
  return `${dayMonth} · ${time}`;
}

// Inerte no navegador, onde `module` não existe; só o Node (testes) usa isto.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEVICES, escapeHtml, formatRelativeTime, frasePara,
    VOICE_VERBS, montarComandos, normalizarFrase, encontrarComando, comandoDesativado,
    comandoJaUsado, describeAutomation, descAlternar, detectarPar, validarComandos
  };
}
