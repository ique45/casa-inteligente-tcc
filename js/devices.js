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
// de cards): descreve as ações disponíveis por dispositivo e monta os
// textos "Quando: / O sistema vai:" de uma automação salva.

const TRIGGER_INFO = {
  voz:         { label: 'Voz',           icon: '🎤' },
  botao:       { label: 'Botão no dashboard', icon: '🔘' },
  presenca:    { label: 'Presença',      icon: '👁️' },
  temperatura: { label: 'Temperatura',   icon: '🌡️' },
  horario:     { label: 'Horário',       icon: '⏰' }
};

const ACTIONS_DEFAULT = [
  { id: 'toggle', label: 'Alternar',    icon: '🔄', desc: 'Liga se desligado, desliga se ligado' },
  { id: 'on',     label: 'Só ligar',    icon: '✅', desc: 'Sempre liga o dispositivo' },
  { id: 'off',    label: 'Só desligar', icon: '❌', desc: 'Sempre desliga o dispositivo' }
];

const ACTIONS_BY_DEVICE = {
  alarme: [
    { id: 'toggle', label: 'Alternar',  icon: '🔄', desc: 'Arma se desarmado, desarma se armado' },
    { id: 'on',     label: 'Armar',     icon: '🔒', desc: 'Sempre ativa o alarme' },
    { id: 'off',    label: 'Desarmar',  icon: '🔓', desc: 'Sempre desativa o alarme' }
  ],
  portao: [
    { id: 'toggle', label: 'Alternar', icon: '🔄', desc: 'Abre se fechado, fecha se aberto' },
    { id: 'on',     label: 'Abrir',    icon: '🟢', desc: 'Sempre abre o portão' },
    { id: 'off',    label: 'Fechar',   icon: '🔴', desc: 'Sempre fecha o portão' }
  ]
};

function getActions(deviceId) {
  return ACTIONS_BY_DEVICE[deviceId] || ACTIONS_DEFAULT;
}

function describeAutomation(d) {
  let whenText = '';
  if (d.trigger === 'voz') whenText = `você falar <strong>"${escapeHtml(d.voiceCommand || '')}"</strong>`;
  else if (d.trigger === 'botao') whenText = `você clicar no botão do dashboard`;
  else if (d.trigger === 'presenca') whenText = `o sensor detectar presença`;
  else if (d.trigger === 'temperatura') whenText = `o sensor de temperatura disparar`;
  else if (d.trigger === 'horario') whenText = `chegar o horário programado`;
  else whenText = escapeHtml(d.trigger);

  const actionObj = getActions(d.deviceType).find(a => a.id === d.action);
  const actionVerb = escapeHtml(actionObj ? actionObj.label.toLowerCase() : (d.action || '?'));
  const thenText = `<span class="action-verb">${actionVerb}</span> o <strong>${escapeHtml(d.deviceName)}</strong> automaticamente`;

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
  module.exports = { DEVICES, escapeHtml, formatRelativeTime, frasePara };
}
